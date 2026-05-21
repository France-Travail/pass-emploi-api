import { Injectable } from '@nestjs/common'
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig
} from 'axios'
import {
  rootLogger,
  serializeBodyForLog,
  isSensitiveKey
} from './logger.module'

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
  /**
   * Crée une instance Axios dédiée, déjà instrumentée pour émettre un log ECS
   * par appel sortant sous le nom `target`. À utiliser via ExternalApiClient.
   */
  createAxios(target: string): AxiosInstance {
    const instance = axios.create()
    attachExternalApiLogger(instance, (level, obj, msg) => {
      rootLogger[level]({ ...obj, context: target }, msg)
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
        undefined,
        response.data
      )
      return response
    },
    (error: AxiosError) => {
      const config = error.config as ConfigWithMetadata | undefined
      logCall(emit, config, error.response?.status, error, error.response?.data)
      return Promise.reject(error)
    }
  )
}

function logCall(
  emit: Emit,
  config: ConfigWithMetadata | undefined,
  statusCode: number | undefined,
  err: AxiosError | undefined,
  responseData: unknown
): void {
  const durationNs = config?.metadata
    ? Number(process.hrtime.bigint() - config.metadata.startTimeNs)
    : undefined

  const { path, domain, search } = parseUrl(config)
  const query = serializeQuery(config, search)
  const isFailure = !!err || (!!statusCode && statusCode >= 400)

  // Bodies request + response : sur échec, toujours ; sur succès, seulement
  // si LOG_LEVEL=debug (inspecter / rejouer un appel partenaire en dev).
  const includeBodies = isFailure || rootLogger.isLevelEnabled('debug')
  const requestBodyContent = includeBodies
    ? serializeBodyForLog(config?.data)
    : undefined
  const responseBodyContent = includeBodies
    ? serializeBodyForLog(responseData)
    : undefined

  const responsePayload =
    statusCode !== undefined || responseBodyContent !== undefined
      ? {
          ...(statusCode !== undefined && { status_code: statusCode }),
          ...(responseBodyContent !== undefined && {
            body: { content: responseBodyContent }
          })
        }
      : undefined

  const obj: Record<string, unknown> = {
    event: {
      action: 'external_api_call',
      outcome: isFailure ? 'failure' : 'success',
      ...(durationNs !== undefined && { duration: durationNs })
    },
    http: {
      request: {
        method: config?.method?.toUpperCase(),
        ...(requestBodyContent !== undefined && {
          body: { content: requestBodyContent }
        })
      },
      ...(responsePayload && { response: responsePayload })
    },
    url: {
      ...(path && { path }),
      ...(domain && { domain }),
      ...(query && { query })
    },
    ...(err && {
      error: {
        type: err.name,
        message: err.message,
        ...(err.stack && { stack_trace: err.stack })
      }
    })
  }

  const isCrash =
    (!!statusCode && statusCode >= 500) || (!!err && statusCode === undefined) // erreur réseau : pas de réponse
  emit(isCrash ? 'error' : 'info', obj, 'external_api_call')
}

function parseUrl(config: ConfigWithMetadata | undefined): {
  path?: string
  domain?: string
  search?: string
} {
  if (!config?.url) return {}
  try {
    const url = new URL(config.url, config.baseURL)
    return { path: url.pathname, domain: url.hostname, search: url.search }
  } catch {
    return { path: config.url }
  }
}

// Reconstruit la query string envoyée au partenaire (ECS url.query), depuis
// la query de l'URL et/ou les `config.params` axios passés séparément.
function serializeQuery(
  config: ConfigWithMetadata | undefined,
  search: string | undefined
): string | undefined {
  const entries: Array<[string, string]> = []

  if (search) {
    new URLSearchParams(search).forEach((value, key) =>
      entries.push([key, value])
    )
  }

  const params = config?.params
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => entries.push([key, value]))
  } else if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      entries.push([key, String(value)])
    }
  }

  if (entries.length === 0) return undefined

  const redacted = new URLSearchParams()
  for (const [key, value] of entries) {
    redacted.append(key, isSensitiveKey(key) ? '[Redacted]' : value)
  }
  return redacted.toString()
}
