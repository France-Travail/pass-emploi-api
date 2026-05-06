import { DynamicModule } from '@nestjs/common'
import { Request } from 'express'
import { IncomingMessage } from 'node:http'
import { LoggerModule } from 'nestjs-pino'
import { ReqId } from 'pino-http'
import { v4 as uuidV4 } from 'uuid'
import { ContextKey, getContextValue } from '../building-blocks/context'
import { Authentification } from '../domain/authentification'
import { getAPMInstance } from '../infrastructure/monitoring/apm.init'
import { getWorkerTrackingServiceInstance } from '../infrastructure/monitoring/worker.tracking.service'

const REQ_HEADERS_WHITELIST = [
  'user-agent',
  'x-real-ip',
  'x-platform',
  'x-appversion',
  'x-installationid',
  'x-correlationid'
]

const pickHeaders = (
  headers: Record<string, string | string[] | undefined>,
  whitelist: string[]
): Record<string, string | string[]> =>
  Object.fromEntries(
    whitelist
      .map(key => [key, headers[key]] as const)
      .filter(
        (entry): entry is readonly [string, string | string[]] =>
          entry[1] !== undefined
      )
  )

export const pinoHttpOptions = {
  level: process.env.LOG_LEVEL || 'info',
  autoLogging: {
    ignore: (req: IncomingMessage): boolean =>
      req.url?.endsWith('/health') ?? false
  },
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]',
    'err.config.headers["X-Gravitee-Api-Key"]'
  ],
  mixin: (): Record<string, unknown> => {
    const apmTraceIds = getAPMInstance().currentTraceIds
    const currentTraceIds =
      Object.keys(apmTraceIds).length > 0
        ? apmTraceIds
        : (getWorkerTrackingServiceInstance().getCurrentJobTracking()
            ?.currentTraceIds ?? {})

    const utilisateur = getContextValue<Authentification.Utilisateur>(
      ContextKey.UTILISATEUR
    )

    return {
      ...currentTraceIds,
      ...(utilisateur && {
        user: {
          id: utilisateur.id,
          type: utilisateur.type,
          structure: utilisateur.structure
        }
      })
    }
  },
  formatters: {
    level(label: string): object {
      return { level: label }
    }
  },
  genReqId: (request: Request): ReqId =>
    request.header('X-Request-ID') ?? uuidV4(),
  customLogLevel: (
    _req: IncomingMessage,
    res: { statusCode: number },
    err?: Error
  ): 'info' | 'warn' | 'error' => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  customSuccessMessage: (): string => 'request_completed',
  customErrorMessage: (): string => 'request_failed',
  customSuccessObject: (
    _req: IncomingMessage,
    _res: unknown,
    val: Record<string, unknown>
  ): Record<string, unknown> => ({
    ...val,
    event: { action: 'request_completed', outcome: 'success' }
  }),
  customErrorObject: (
    _req: IncomingMessage,
    _res: unknown,
    _err: Error,
    val: Record<string, unknown>
  ): Record<string, unknown> => ({
    ...val,
    event: { action: 'request_failed', outcome: 'failure' }
  }),
  serializers: {
    req: (req: {
      id: string
      method: string
      url: string
      query: Record<string, unknown>
      headers: Record<string, string | string[] | undefined>
    }): Record<string, unknown> => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      headers: pickHeaders(req.headers, REQ_HEADERS_WHITELIST)
    }),
    res: (res: { statusCode: number }): { statusCode: number } => ({
      statusCode: res.statusCode
    })
  }
}

export const configureLoggerModule = (): DynamicModule => {
  return LoggerModule.forRoot({
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    pinoHttp: [pinoHttpOptions]
  })
}

export interface LogError {
  message: string
  err: Error
}

export function buildError(message: string, error: Error): LogError {
  return {
    message,
    err: error
  }
}
