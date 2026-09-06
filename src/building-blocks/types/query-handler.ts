import { ForbiddenException, Logger } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { Authentification } from '../../domain/authentification'
import { ProfilAutorise, verifierProfils } from '../../domain/profil'
import { getAPMInstance } from '../../infrastructure/monitoring/apm.init'
import { logHandlerExecuted } from '../../utils/logger.module'
import { Query } from './query'
import { failure, Failure, isFailure, Result } from './result'

/**
 * Implémente la logique liée à la query envoyée au système.
 *
 * @see https://martinfowler.com/bliki/CommandQuerySeparation.html
 * @see https://udidahan.com/2009/12/09/clarified-cqrs/
 */
export abstract class QueryHandler<Q extends Query | void, R> {
  protected logger: Logger
  // Fermé par défaut sauf pour support et tasks. A surcharger sinon.
  readonly profilsAutorises: ProfilAutorise | readonly ProfilAutorise[] = []
  private queryHandlerName: string
  private apmService: APM.Agent

  constructor(queryHandlerName: string) {
    this.logger = new Logger(queryHandlerName)
    this.queryHandlerName = queryHandlerName
    this.apmService = getAPMInstance()
  }

  async execute(
    query: Q,
    utilisateur?: Authentification.Utilisateur
  ): Promise<R> {
    const startNs = process.hrtime.bigint()
    try {
      const profilsResult = verifierProfils(this.profilsAutorises, utilisateur)
      if (isFailure(profilsResult)) {
        this.logExecution(startNs, profilsResult)
        throw new ForbiddenException(profilsResult.error.message)
      }

      const authorizedResult = await this.authorize(query, utilisateur)
      if (isFailure(authorizedResult)) {
        this.logExecution(startNs, authorizedResult)
        throw new ForbiddenException(authorizedResult.error.message)
      }

      const result = await this.handle(query, utilisateur)

      this.monitor(utilisateur, query, result).catch(error => {
        this.apmService.captureError(error)
        this.logger.error(error)
      })

      this.logExecution(startNs, result)
      return result
    } catch (e) {
      this.logExecution(startNs, failure(e))
      throw e
    }
  }

  abstract handle(
    query: Q,
    utilisateur?: Authentification.Utilisateur
  ): Promise<R>

  abstract authorize(
    query?: Q,
    utilisateur?: Authentification.Utilisateur
  ): Promise<Result>

  abstract monitor(
    utilisateur?: Authentification.Utilisateur,
    query?: Q,
    result?: R
  ): Promise<void>

  // `result` peut être un Result<...> (cas le plus courant) ou un query model
  // brut selon le handler. On détecte la forme Result à l'exécution pour
  // remonter l'échec : sans ça, une query qui retourne `failure()` proprement
  // (sans throw) serait loggée `outcome: success`.
  private logExecution(startNs: bigint, result: unknown): void {
    const estResult =
      !!result && typeof result === 'object' && '_isSuccess' in result
    const error =
      estResult && isFailure(result as Result)
        ? (result as Failure).error
        : undefined
    logHandlerExecuted({ context: this.queryHandlerName, startNs, error })
  }
}
