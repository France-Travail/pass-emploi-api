import { Injectable } from '@nestjs/common'
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig
} from 'axios'
import { PinoLogger } from 'nestjs-pino'

interface AxiosMetadata {
  startTimeNs: bigint
}

type ConfigWithMetadata = InternalAxiosRequestConfig & {
  metadata?: AxiosMetadata
}

type Emit = (
  level: 'info' | 'error',
  obj: Record<string, unknown>,
  msg: string
) => void

@Injectable()
export class ExternalApiLoggerService {
  constructor(private readonly pinoLogger: PinoLogger) {}

  /**
   * Crée une instance Axios dédiée, déjà instrumentée pour émettre un log ECS
   * par appel sortant sous le nom `target`. À utiliser via ExternalApiClient.
   */
  createAxios(target: string): AxiosInstance {
    const instance = axios.create()
    attachExternalApiLogger(instance, (level, obj, msg) => {
      this.pinoLogger.logger[level]({ ...obj, context: target }, msg)
    })
    return instance
  }
}

/**
 * Pose des intercepteurs Axios qui émettent un log ECS par appel sortant.
 * Utilisable hors NestJS (instance Axios dédiée, tests) en fournissant son
 * propre `emit`.
 */
export function attachExternalApiLogger(
  instance: AxiosInstance,
  emit: Emit
): void {
  instance.interceptors.request.use((config: ConfigWithMetadata) => {
    config.metadata = { startTimeNs: process.hrtime.bigint() }
    return config
  })

  instance.interceptors.response.use(
    response => {
      logCall(
        emit,
        response.config as ConfigWithMetadata,
        response.status,
        undefined
      )
      return response
    },
    (error: AxiosError) => {
      const config = error.config as ConfigWithMetadata | undefined
      logCall(emit, config, error.response?.status, error)
      return Promise.reject(error)
    }
  )
}

function logCall(
  emit: Emit,
  config: ConfigWithMetadata | undefined,
  statusCode: number | undefined,
  err: AxiosError | undefined
): void {
  const durationNs = config?.metadata
    ? Number(process.hrtime.bigint() - config.metadata.startTimeNs)
    : undefined

  const { path, domain } = parseUrl(config)
  const isFailure = !!err || (!!statusCode && statusCode >= 400)

  const obj: Record<string, unknown> = {
    event: {
      action: 'external_api_call',
      outcome: isFailure ? 'failure' : 'success',
      ...(durationNs !== undefined && { duration: durationNs })
    },
    http: {
      request: { method: config?.method?.toUpperCase() },
      ...(statusCode !== undefined && {
        response: { status_code: statusCode }
      })
    },
    url: {
      ...(path && { path }),
      ...(domain && { domain })
    },
    ...(err && { err })
  }

  emit(isFailure ? 'error' : 'info', obj, 'external_api_call')
}

function parseUrl(config: ConfigWithMetadata | undefined): {
  path?: string
  domain?: string
} {
  if (!config?.url) return {}
  try {
    const url = new URL(config.url, config.baseURL)
    return { path: url.pathname, domain: url.hostname }
  } catch {
    return { path: config.url }
  }
}
