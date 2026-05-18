import { DynamicModule } from '@nestjs/common'
import { Request } from 'express'
import { IncomingMessage } from 'node:http'
import { LoggerModule } from 'nestjs-pino'
import pino, { Logger as PinoInstance } from 'pino'
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

export const pinoSerializers = {
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
  }),
  // Serializer universel : ne garde que les champs ECS error.*, drop tout le
  // reste (notamment err.config.{headers,data,params}, err.response.data,
  // err.request._currentRequest, err.config.transitional, agent.sockets, etc.
  // d'AxiosError qui polluent ES et fuitent Bearer/api-keys/PII).
  err: (err: Error & { code?: string }): Record<string, unknown> => ({
    type: err.name,
    message: err.message,
    stack_trace: err.stack,
    ...(err.code && { code: err.code })
  })
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Deep merge utilisé comme mixinMergeStrategy pino : sans ça pino fait un
// shallow merge entre mixin et payload du log, ce qui écrase intégralement
// les blocs ECS nested (ex: http.request.id du mixin perdu sur les logs
// external_api_call qui posent http.request.method côté payload).
const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> => {
  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = target[key]
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      target[key] = deepMerge({ ...targetValue }, sourceValue)
    } else {
      target[key] = sourceValue
    }
  }
  return target
}

// Instance pino partagée : utilisée par pino-http ET par le code applicatif
// (handlers CQRS via `rootLogger.info(obj, action)`). Garantit la même config
// (redact, mixin user/trace.id, serializers) sur tous les logs.
const mixinMergeStrategy = (
  mergeObject: Record<string, unknown>,
  mixinObject: Record<string, unknown>
): Record<string, unknown> => deepMerge({ ...mixinObject }, mergeObject)

// `mixinMergeStrategy` est supporté par pino runtime (cf node_modules/pino/lib/proto.js)
// mais absent de @types/pino → cast pour passer TS.
const pinoOptions = {
  level: process.env.LOG_LEVEL || 'info',
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]',
    'err.config.headers.Authorization',
    'err.config.headers.authorization',
    'err.config.headers["X-Gravitee-Api-Key"]',
    'err.config.data',
    'err.config.params',
    'err.response.data'
  ],
  mixin: (): Record<string, unknown> => {
    const apmTraceIds = getAPMInstance().currentTraceIds

    const utilisateur = getContextValue<Authentification.Utilisateur>(
      ContextKey.UTILISATEUR
    )

    const httpRequestId = getContextValue<string>(ContextKey.HTTP_REQUEST_ID)

    const jobRunId =
      getWorkerTrackingServiceInstance().getCurrentJobTracking().jobRunId

    return {
      ...apmTraceIds,
      ...(utilisateur && {
        user: {
          id: utilisateur.id,
          type: utilisateur.type,
          structure: utilisateur.structure
        }
      }),
      ...(httpRequestId && {
        http: { request: { id: httpRequestId } }
      }),
      ...(jobRunId && {
        labels: { job_run_id: jobRunId }
      })
    }
  },
  formatters: {
    level(label: string): object {
      return { level: label }
    }
  },
  serializers: pinoSerializers,
  mixinMergeStrategy
}

export const rootLogger: PinoInstance = pino(
  pinoOptions as unknown as Parameters<typeof pino>[0]
)

export const pinoHttpOptions = {
  logger: rootLogger,
  autoLogging: {
    ignore: (req: IncomingMessage): boolean =>
      req.url?.endsWith('/health') ?? false
  },
  genReqId: (request: Request): ReqId =>
    request.header('X-Request-ID') ?? uuidV4(),
  customLogLevel: (
    _req: IncomingMessage,
    res: { statusCode: number },
    err?: Error
  ): 'info' | 'error' => {
    if (err || !res.statusCode || res.statusCode >= 500) return 'error'
    return 'info'
  },
  customSuccessMessage: (): string => 'request_completed',
  customErrorMessage: (): string => 'request_failed',
  customSuccessObject: (
    _req: IncomingMessage,
    res: { statusCode: number },
    val: Record<string, unknown>
  ): Record<string, unknown> => ({
    ...val,
    event: {
      action: 'request_completed',
      outcome: !res.statusCode || res.statusCode >= 400 ? 'failure' : 'success'
    }
  }),
  customErrorObject: (
    _req: IncomingMessage,
    _res: unknown,
    _err: Error,
    val: Record<string, unknown>
  ): Record<string, unknown> => ({
    ...val,
    event: { action: 'request_failed', outcome: 'failure' }
  })
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

// Conversion d'une erreur vers le format ECS error.{type,message,stack_trace}.
// Gère trois shapes : Error JS (handlers job/exception), DomainError
// (Result.failure code/message), valeur inconnue.
export function toEcsError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      ...(error.stack && { stack_trace: error.stack })
    }
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error
  ) {
    const e = error as { code: unknown; message: unknown }
    return { type: String(e.code), message: String(e.message) }
  }
  return { type: 'Unknown', message: String(error) }
}

// Émet le log `handler_executed` partagé par les 3 base classes CQRS
// (command/query/job). Centralise le format ECS : outcome, level, duration,
// optionnellement error et champs additionnels (ex: labels.job_type).
export function logHandlerExecuted(params: {
  context: string
  startNs: bigint
  error?: unknown
  failed?: boolean
  extra?: Record<string, unknown>
}): void {
  const { context, startNs, error, failed, extra } = params
  const isFailure = error !== undefined || failed === true
  const level: 'info' | 'error' = isFailure ? 'error' : 'info'
  rootLogger[level](
    {
      context,
      event: {
        action: 'handler_executed',
        outcome: isFailure ? 'failure' : 'success',
        duration: Number(process.hrtime.bigint() - startNs)
      },
      ...(extra ?? {}),
      ...(error !== undefined && { error: toEcsError(error) })
    },
    'handler_executed'
  )
}
