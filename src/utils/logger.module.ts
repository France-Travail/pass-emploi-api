import { DynamicModule } from '@nestjs/common'
import { Request } from 'express'
import { IncomingMessage } from 'node:http'
import { LoggerModule } from 'nestjs-pino'
import { ReqId } from 'pino-http'
import { v4 as uuidV4 } from 'uuid'
import {
  buildCustomSuccessObject,
  customErrorObject,
  customLogLevel,
  emitHandlerExecuted
} from './logger.helpers'
import { rootLogger } from './root-logger'

// Re-exports pour préserver l'API publique historique de ce module.
export { rootLogger } from './root-logger'
export {
  buildError,
  isSensitiveKey,
  pinoSerializers,
  serializeBodyForLog,
  toEcsError
} from './logger.helpers'
export type { LogError } from './logger.helpers'

const customSuccessObject = buildCustomSuccessObject(() =>
  rootLogger.isLevelEnabled('debug')
)

export const pinoHttpOptions = {
  logger: rootLogger,
  autoLogging: {
    ignore: (req: IncomingMessage): boolean =>
      req.url?.endsWith('/health') ?? false
  },
  genReqId: (request: Request): ReqId =>
    request.header('X-Request-ID') ?? uuidV4(),
  customLogLevel,
  customSuccessMessage: (): string => 'request_completed',
  customErrorMessage: (): string => 'request_failed',
  customSuccessObject,
  customErrorObject
}

export const configureLoggerModule = (): DynamicModule => {
  return LoggerModule.forRoot({
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    pinoHttp: [pinoHttpOptions]
  })
}

// Wrapper conservant la signature publique historique (handlers CQRS) :
// délègue à emitHandlerExecuted en lui injectant rootLogger.
export function logHandlerExecuted(params: {
  context: string
  startNs: bigint
  error?: unknown
  failed?: boolean
  extra?: Record<string, unknown>
}): void {
  emitHandlerExecuted(rootLogger, params)
}
