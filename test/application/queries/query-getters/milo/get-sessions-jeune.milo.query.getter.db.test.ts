import { DateTime } from 'luxon'
import { describe } from 'mocha'
import { createSandbox, SinonSandbox } from 'sinon'
import { GetSessionsVisiblesPourLeJeuneMiloQueryGetter } from 'src/application/queries/query-getters/milo/get-sessions-disponibles-pour-jeune.milo.query.getter.db'
import { SessionsMiloFetcher } from 'src/application/queries/query-getters/milo/sessions-milo.fetcher'
import { success } from 'src/building-blocks/types/result'
import { MiloClient } from 'src/infrastructure/clients/milo/milo-client'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { StructureMiloSqlModel } from 'src/infrastructure/sequelize/models/structure-milo.sql-model'
import { DateService } from 'src/utils/date-service'
import { unJeune } from 'test/fixtures/jeune.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'
import { SessionMilo } from '../../../../../src/domain/milo/session.milo'
import { MILO_INSCRIT } from '../../../../../src/infrastructure/clients/dto/milo.dto'
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

describe('GetSessionsVisiblesPourLeJeuneMiloQueryGetter', () => {
  let getSessionsQueryGetter: GetSessionsVisiblesPourLeJeuneMiloQueryGetter
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
    getSessionsQueryGetter = new GetSessionsVisiblesPourLeJeuneMiloQueryGetter(
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
    const idStructureCayenne = 'id-cayenne'
    const jeuneParis = unJeune({ id: 'paris' })
    const jeuneCayenne = unJeune({ id: 'cayenne' })
    const idSession1 = 11
    const idSession2 = 22
    const sessionNonVisible = uneSessionDto

    beforeEach(async () => {
      await getDatabase().cleanPG()

      await ConseillerSqlModel.create(unConseillerDto())

      await StructureMiloSqlModel.create({
        id: idStructureParis,
        nomOfficiel: 'Paris',
        timezone: 'Europe/Paris'
      })
      await JeuneSqlModel.create(
        unJeuneDto({ id: jeuneParis.id, idStructureMilo: idStructureParis })
      )

      await StructureMiloSqlModel.create({
        id: idStructureCayenne,
        nomOfficiel: 'Cayenne',
        timezone: 'America/Cayenne'
      })
      await JeuneSqlModel.create(
        unJeuneDto({ id: jeuneCayenne.id, idStructureMilo: idStructureCayenne })
      )

      await SessionMiloSqlModel.create({
        id: idSession1,
        estVisible: true,
        idStructureMilo: idStructureParis,
        dateModification: DateTime.now().toJSDate()
      })
      await SessionMiloSqlModel.create({
        id: idSession2,
        estVisible: true,
        idStructureMilo: idStructureCayenne,
        dateModification: DateTime.now().toJSDate()
      })
    })

    it("renvoie tableau vide quand le jeune n'a pas de structure", async () => {
      const idJeuneSansStructure = 'sans-struct'
      await JeuneSqlModel.create(
        unJeuneDto({ id: idJeuneSansStructure, idStructureMilo: null })
      )

      const result = await getSessionsQueryGetter.handle(
        idJeuneSansStructure,
        accessToken
      )

      expect(result).to.deep.equal(success([]))
      expect(oidcClient.exchangeTokenJeune).not.to.have.been.called()
    })

    it('renvoie sessions visibles non inscrites + sessions inscrites même non visibles, triées, sans doublons', async () => {
      oidcClient.exchangeTokenJeune.withArgs(accessToken).resolves(idpToken)

      const sessionVisible1 = {
        ...uneSessionDto,
        id: idSession1,
        dateHeureDebut: '2020-04-08 10:20:00'
      }
      const sessionVisible2 = {
        ...uneSessionDto,
        id: idSession2,
        dateHeureDebut: '2020-04-07 10:20:00',
        dateMaxInscription: '2020-04-07'
      }
      miloClient.getSessionsParDossierJeune.withArgs(idpToken).resolves(
        success([
          {
            session: sessionNonVisible,
            offre: uneOffreDto,
            sessionInstance: { statut: MILO_INSCRIT }
          },
          {
            session: sessionVisible1,
            offre: uneOffreDto,
            sessionInstance: { statut: MILO_INSCRIT }
          },
          {
            session: sessionVisible2,
            offre: uneOffreDto
          }
        ])
      )

      const result = await getSessionsQueryGetter.handle(
        jeuneParis.id,
        accessToken
      )

      expect(result).to.deep.equal(
        success([
          uneSessionJeuneMiloQueryModel({
            dateHeureDebut: '2020-04-06T08:20:00.000Z',
            dateHeureFin: '2020-04-08T08:20:00.000Z',
            inscription: SessionMilo.Inscription.Statut.INSCRIT
          }),
          uneSessionJeuneMiloQueryModel({
            id: idSession2.toString(),
            dateHeureDebut: '2020-04-07T08:20:00.000Z',
            dateHeureFin: '2020-04-08T08:20:00.000Z'
          }),
          uneSessionJeuneMiloQueryModel({
            id: idSession1.toString(),
            dateHeureDebut: '2020-04-08T08:20:00.000Z',
            dateHeureFin: '2020-04-08T08:20:00.000Z',
            inscription: SessionMilo.Inscription.Statut.INSCRIT
          })
        ])
      )
    })

    it('applique la bonne timezone', async () => {
      oidcClient.exchangeTokenJeune.withArgs(accessToken).resolves(idpToken)

      const sessionVisible1 = {
        ...uneSessionDto,
        id: idSession1,
        dateHeureDebut: '2020-04-08 10:20:00',
        dateHeureFin: '2020-04-08 11:20:00',
        dateMaxInscription: '2020-04-07'
      }
      miloClient.getSessionsParDossierJeune
        .withArgs(idpToken, jeuneCayenne.idPartenaire)
        .resolves(
          success([
            {
              session: sessionNonVisible,
              offre: uneOffreDto
            },
            {
              session: sessionVisible1,
              offre: uneOffreDto
            }
          ])
        )

      const result = await getSessionsQueryGetter.handle(
        jeuneCayenne.id,
        accessToken
      )

      expect(result).to.deep.equal(
        success([
          uneSessionJeuneMiloQueryModel({
            id: idSession1.toString(),
            dateHeureDebut: '2020-04-08T13:20:00.000Z',
            dateHeureFin: '2020-04-08T14:20:00.000Z',
            dateMaxInscription: '2020-04-08T02:59:59.999Z'
          })
        ])
      )
    })

    describe('règles dateMaxInscription', () => {
      const idSessionExpiree = 33
      const idSessionInscrite = 44

      beforeEach(async () => {
        await SessionMiloSqlModel.create({
          id: idSessionExpiree,
          estVisible: true,
          idStructureMilo: idStructureParis,
          dateModification: DateTime.now().toJSDate()
        })
        await SessionMiloSqlModel.create({
          id: idSessionInscrite,
          estVisible: true,
          idStructureMilo: idStructureParis,
          dateModification: DateTime.now().toJSDate()
        })
      })

      it('exclut les sessions visibles non inscrites dont dateMaxInscription est dépassée', async () => {
        const sessionExpiree = {
          ...uneSessionDto,
          id: idSessionExpiree,
          dateHeureDebut: '2020-03-30 10:00:00',
          dateMaxInscription: '2020-03-28'
        }
        oidcClient.exchangeTokenJeune.withArgs(accessToken).resolves(idpToken)
        miloClient.getSessionsParDossierJeune
          .withArgs(idpToken)
          .resolves(success([{ session: sessionExpiree, offre: uneOffreDto }]))

        const result = await getSessionsQueryGetter.handle(
          jeuneParis.id,
          accessToken
        )

        expect(result).to.deep.equal(success([]))
      })

      it('affiche les sessions inscrites même si dateMaxInscription est dépassée', async () => {
        const sessionExpireeInscrite = {
          ...uneSessionDto,
          id: idSessionInscrite,
          dateHeureDebut: '2020-03-30 10:00:00',
          dateMaxInscription: '2020-03-28'
        }
        oidcClient.exchangeTokenJeune.withArgs(accessToken).resolves(idpToken)
        miloClient.getSessionsParDossierJeune.withArgs(idpToken).resolves(
          success([
            {
              session: sessionExpireeInscrite,
              offre: uneOffreDto,
              sessionInstance: { statut: MILO_INSCRIT }
            }
          ])
        )

        const result = await getSessionsQueryGetter.handle(
          jeuneParis.id,
          accessToken
        )

        expect(result).to.deep.equal(
          success([
            uneSessionJeuneMiloQueryModel({
              id: idSessionInscrite.toString(),
              dateHeureDebut: '2020-03-30T08:00:00.000Z',
              dateHeureFin: '2020-04-08T08:20:00.000Z',
              inscription: SessionMilo.Inscription.Statut.INSCRIT,
              dateMaxInscription: '2020-03-28T22:59:59.999Z'
            })
          ])
        )
      })
    })

    describe('règles pour dateMaxDesinscription', () => {
      const idSessionAutodesinscription = 55

      beforeEach(async () => {
        await SessionMiloSqlModel.create({
          id: idSessionAutodesinscription,
          estVisible: true,
          autodesinscription: true,
          idStructureMilo: idStructureParis,
          dateModification: DateTime.now().toJSDate()
        })
      })

      it('passe autodesinscription à false si dateMaxDesinscription est dépassée', async () => {
        const sessionDepassee = {
          ...uneSessionDto,
          id: idSessionAutodesinscription,
          dateHeureDebut: '2020-03-30 10:00:00',
          dateHeureFin: '2020-03-30 12:00:00',
          dateMaxInscription: null
        }
        oidcClient.exchangeTokenJeune.withArgs(accessToken).resolves(idpToken)
        miloClient.getSessionsParDossierJeune
          .withArgs(idpToken)
          .resolves(success([{ session: sessionDepassee, offre: uneOffreDto }]))

        const result = await getSessionsQueryGetter.handle(
          jeuneParis.id,
          accessToken
        )

        expect(result).to.deep.equal(
          success([
            uneSessionJeuneMiloQueryModel({
              id: idSessionAutodesinscription.toString(),
              dateHeureDebut: '2020-03-30T08:00:00.000Z',
              dateHeureFin: '2020-03-30T10:00:00.000Z',
              dateMaxInscription: undefined,
              autodesinscription: false
            })
          ])
        )
      })
    })
  })
})
