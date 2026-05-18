import { ForbiddenException, Logger } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { Authentification } from '../../domain/authentification'
import { getAPMInstance } from '../../infrastructure/monitoring/apm.init'
import { logHandlerExecuted } from '../../utils/logger.module'
import { Query } from './query'
import { failure, isFailure, Result } from './result'

/**
 * Implémente la logique liée à la query envoyée au système.
 *
 * @see https://martinfowler.com/bliki/CommandQuerySeparation.html
 * @see https://udidahan.com/2009/12/09/clarified-cqrs/
 */
export abstract class QueryHandler<Q extends Query | void, R> {
  protected logger: Logger
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

      this.logExecution(startNs, undefined)
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

  private logExecution(
    startNs: bigint,
    failureResult: Result | undefined
  ): void {
    const error =
      failureResult && isFailure(failureResult)
        ? failureResult.error
        : undefined
    logHandlerExecuted({ context: this.queryHandlerName, startNs, error })
  }
}
