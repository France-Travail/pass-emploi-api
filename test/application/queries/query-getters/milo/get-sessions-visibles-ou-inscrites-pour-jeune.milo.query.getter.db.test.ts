import { DateTime } from 'luxon'
import { describe } from 'mocha'
import { createSandbox, SinonSandbox } from 'sinon'
import { GetSessionsVisiblesOuInscritesPourLeJeuneMiloQueryGetter } from 'src/application/queries/query-getters/milo/get-sessions-visibles-ou-inscrites-pour-jeune.milo.query.getter.db'
import { SessionsMiloFetcher } from 'src/application/queries/query-getters/milo/sessions-milo.fetcher'
import { isSuccess, success } from 'src/building-blocks/types/result'
import { Authentification } from 'src/domain/authentification'
import { Core } from 'src/domain/core'
import { SessionMilo } from 'src/domain/milo/session.milo'
import {
  MILO_INSCRIT,
  SessionParDossierJeuneDto
} from 'src/infrastructure/clients/dto/milo.dto'
import { MiloClient } from 'src/infrastructure/clients/milo/milo-client'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { DateService } from 'src/utils/date-service'
import { unJeune } from 'test/fixtures/jeune.fixture'
import { uneOffreDto, uneSessionDto } from 'test/fixtures/milo-dto.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'
import { ConseillerSqlModel } from '../../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { SessionMiloSqlModel } from '../../../../../src/infrastructure/sequelize/models/session-milo.sql-model'
import { StructureMiloSqlModel } from '../../../../../src/infrastructure/sequelize/models/structure-milo.sql-model'
import { unConseillerDto } from '../../../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../../../fixtures/sql-models/jeune.sql-model'

