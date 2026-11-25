import { QueryTypes } from 'sequelize'
import { v4 as uuidV4 } from 'uuid'
import { Context, ContextKey } from 'src/building-blocks/context'
import {
  CacheApiPartenaireDto,
  CacheApiPartenaireSqlModel
} from 'src/infrastructure/sequelize/models/cache-api-partenaire.sql-model'
import { AsSql } from 'src/infrastructure/sequelize/types'
import {
  CacheApiPartenaireService,
  StatutResultatCache
} from '../../../src/infrastructure/clients/cache-api-partenaire.service.db'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { uneDatetime } from '../../fixtures/date.fixture'
import { expect, sinon, StubbedClass, stubClass } from '../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../utils/database-for-testing'

describe('CacheApiPartenaireService', () => {
  let service: CacheApiPartenaireService
  let context: StubbedClass<Context>
  let databaseForTesting: DatabaseForTesting
  const utilisateur = unUtilisateurJeune({ id: 'harry' })
  const PATH = 'milo/conseiller/structures/1/sessions?debut=&fin='

  const attendre = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms))

  const seedCache = (
    data: unknown,
    cle: string = PATH
  ): Promise<CacheApiPartenaireSqlModel> => {
    const dto: AsSql<CacheApiPartenaireDto> = {
      id: 'd90e397a-dcb3-4a7b-8eac-3dec0aa55dfa',
      idUtilisateur: utilisateur.id,
      typeUtilisateur: utilisateur.type,
      date: uneDatetime().toJSDate(),
      pathPartenaire: cle,
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
    service = new CacheApiPartenaireService(
      databaseForTesting.sequelize,
      context
    )
  })

  const toujoursRecuperable = (): boolean => true

  describe("quand l'appel réussit vite", () => {
    it('renvoie la donnée fraîche et la met en cache', async () => {
      // Given
      const sauvegarde = sinon.spy(service, 'sauvegarder')

      // When
      const resultat = await service.executerAvecCache<string[]>({
        cleCache: PATH,
        appel: async () => ['frais'],
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat).to.deep.include({
        type: StatutResultatCache.FRAIS,
        data: ['frais']
      })
      await sauvegarde.firstCall.returnValue
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
        cleCache: PATH,
        appel: async () => {
          throw new Error('5xx')
        },
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat.type).to.equal(StatutResultatCache.CACHE)
      if (resultat.type === StatutResultatCache.CACHE)
        expect(resultat.data).to.deep.equal(['depuis-cache'])
    })

    it("renvoie l'erreur quand il n'y a pas de cache", async () => {
      // When
      const resultat = await service.executerAvecCache<string[]>({
        cleCache: PATH,
        appel: async () => {
          throw new Error('5xx')
        },
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat.type).to.equal(StatutResultatCache.ERREUR)
    })
  })

  describe("quand l'appel est trop lent", () => {
    it('renvoie le cache sans attendre (stale-if-slow)', async () => {
      // Given
      // path dédié : l'appel de fond (plus lent que le test) écrit dans le cache
      // APRÈS le cleanPG du test ; un path unique évite que cette écriture
      // tardive ne collisionne avec l'insertion d'un test suivant.
      const cleLente = 'milo/lent/path'
      await seedCache(['depuis-cache'], cleLente)

      // When
      const resultat = await service.executerAvecCache<string[]>({
        cleCache: cleLente,
        timeoutMs: 20,
        appel: async () => {
          await attendre(200)
          return ['trop-tard']
        },
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat.type).to.equal(StatutResultatCache.CACHE)
      if (resultat.type === StatutResultatCache.CACHE)
        expect(resultat.data).to.deep.equal(['depuis-cache'])
    })

    it("attend l'appel réel quand le cache est froid", async () => {
      // When
      // path dédié : un appel lent en tâche de fond d'un autre test ne doit pas
      // venir peupler ce cache censé être froid.
      const resultat = await service.executerAvecCache<string[]>({
        cleCache: 'milo/froid/path',
        timeoutMs: 20,
        appel: async () => {
          await attendre(50)
          return ['frais-tardif']
        },
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat).to.deep.include({
        type: StatutResultatCache.FRAIS,
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
        cleCache: PATH,
        appel: async () => {
          throw erreur
        },
        erreurEstRecuperable: () => false
      })

      // Then
      expect(resultat).to.deep.equal({
        type: StatutResultatCache.ERREUR,
        erreur
      })
    })
  })

  describe('sauvegarder', () => {
    // Des UUID aléatoires restent au-delà de 2 ko une fois compressés : PostgreSQL range alors le JSON hors de la ligne, en TOAST
    const unResultatVolumineux = (): string[] =>
      Array.from({ length: 300 }, () => uuidV4())

    const lireCacheEnBase = async (): Promise<{
      chunkToast: number | null
      date: Date
    }> => {
      const [ligne] = await databaseForTesting.sequelize.query<{
        chunk_toast: number | null
        date: Date
      }>(
        `SELECT pg_column_toast_chunk_id(resultat_partenaire) AS chunk_toast, date
         FROM cache_api_partenaire
         WHERE path_partenaire = :path`,
        { replacements: { path: PATH }, type: QueryTypes.SELECT }
      )
      return { chunkToast: ligne.chunk_toast, date: ligne.date }
    }

    it("ne réécrit pas le résultat quand il n'a pas changé, mais rafraîchit sa date", async () => {
      // Given
      const resultat = unResultatVolumineux()
      await seedCache(resultat)
      const avant = await lireCacheEnBase()

      // When
      await service.sauvegarder(PATH, resultat)

      // Then
      const apres = await lireCacheEnBase()
      expect(avant.chunkToast).not.to.be.null()
      expect(apres.chunkToast).to.equal(avant.chunkToast)
      expect(apres.date.getTime()).to.be.greaterThan(avant.date.getTime())
    })

    it('réécrit le résultat quand il a changé', async () => {
      // Given
      await seedCache(unResultatVolumineux())
      const avant = await lireCacheEnBase()
      const nouveauResultat = unResultatVolumineux()

      // When
      await service.sauvegarder(PATH, nouveauResultat)

      // Then
      const apres = await lireCacheEnBase()
      expect(apres.chunkToast).not.to.equal(avant.chunkToast)
      const enBase = await CacheApiPartenaireSqlModel.findOne({
        where: { pathPartenaire: PATH }
      })
      expect(enBase?.resultatPartenaire).to.deep.equal(nouveauResultat)
    })
  })

  describe('quand il n’y a pas d’utilisateur en contexte', () => {
    it('ne plante pas, ne cache pas, renvoie la donnée fraîche', async () => {
      // Given
      const pathSansUtilisateur = 'milo/sans-utilisateur/path'
      context.get.withArgs(ContextKey.UTILISATEUR).returns(undefined)
      const sauvegarde = sinon.spy(service, 'sauvegarder')

      // When
      const resultat = await service.executerAvecCache<string[]>({
        cleCache: pathSansUtilisateur,
        appel: async () => ['frais'],
        erreurEstRecuperable: toujoursRecuperable
      })

      // Then
      expect(resultat).to.deep.include({
        type: StatutResultatCache.FRAIS,
        data: ['frais']
      })
      await sauvegarde.firstCall.returnValue
      const enBase = await CacheApiPartenaireSqlModel.findOne({
        where: { pathPartenaire: pathSansUtilisateur }
      })
      expect(enBase).to.be.null()
    })
  })
})
