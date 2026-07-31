import { Logger } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { Authentification } from '../../domain/authentification'
import { getAPMInstance } from '../../infrastructure/monitoring/apm.init'
import { logHandlerExecuted } from '../../utils/logger.module'
import { failure, isFailure, isSuccess, Result } from './result'

/**
 * Implémente la logique nécessaire à la réalisation de la commande envoyée au système.
 *
 * @see https://martinfowler.com/bliki/CommandQuerySeparation.html
 * @see https://udidahan.com/2009/12/09/clarified-cqrs/
 */
export abstract class CommandHandler<Command, Data, Aggregat = void> {
  protected logger: Logger
  protected apmService: APM.Agent
  private commandName: string

  constructor(commandName: string) {
    this.commandName = commandName
    this.logger = new Logger(commandName)
    this.apmService = getAPMInstance()
  }

  async execute(
    command?: Command,
    utilisateur?: Authentification.Utilisateur
  ): Promise<Result<Data>> {
    const startNs = process.hrtime.bigint()
    try {
      const aggregate = await this.getAggregate(command, utilisateur)

      const authorizerResult = await this.authorize(
        command,
        utilisateur,
        aggregate
      )
      if (isFailure(authorizerResult)) {
        this.logExecution(startNs, authorizerResult, command)
        return authorizerResult
      }

      const result = await this.handle(command, utilisateur, aggregate)

      if (isSuccess(result)) {
        this.monitor(utilisateur, command, aggregate).catch(error => {
          this.apmService.captureError(error)
          this.logger.error(error)
        })
      }
      this.logExecution(startNs, result, command)

      return result
    } catch (e) {
      this.logExecution(startNs, failure(e), command)
      throw e
    }
  }

  // FIXME return Result
  async getAggregate(
    _command?: Command,
    _utilisateur?: Authentification.Utilisateur
  ): Promise<Aggregat | undefined> {
    return undefined
  }

  abstract authorize(
    command?: Command,
    utilisateur?: Authentification.Utilisateur,
    aggregate?: Aggregat
  ): Promise<Result>

  abstract handle(
    command?: Command,
    utilisateur?: Authentification.Utilisateur,
    aggregate?: Aggregat
  ): Promise<Result<Data>>

  abstract monitor(
    utilisateur?: Authentification.Utilisateur,
    command?: Command,
    aggregate?: Aggregat
  ): Promise<void>

  // Labels ECS additionnels portés par `handler_executed`. Aucun par défaut :
  // un handler les surcharge quand il a des dimensions d'exécution à tracer.
  // Appelé aussi sur le chemin d'erreur : doit rester une lecture de champs.
  protected labelsDuLog(
    _result: Result<Data>,
    _command?: Command
  ): Record<string, string | string[]> | undefined {
    return undefined
  }

  private logExecution(
    startNs: bigint,
    result: Result<Data>,
    command?: Command
  ): void {
    const error = isFailure(result) ? result.error : undefined
    const labels = this.labelsDuLog(result, command)
    logHandlerExecuted({
      context: this.commandName,
      startNs,
      error,
      ...(labels && { extra: { labels } })
    })
  }
}
