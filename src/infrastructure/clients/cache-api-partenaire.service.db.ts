import { Inject, Injectable, Logger } from '@nestjs/common'
import { DateTime } from 'luxon'
import { QueryTypes, Sequelize } from 'sequelize'
import { v4 as uuidV4 } from 'uuid'
import { Context, ContextKey } from '../../building-blocks/context'
import { Authentification } from '../../domain/authentification'
import { getAPMInstance } from '../monitoring/apm.init'
import { CacheApiPartenaireSqlModel } from '../sequelize/models/cache-api-partenaire.sql-model'
import { SequelizeInjectionToken } from '../sequelize/providers'

export const TIMEOUT_APPEL_PARTENAIRE_MS = 2000

export enum StatutResultatCache {
  FRAIS = 'frais',
  CACHE = 'cache',
  ERREUR = 'erreur'
}

export type ResultatAppelAvecCache<T> =
  | { type: StatutResultatCache.FRAIS; data: T }
  | { type: StatutResultatCache.CACHE; data: T; date: DateTime }
  | { type: StatutResultatCache.ERREUR; erreur: unknown }

const SENTINELLE_TIMEOUT = Symbol('timeout')

/**
 * Cache de résilience « stale-if-slow / stale-if-error » pour les APIs
 * partenaires (France Travail, Milo), stocké dans `cache_api_partenaire` et
 * indexé par (utilisateur courant, clé de cache).
 *
 * Il ne s'agit PAS d'un cache TTL lecture-d'abord : l'appel partenaire est
 * toujours lancé. Le cache sert de repli quand l'appel est trop lent (au-delà
 * de `timeoutMs`) ou échoue de façon récupérable (5xx/timeout/réseau), ce qui
 * borne la latence perçue tout en gardant la fraîcheur quand le partenaire
 * répond vite.
 */
@Injectable()
export class CacheApiPartenaireService {
  private readonly logger = new Logger('CacheApiPartenaireService')

  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    private readonly context: Context
  ) {}

  async executerAvecCache<T>({
    cleCache,
    appel,
    erreurEstRecuperable,
    timeoutMs = TIMEOUT_APPEL_PARTENAIRE_MS
  }: {
    cleCache: string
    appel: () => Promise<T>
    erreurEstRecuperable: (erreur: unknown) => boolean
    timeoutMs?: number
  }): Promise<ResultatAppelAvecCache<T>> {
    const appelInstrumente: Promise<ResultatAppelAvecCache<T>> = appel()
      .then(data => {
        this.sauvegarder(cleCache, data)
        return { type: StatutResultatCache.FRAIS as const, data }
      })
      .catch(erreur => ({ type: StatutResultatCache.ERREUR as const, erreur }))

    let handleTimeout: NodeJS.Timeout
    const timeout = new Promise<typeof SENTINELLE_TIMEOUT>(resolve => {
      handleTimeout = setTimeout(() => resolve(SENTINELLE_TIMEOUT), timeoutMs)
    })

    try {
      const premier = await Promise.race([appelInstrumente, timeout])

      if (premier !== SENTINELLE_TIMEOUT) {
        return this.resoudre(premier, cleCache, erreurEstRecuperable)
      }

      // Appel trop lent : on sert le dernier cache connu s'il existe
      // L'appel continue en tâche de fond et rafraîchira le cache s'il finit par réussir
      const cache = await this.recuperer<T>(cleCache)
      if (cache)
        return {
          type: StatutResultatCache.CACHE,
          data: cache.data,
          date: cache.date
        }

      // Cache indispo : pas d'autre choix que d'attendre l'appel réel.
      return this.resoudre(
        await appelInstrumente,
        cleCache,
        erreurEstRecuperable
      )
    } finally {
      clearTimeout(handleTimeout!)
    }
  }

  private async resoudre<T>(
    resultat: ResultatAppelAvecCache<T>,
    cleCache: string,
    erreurEstRecuperable: (erreur: unknown) => boolean
  ): Promise<ResultatAppelAvecCache<T>> {
    if (resultat.type !== StatutResultatCache.ERREUR) return resultat
    if (erreurEstRecuperable(resultat.erreur)) {
      const cache = await this.recuperer<T>(cleCache)
      if (cache)
        return {
          type: StatutResultatCache.CACHE,
          data: cache.data,
          date: cache.date
        }
    }
    return resultat
  }

  async sauvegarder(cleCache: string, data: unknown): Promise<void> {
    const utilisateur = this.context.get<Authentification.Utilisateur>(
      ContextKey.UTILISATEUR
    )
    if (!utilisateur) return

    await this.sequelize
      .query(
        `
      INSERT INTO cache_api_partenaire (id, id_utilisateur, type_utilisateur, date, path_partenaire, resultat_partenaire, transaction_id)
      VALUES (:id, :idUtilisateur, :typeUtilisateur, :date, :cleCache, :resultatPartenaire, :transactionId)
      ON CONFLICT (id_utilisateur, path_partenaire)
      DO UPDATE SET date = :date, resultat_partenaire = :resultatPartenaire, transaction_id = :transactionId;
      `,
        {
          replacements: {
            id: uuidV4(),
            idUtilisateur: utilisateur.id,
            typeUtilisateur: utilisateur.type,
            date: new Date(),
            cleCache,
            resultatPartenaire: JSON.stringify(data),
            transactionId:
              getAPMInstance().currentTraceIds['transaction.id'] || null
          },
          type: QueryTypes.INSERT
        }
      )
      .catch(e => {
        getAPMInstance().captureError(e)
        this.logger.error(e)
      })
  }

  async recuperer<T>(
    cleCache: string
  ): Promise<{ data: T; date: DateTime } | null> {
    const utilisateur = this.context.get<Authentification.Utilisateur>(
      ContextKey.UTILISATEUR
    )
    if (!utilisateur) return null

    const cache = await CacheApiPartenaireSqlModel.findOne({
      where: {
        pathPartenaire: cleCache,
        idUtilisateur: utilisateur.id
      },
      order: [['date', 'DESC']]
    })
    if (!cache) return null

    this.logger.log(
      `Utilisation du cache pour ${cleCache} avec l'id ${cache.id}`
    )
    return {
      data: cache.resultatPartenaire as T,
      date: DateTime.fromJSDate(cache.date)
    }
  }
}
