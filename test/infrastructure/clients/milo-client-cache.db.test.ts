import { ErreurMiloHttp } from '../../../src/building-blocks/types/domain-error'
import {
  failure,
  isFailure,
  isSuccess,
  success
} from '../../../src/building-blocks/types/result'
import { CacheApiPartenaireService } from '../../../src/infrastructure/clients/cache-api-partenaire.service.db'
import { MiloClient } from '../../../src/infrastructure/clients/milo/milo-client'
import { MiloClientV1 } from '../../../src/infrastructure/clients/milo/milo-client-v1'
import { MiloClientV2 } from '../../../src/infrastructure/clients/milo/milo-client-v2'
import { Context, ContextKey } from '../../../src/building-blocks/context'
import {
  CacheApiPartenaireDto,
  CacheApiPartenaireSqlModel
} from '../../../src/infrastructure/sequelize/models/cache-api-partenaire.sql-model'
import { AsSql } from '../../../src/infrastructure/sequelize/types'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { uneDatetime } from '../../fixtures/date.fixture'
import {
  unDetailSessionConseillerDto,
  uneSessionListeJeuneDto
} from '../../fixtures/milo-dto.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../utils/database-for-testing'
import { testConfig } from '../../utils/module-for-testing'

describe('MiloClient (cache sessions)', () => {
  const configService = testConfig()
  const conseiller = unUtilisateurConseiller({ id: 'id-conseiller' })
  const idpToken = 'idpToken'
  const idStructure = '1'
  const timezone = 'Europe/Paris'

  let databaseForTesting: DatabaseForTesting
  let miloClientV1: StubbedClass<MiloClientV1>
  let miloClientV2: StubbedClass<MiloClientV2>
  let context: StubbedClass<Context>
  let client: MiloClient

  beforeEach(async () => {
    databaseForTesting = getDatabase()
    await databaseForTesting.cleanPG()

    context = stubClass(Context)
    context.get.withArgs(ContextKey.UTILISATEUR).returns(conseiller)
    miloClientV1 = stubClass(MiloClientV1)
    miloClientV2 = stubClass(MiloClientV2)
    const cacheApiPartenaire = new CacheApiPartenaireService(
      databaseForTesting.sequelize,
      context
    )
    client = new MiloClient(
      configService,
      miloClientV1,
      miloClientV2,
      context,
      databaseForTesting.sequelize,
      cacheApiPartenaire
    )
  })

  const seedCache = (cle: string, data: unknown): Promise<unknown> => {
    const dto: AsSql<CacheApiPartenaireDto> = {
      id: 'd90e397a-dcb3-4a7b-8eac-3dec0aa55dfa',
      idUtilisateur: conseiller.id,
      typeUtilisateur: conseiller.type,
      date: uneDatetime().toJSDate(),
      pathPartenaire: cle,
      resultatPartenaire: data,
      transactionId: 'transactionId'
    }
    return CacheApiPartenaireSqlModel.create(dto)
  }

  describe('getSessionsConseillerParStructure', () => {
    describe("quand l'appel réussit", () => {
      it('renvoie les sessions fraîches (avec période + timezone)', async () => {
        // Given
        miloClientV1.getSessionsConseillerParStructure.resolves(
          success([unDetailSessionConseillerDto])
        )

        // When
        const result = await client.getSessionsConseillerParStructure(
          idpToken,
          idStructure,
          timezone,
          { periode: { debut: uneDatetime(), fin: uneDatetime() } }
        )

        // Then
        expect(isSuccess(result)).to.equal(true)
        if (isSuccess(result))
          expect(result.data).to.deep.equal([unDetailSessionConseillerDto])
      })
    })

    describe("quand l'appel échoue techniquement (5xx/timeout)", () => {
      it('renvoie le cache quand il existe (stale-if-error)', async () => {
        // Given
        await seedCache('milo/conseiller/structures/1/sessions?debut=&fin=', [
          unDetailSessionConseillerDto
        ])
        miloClientV1.getSessionsConseillerParStructure.rejects(
          new Error('boom 5xx')
        )

        // When
        const result = await client.getSessionsConseillerParStructure(
          idpToken,
          idStructure,
          timezone,
          { periode: {} }
        )

        // Then
        expect(isSuccess(result)).to.equal(true)
        if (isSuccess(result))
          expect(result.data).to.deep.equal([unDetailSessionConseillerDto])
      })

      it("throw quand il n'y a pas de cache", async () => {
        // Given
        const erreur = new Error('boom 5xx')
        miloClientV1.getSessionsConseillerParStructure.rejects(erreur)

        // When
        let erreurLevee: unknown
        try {
          await client.getSessionsConseillerParStructure(
            idpToken,
            idStructure,
            timezone,
            { periode: {} }
          )
        } catch (e) {
          erreurLevee = e
        }

        // Then
        expect(erreurLevee).to.equal(erreur)
      })
    })

    describe("quand l'appel renvoie une failure métier (4xx)", () => {
      it('propage la failure sans servir le cache', async () => {
        // Given
        await seedCache('milo/conseiller/structures/1/sessions?debut=&fin=', [
          unDetailSessionConseillerDto
        ])
        const erreurMetier = new ErreurMiloHttp('Requête invalide', 400)
        miloClientV1.getSessionsConseillerParStructure.resolves(
          failure(erreurMetier)
        )

        // When
        const result = await client.getSessionsConseillerParStructure(
          idpToken,
          idStructure,
          timezone,
          { periode: {} }
        )

        // Then
        expect(isFailure(result)).to.equal(true)
        if (isFailure(result)) expect(result.error).to.equal(erreurMetier)
      })
    })
  })

  describe('getSessionsParDossierJeune', () => {
    it('renvoie les sessions fraîches (avec période, sans timezone)', async () => {
      // Given
      miloClientV1.getSessionsParDossierJeune.resolves(
        success([uneSessionListeJeuneDto])
      )

      // When
      const result = await client.getSessionsParDossierJeune(
        idpToken,
        'dossier',
        { debut: uneDatetime(), fin: uneDatetime() }
      )

      // Then
      expect(isSuccess(result)).to.equal(true)
      if (isSuccess(result))
        expect(result.data).to.deep.equal([uneSessionListeJeuneDto])
    })
  })

  describe('getSessionsParDossierJeunePourConseiller', () => {
    it('renvoie les sessions fraîches', async () => {
      // Given
      miloClientV1.getSessionsParDossierJeunePourConseiller.resolves(
        success([uneSessionListeJeuneDto])
      )

      // When
      const result = await client.getSessionsParDossierJeunePourConseiller(
        idpToken,
        'dossier'
      )

      // Then
      expect(isSuccess(result)).to.equal(true)
      if (isSuccess(result))
        expect(result.data).to.deep.equal([uneSessionListeJeuneDto])
    })
  })
})