describe('GetSessionsVisiblesOuInscritesPourLeJeuneMiloQueryGetter', () => {
  let getter: GetSessionsVisiblesOuInscritesPourLeJeuneMiloQueryGetter
  let oidcClient: StubbedClass<OidcClient>
  let miloClient: StubbedClass<MiloClient>
  let dateService: StubbedClass<DateService>
  let sandbox: SinonSandbox

  const accessToken = 'accessToken'
  const idpToken = 'idpToken'
  const idStructureParis = 'id-paris'
  const jeune = unJeune({ id: 'paris' })

  const idSessionVisibleNonInscrite = 11
  const idSessionNonVisibleNonInscrite = 22
  const idSessionNonVisibleInscrite = 33

  before(() => {
    sandbox = createSandbox()
  })

  beforeEach(async () => {
    oidcClient = stubClass(OidcClient)
    miloClient = stubClass(MiloClient)
    dateService = stubClass(DateService)
    dateService.now.returns(DateTime.fromISO('2020-04-01T00:00:00.000Z'))
    const fetcher = new SessionsMiloFetcher(dateService, oidcClient, miloClient)
    getter = new GetSessionsVisiblesOuInscritesPourLeJeuneMiloQueryGetter(
      fetcher
    )

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
    await SessionMiloSqlModel.bulkCreate([
      {
        id: idSessionVisibleNonInscrite,
        estVisible: true,
        autoinscription: true,
        autodesinscription: false,
        idStructureMilo: idStructureParis,
        dateModification: DateTime.now().toJSDate()
      },
      {
        id: idSessionNonVisibleNonInscrite,
        estVisible: false,
        autoinscription: true,
        autodesinscription: false,
        idStructureMilo: idStructureParis,
        dateModification: DateTime.now().toJSDate()
      },
      {
        id: idSessionNonVisibleInscrite,
        estVisible: false,
        autoinscription: true,
        autodesinscription: false,
        idStructureMilo: idStructureParis,
        dateModification: DateTime.now().toJSDate()
      }
    ])
  })

  after(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    it("renvoie un tableau vide quand le jeune n'a pas de structure", async () => {
      // Given
      await JeuneSqlModel.create(
        unJeuneDto({ id: 'sans-struct', idStructureMilo: null })
      )

      // When
      const result = await getter.handle(
        'sans-struct',
        Authentification.Type.JEUNE,
        accessToken
      )

      // Then
      expect(result).to.deep.equal(success([]))
    })

    it('mappe le DTO vers une projection domaine avec des dates exactes', async () => {
      // Given
      stubGetSessions([
        {
          session: {
            ...uneSessionDto,
            id: idSessionVisibleNonInscrite,
            dateHeureDebut: '2020-04-06 10:20:00',
            dateHeureFin: '2020-04-06 12:20:00',
            dateMaxInscription: '2020-04-05'
          },
          offre: uneOffreDto
        }
      ])

      // When
      const result = await getter.handle(
        jeune.id,
        Authentification.Type.JEUNE,
        accessToken
      )

      // Then
      expect(isSuccess(result) && result.data.length).to.equal(1)
      const session = isSuccess(result) && result.data[0]
      if (!session) throw new Error('session absente')
      expect(session.id).to.equal(idSessionVisibleNonInscrite.toString())
      expect(session.nomOffre).to.equal('Une-offre')
      expect(session.theme).to.equal('Un-theme')
      // 10:20 heure de Paris (UTC+2 en avril) => 08:20 UTC
      expect(session.debut.toISO()).to.equal('2020-04-06T08:20:00.000Z')
      expect(session.fin.toISO()).to.equal('2020-04-06T10:20:00.000Z')
      expect(session.dateMaxInscriptionAffichee?.toISO()).to.equal(
        '2020-04-05T21:59:59.999Z'
      )
      expect(session.dateMaxInscription.toISO()).to.equal(
        '2020-04-05T21:59:59.999Z'
      )
      expect(session.autoinscription).to.equal(true)
      expect(session.statutInscription).to.be.undefined()
    })

    it('retombe sur le début de session quand MiLo ne fournit pas de dateMaxInscription', async () => {
      // Given
      stubGetSessions([
        {
          session: {
            ...uneSessionDto,
            id: idSessionVisibleNonInscrite,
            dateHeureDebut: '2020-04-06 10:20:00',
            dateHeureFin: '2020-04-06 12:20:00',
            dateMaxInscription: null
          },
          offre: uneOffreDto
        }
      ])

      // When
      const result = await getter.handle(
        jeune.id,
        Authentification.Type.JEUNE,
        accessToken
      )

      // Then
      const session = isSuccess(result) && result.data[0]
      if (!session) throw new Error('session absente')
      expect(session.dateMaxInscriptionAffichee).to.be.undefined()
      expect(session.dateMaxInscription.toISO()).to.equal(session.debut.toISO())
    })

    it('filtre les sessions non visibles sauf celles où le jeune est inscrit', async () => {
      // Given
      stubGetSessions([
        {
          session: { ...uneSessionDto, id: idSessionVisibleNonInscrite },
          offre: uneOffreDto
        },
        {
          session: { ...uneSessionDto, id: idSessionNonVisibleNonInscrite },
          offre: uneOffreDto
        },
        {
          session: { ...uneSessionDto, id: idSessionNonVisibleInscrite },
          offre: uneOffreDto,
          sessionInstance: { statut: MILO_INSCRIT }
        }
      ])

      // When
      const result = await getter.handle(
        jeune.id,
        Authentification.Type.JEUNE,
        accessToken
      )

      // Then
      const ids = isSuccess(result) && result.data.map(({ id }) => id)
      expect(ids).to.deep.equal([
        idSessionVisibleNonInscrite.toString(),
        idSessionNonVisibleInscrite.toString()
      ])
      const sessionInscrite =
        isSuccess(result) &&
        result.data.find(
          ({ id }) => id === idSessionNonVisibleInscrite.toString()
        )
      expect(sessionInscrite && sessionInscrite.statutInscription).to.equal(
        SessionMilo.Inscription.Statut.INSCRIT
      )
    })

    it('trie les sessions par date de début croissante', async () => {
      // Given
      stubGetSessions([
        {
          session: {
            ...uneSessionDto,
            id: idSessionVisibleNonInscrite,
            dateHeureDebut: '2020-04-10 10:20:00',
            dateHeureFin: '2020-04-10 12:20:00'
          },
          offre: uneOffreDto
        },
        {
          session: {
            ...uneSessionDto,
            id: idSessionNonVisibleInscrite,
            dateHeureDebut: '2020-04-06 10:20:00',
            dateHeureFin: '2020-04-06 12:20:00'
          },
          offre: uneOffreDto,
          sessionInstance: { statut: MILO_INSCRIT }
        }
      ])

      // When
      const result = await getter.handle(
        jeune.id,
        Authentification.Type.JEUNE,
        accessToken
      )

      // Then
      const ids = isSuccess(result) && result.data.map(({ id }) => id)
      expect(ids).to.deep.equal([
        idSessionNonVisibleInscrite.toString(),
        idSessionVisibleNonInscrite.toString()
      ])
    })

    it("propage la failure de l'API MiLo", async () => {
      // Given
      const erreur = { message: 'API error', code: 'ERR' }
      oidcClient.exchangeTokenJeune
        .withArgs(accessToken, Core.Structure.MILO)
        .resolves(idpToken)
      miloClient.getSessionsParDossierJeune.resolves({
        _isSuccess: false,
        error: erreur
      } as never)

      // When
      const result = await getter.handle(
        jeune.id,
        Authentification.Type.JEUNE,
        accessToken
      )

      // Then
      expect(result).to.deep.equal({ _isSuccess: false, error: erreur })
    })
  })

  function stubGetSessions(sessions: SessionParDossierJeuneDto[]): void {
    oidcClient.exchangeTokenJeune
      .withArgs(accessToken, Core.Structure.MILO)
      .resolves(idpToken)
    miloClient.getSessionsParDossierJeune.resolves(success(sessions))
  }
})
