import pino, { Logger as PinoInstance } from 'pino'
import { ContextKey, getContextValue } from '../building-blocks/context'
import { Authentification } from '../domain/authentification'
import { getAPMInstance } from '../infrastructure/monitoring/apm.init'
import { getWorkerTrackingServiceInstance } from '../infrastructure/monitoring/worker.tracking.service'
import { mixinMergeStrategy, pinoSerializers } from './logger.helpers'

// Instance pino partagée : utilisée par pino-http ET par le code applicatif
// (handlers CQRS via `rootLogger.info(obj, action)`). Garantit la même config
// (redact, mixin user/trace.id, serializers) sur tous les logs.

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
