import { Context, ContextKey } from 'src/building-blocks/context'
import {
  CacheApiPartenaireDto,
  CacheApiPartenaireSqlModel
} from 'src/infrastructure/sequelize/models/cache-api-partenaire.sql-model'
import { AsSql } from 'src/infrastructure/sequelize/types'
import { CacheApiPartenaireSqlService } from '../../../src/infrastructure/clients/cache-api-partenaire.sql-service.db'
import { initializeAPMAgent } from '../../../src/infrastructure/monitoring/apm.init'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { uneDatetime } from '../../fixtures/date.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../utils/database-for-testing'

initializeAPMAgent()

describe('CacheApiPartenaireSqlService', () => {
  let service: CacheApiPartenaireSqlService
  let context: StubbedClass<Context>
  let databaseForTesting: DatabaseForTesting
  const utilisateur = unUtilisateurJeune({ id: 'harry' })
  const PATH = 'milo/conseiller/structures/1/sessions?debut=&fin='

  const attendre = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms))

  const seedCache = (data: unknown): Promise<CacheApiPartenaireSqlModel> => {
    const dto: AsSql<CacheApiPartenaireDto> = {
      id: 'd90e397a-dcb3-4a7b-8eac-3dec0aa55dfa',
      idUtilisateur: utilisateur.id,
      typeUtilisateur: utilisateur.type,
      date: uneDatetime().toJSDate(),
      pathPartenaire: PATH,
      resultatPartenaire: data,
      transactionId: 'transactionId'
    }
    return CacheApiPartenaireSqlModel.create(dto)
  }

  beforeEach(async () => {
    databaseForTesting = getDatabase()
    await databaseForTesting.cleanPG()
    context = stubClass(Context)
    context.get.withArgs(ContextKey.UTILISATEUR).returns(utilisateur)
    service = new CacheApiPartenaireSqlService(
      databaseForTesting.sequelize,
      context
    )
  })

  const toujoursRecuperable = (): boolean => true

  describe("quand l'appel réussit vite", () => {
    it('renvoie la donnée fraîche et la met en cache', async () => {
      // When
      const resultat = await service.executerAvecCache<string[]>({
        pathPartenaire: PATH,
        appel: async () => ['frais'],
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat).to.deep.include({ type: 'frais', data: ['frais'] })
      // le cache est écrit (fire-and-forget) : on laisse la microtask se résoudre
      await attendre(20)
      const enBase = await CacheApiPartenaireSqlModel.findOne({
        where: { pathPartenaire: PATH }
      })
      expect(enBase?.resultatPartenaire).to.deep.equal(['frais'])
    })
  })

  describe("quand l'appel échoue de façon récupérable", () => {
    it('renvoie le cache existant (stale-if-error)', async () => {
      // Given
      await seedCache(['depuis-cache'])

      // When
      const resultat = await service.executerAvecCache<string[]>({
        pathPartenaire: PATH,
        appel: async () => {
          throw new Error('5xx')
        },
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat.type).to.equal('cache')
      if (resultat.type === 'cache')
        expect(resultat.data).to.deep.equal(['depuis-cache'])
    })

    it("renvoie l'erreur quand il n'y a pas de cache", async () => {
      // When
      const resultat = await service.executerAvecCache<string[]>({
        pathPartenaire: PATH,
        appel: async () => {
          throw new Error('5xx')
        },
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat.type).to.equal('erreur')
    })
  })

  describe("quand l'appel est trop lent", () => {
    it('renvoie le cache sans attendre (stale-if-slow)', async () => {
      // Given
      await seedCache(['depuis-cache'])

      // When
      const avant = Date.now()
      const resultat = await service.executerAvecCache<string[]>({
        pathPartenaire: PATH,
        timeoutMs: 20,
        appel: async () => {
          await attendre(500)
          return ['trop-tard']
        },
        erreurEstRecuperable: toujoursRecuperable
      })
      const duree = Date.now() - avant

      // Then
      expect(resultat.type).to.equal('cache')
      if (resultat.type === 'cache')
        expect(resultat.data).to.deep.equal(['depuis-cache'])
      expect(duree).to.be.lessThan(200)
    })

    it("attend l'appel réel quand le cache est froid", async () => {
      // When
      // path dédié : un appel lent en tâche de fond d'un autre test ne doit pas
      // venir peupler ce cache censé être froid.
      const resultat = await service.executerAvecCache<string[]>({
        pathPartenaire: 'milo/froid/path',
        timeoutMs: 20,
        appel: async () => {
          await attendre(50)
          return ['frais-tardif']
        },
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat).to.deep.include({
        type: 'frais',
        data: ['frais-tardif']
      })
    })
  })

  describe("quand l'erreur n'est pas récupérable", () => {
    it("ne sert pas le cache et renvoie l'erreur", async () => {
      // Given
      await seedCache(['depuis-cache'])
      const erreur = new Error('4xx métier')

      // When
      const resultat = await service.executerAvecCache<string[]>({
        pathPartenaire: PATH,
        appel: async () => {
          throw erreur
        },
        erreurEstRecuperable: () => false
      })

      // Then
      expect(resultat).to.deep.equal({ type: 'erreur', erreur })
    })
  })

  describe('quand il n’y a pas d’utilisateur en contexte', () => {
    it('ne plante pas, ne cache pas, renvoie la donnée fraîche', async () => {
      // Given
      const pathSansUtilisateur = 'milo/sans-utilisateur/path'
      context.get.withArgs(ContextKey.UTILISATEUR).returns(undefined)

      // When
      const resultat = await service.executerAvecCache<string[]>({
        pathPartenaire: pathSansUtilisateur,
        appel: async () => ['frais'],
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat).to.deep.include({ type: 'frais', data: ['frais'] })
      await attendre(20)
      const enBase = await CacheApiPartenaireSqlModel.findOne({
        where: { pathPartenaire: pathSansUtilisateur }
      })
      expect(enBase).to.equal(null)
    })
  })
})
