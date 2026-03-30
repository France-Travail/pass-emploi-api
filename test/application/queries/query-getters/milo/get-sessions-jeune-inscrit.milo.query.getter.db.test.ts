import { DateTime } from 'luxon'
import { describe } from 'mocha'
import { createSandbox, SinonSandbox } from 'sinon'
import { GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter } from 'src/application/queries/query-getters/milo/get-sessions-jeune-inscrit.milo.query.getter.db'
import { SessionsMiloFetcher } from 'src/application/queries/query-getters/milo/sessions-milo.fetcher'
import { success } from 'src/building-blocks/types/result'
import { SessionMilo } from 'src/domain/milo/session.milo'
import {
  MILO_INSCRIT,
  MILO_PRESENT,
  MILO_REFUS_JEUNE,
  MILO_REFUS_TIERS
} from 'src/infrastructure/clients/dto/milo.dto'
import { MiloClient } from 'src/infrastructure/clients/milo/milo-client'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { StructureMiloSqlModel } from 'src/infrastructure/sequelize/models/structure-milo.sql-model'
import { DateService } from 'src/utils/date-service'
import { unJeune } from 'test/fixtures/jeune.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'
import { ConseillerSqlModel } from '../../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { SessionMiloSqlModel } from '../../../../../src/infrastructure/sequelize/models/session-milo.sql-model'
import {
  uneOffreDto,
  uneSessionDto
} from '../../../../fixtures/milo-dto.fixture'
import { uneSessionJeuneMiloQueryModel } from '../../../../fixtures/sessions.fixture'
import { unConseillerDto } from '../../../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../../../fixtures/sql-models/jeune.sql-model'

describe('GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter', () => {
  let getter: GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter
  let oidcClient: StubbedClass<OidcClient>
  let miloClient: StubbedClass<MiloClient>
  let dateService: StubbedClass<DateService>
  let sandbox: SinonSandbox

  before(async () => {
    sandbox = createSandbox()
  })

  beforeEach(async () => {
    oidcClient = stubClass(OidcClient)
    miloClient = stubClass(MiloClient)
    dateService = stubClass(DateService)
    dateService.now.returns(DateTime.fromISO('2020-04-01T00:00:00.000Z'))
    const fetcher = new SessionsMiloFetcher(dateService)
    getter = new GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter(
      oidcClient,
      miloClient,
      fetcher
    )
  })

  after(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    const accessToken = 'accessToken'
    const idpToken = 'idpToken'
    const idStructureParis = 'id-paris'
    const jeune = unJeune({ id: 'paris' })
    const idSessionInscrite = 11
    const idSessionNonInscrite = 22
    const idSessionRefusJeune = 33
    const idSessionRefusTiers = 44
    const idSessionPresent = 55

    beforeEach(async () => {
      await getDatabase().cleanPG()

      await ConseillerSqlModel.create(unConseillerDto())

      await StructureMiloSqlModel.create({
        id: idStructureParis,
        nomOfficiel: 'Paris',
        timezone: 'Europe/Paris'
      })
      await JeuneSqlModel.create(
        unJeuneDto({ id: jeune.id, idStructureMilo: idStructureParis })
      )

      await SessionMiloSqlModel.create({
        id: idSessionInscrite,
        estVisible: true,
        idStructureMilo: idStructureParis,
        dateModification: DateTime.now().toJSDate()
      })
      await SessionMiloSqlModel.create({
        id: idSessionNonInscrite,
        estVisible: true,
        idStructureMilo: idStructureParis,
        dateModification: DateTime.now().toJSDate()
      })
    })

    it("renvoie tableau vide quand le jeune n'a pas de structure", async () => {
      const idJeuneSansStructure = 'sans-struct'
      await JeuneSqlModel.create(
        unJeuneDto({ id: idJeuneSansStructure, idStructureMilo: null })
      )

      const result = await getter.handle(idJeuneSansStructure, accessToken)

      expect(result).to.deep.equal(success([]))
      expect(oidcClient.exchangeTokenConseillerMilo).not.to.have.been.called()
    })

    it("utilise le token conseiller pour appeler l'API MILO", async () => {
      oidcClient.exchangeTokenConseillerMilo
        .withArgs(accessToken)
        .resolves(idpToken)
      miloClient.getSessionsParDossierJeunePourConseiller
        .withArgs(idpToken, jeune.idPartenaire)
        .resolves(success([]))

      await getter.handle(jeune.id, accessToken)

      expect(
        oidcClient.exchangeTokenConseillerMilo
      ).to.have.been.calledOnceWithExactly(accessToken)
      expect(oidcClient.exchangeTokenJeune).not.to.have.been.called()
    })

    it('renvoie uniquement les sessions auxquelles le jeune est inscrit, présent ou en refus jeune', async () => {
      oidcClient.exchangeTokenConseillerMilo
        .withArgs(accessToken)
        .resolves(idpToken)
      miloClient.getSessionsParDossierJeunePourConseiller
        .withArgs(idpToken)
        .resolves(
          success([
            {
              session: {
                ...uneSessionDto,
                id: idSessionInscrite,
                dateHeureDebut: '2020-04-06 10:20:00',
                dateHeureFin: '2020-04-08 10:20:00'
              },
              offre: uneOffreDto,
              sessionInstance: { statut: MILO_INSCRIT }
            },
            {
              session: { ...uneSessionDto, id: idSessionNonInscrite },
              offre: uneOffreDto
            },
            {
              session: { ...uneSessionDto, id: idSessionRefusJeune },
              offre: uneOffreDto,
              sessionInstance: { statut: MILO_REFUS_JEUNE }
            },
            {
              session: { ...uneSessionDto, id: idSessionRefusTiers },
              offre: uneOffreDto,
              sessionInstance: { statut: MILO_REFUS_TIERS }
            },
            {
              session: { ...uneSessionDto, id: idSessionPresent },
              offre: uneOffreDto,
              sessionInstance: { statut: MILO_PRESENT }
            }
          ])
        )

      const result = await getter.handle(jeune.id, accessToken)

      expect(result).to.deep.equal(
        success([
          uneSessionJeuneMiloQueryModel({
            id: idSessionInscrite.toString(),
            inscription: SessionMilo.Inscription.Statut.INSCRIT,
            dateHeureDebut: '2020-04-06T08:20:00.000Z',
            dateHeureFin: '2020-04-08T08:20:00.000Z'
          }),
          uneSessionJeuneMiloQueryModel({
            id: idSessionRefusJeune.toString(),
            inscription: SessionMilo.Inscription.Statut.REFUS_JEUNE,
            dateHeureDebut: '2020-04-06T08:20:00.000Z',
            dateHeureFin: '2020-04-08T08:20:00.000Z'
          }),
          uneSessionJeuneMiloQueryModel({
            id: idSessionPresent.toString(),
            inscription: SessionMilo.Inscription.Statut.PRESENT,
            dateHeureDebut: '2020-04-06T08:20:00.000Z',
            dateHeureFin: '2020-04-08T08:20:00.000Z'
          })
        ])
      )
    })

    it('renvoie les sessions inscrites même si dateMaxInscription est dépassée', async () => {
      const sessionExpireeInscrite = {
        ...uneSessionDto,
        id: idSessionInscrite,
        dateMaxInscription: '2020-03-01',
        dateHeureDebut: '2020-04-06 10:20:00',
        dateHeureFin: '2020-04-08 10:20:00'
      }
      oidcClient.exchangeTokenConseillerMilo
        .withArgs(accessToken)
        .resolves(idpToken)
      miloClient.getSessionsParDossierJeunePourConseiller
        .withArgs(idpToken)
        .resolves(
          success([
            {
              session: sessionExpireeInscrite,
              offre: uneOffreDto,
              sessionInstance: { statut: MILO_INSCRIT }
            }
          ])
        )

      const result = await getter.handle(jeune.id, accessToken)

      expect(result).to.deep.equal(
        success([
          uneSessionJeuneMiloQueryModel({
            id: idSessionInscrite.toString(),
            inscription: SessionMilo.Inscription.Statut.INSCRIT,
            dateMaxInscription: '2020-03-01T22:59:59.999Z',
            dateHeureDebut: '2020-04-06T08:20:00.000Z',
            dateHeureFin: '2020-04-08T08:20:00.000Z'
          })
        ])
      )
    })

    it("propage la failure de l'API", async () => {
      const erreur = { message: 'API error', code: 'ERR' }
      oidcClient.exchangeTokenConseillerMilo
        .withArgs(accessToken)
        .resolves(idpToken)
      miloClient.getSessionsParDossierJeunePourConseiller
        .withArgs(idpToken)
        .resolves({ _isSuccess: false, error: erreur } as never)

      const result = await getter.handle(jeune.id, accessToken)

      expect(result).to.deep.equal({ _isSuccess: false, error: erreur })
    })
  })
})
