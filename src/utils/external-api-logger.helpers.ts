import {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  InternalAxiosRequestConfig
} from 'axios'
import {
  isPlainObject,
  isSensitiveKey,
  serializeBodyForLog
} from './logger.helpers'

interface AxiosMetadata {
  startTimeNs: bigint
}

type ConfigWithMetadata = InternalAxiosRequestConfig & {
  metadata?: AxiosMetadata
}

export type Emit = (
  level: 'info' | 'error',
  obj: Record<string, unknown>,
  msg: string
) => void

/**
 * Pose des intercepteurs Axios qui émettent un log ECS par appel sortant.
 * Utilisable hors NestJS (instance Axios dédiée, tests) en fournissant son
 * propre `emit` et un prédicat `isDebugEnabled` (utilisé pour décider
 * d'inclure les bodies sur succès).
 */
export function attachExternalApiLogger(
  instance: AxiosInstance,
  emit: Emit,
  isDebugEnabled: () => boolean
): void {
  instance.interceptors.request.use((config: ConfigWithMetadata) => {
    config.metadata = { startTimeNs: process.hrtime.bigint() }
    return config
  })

  instance.interceptors.response.use(
    response => {
      logCall(
        emit,
        isDebugEnabled,
        response.config,
        response.status,
        undefined,
        response.data
      )
      return response
    },
    (error: AxiosError) => {
      logCall(
        emit,
        isDebugEnabled,
        error.config,
        error.response?.status,
        error,
        error.response?.data
      )
      return Promise.reject(error)
    }
  )
}

const buildResponsePayload = (
  statusCode: number | undefined,
  responseBodyContent: string | undefined
): Record<string, unknown> | undefined => {
  if (statusCode === undefined && responseBodyContent === undefined) {
    return undefined
  }
  return {
    ...(statusCode !== undefined && { status_code: statusCode }),
    ...(responseBodyContent !== undefined && {
      body: { content: responseBodyContent }
    })
  }
}

const buildErrorFragment = (
  err: AxiosError | undefined
): Record<string, unknown> | undefined => {
  if (!err) return undefined
  return {
    error: {
      type: err.name,
      message: err.message,
      ...(err.code && { code: err.code }),
      ...(err.stack && { stack_trace: err.stack })
    }
  }
}

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

const asIsoDate = (secondes: unknown): string | undefined =>
  typeof secondes === 'number'
    ? new Date(secondes * 1000).toISOString()
    : undefined

// Seuls quelques claims sont extraits : sans signature, rien de rejouable.
// Ne doit jamais lever, sinon l'intercepteur transformerait l'appel en échec.
function buildJwtFragment(
  config: ConfigWithMetadata | undefined
): Record<string, unknown> | undefined {
  try {
    const authorization = AxiosHeaders.from(config?.headers).get(
      'authorization'
    )
    if (typeof authorization !== 'string') return undefined

    const [scheme, token] = authorization.split(' ')
    const parts = token?.split('.') ?? []
    if (scheme.toLowerCase() !== 'bearer' || parts.length !== 3) {
      return undefined
    }

    const claims: unknown = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    )
    if (!isPlainObject(claims)) return undefined

    const { iss, azp, exp, iat, preferred_username } = claims
    return {
      jwt: {
        iss: asString(iss),
        azp: asString(azp),
        exp: asIsoDate(exp),
        iat: asIsoDate(iat),
        has_preferred_username: asString(preferred_username) !== undefined
      }
    }
  } catch {
    return undefined
  }
}

export function logCall(
  emit: Emit,
  isDebugEnabled: () => boolean,
  config: ConfigWithMetadata | undefined,
  statusCode: number | undefined,
  err: AxiosError | undefined,
  responseData: unknown
): void {
  const isFailure = !!err || (!!statusCode && statusCode >= 400)
  // Bodies request + response : sur échec, toujours ; sur succès, seulement
  // si LOG_LEVEL=debug (inspecter / rejouer un appel partenaire en dev).
  const includeBodies = isFailure || isDebugEnabled()
  const requestBodyContent = includeBodies
    ? serializeBodyForLog(config?.data)
    : undefined
  const responseBodyContent = includeBodies
    ? serializeBodyForLog(responseData)
    : undefined

  const { path, domain, search } = parseUrl(config)
  const query = serializeQuery(config, search)
  const responsePayload = buildResponsePayload(statusCode, responseBodyContent)
  const durationNs = config?.metadata
    ? Number(process.hrtime.bigint() - config.metadata.startTimeNs)
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
    ...buildErrorFragment(err),
    ...(isFailure && buildJwtFragment(config))
  }

  // panne de transport : axios rejette alors que le status n'est pas un refus
  // HTTP volontaire (≥400). Ex. body tronqué après des headers 200 (aborted,
  // décompression Brotli interrompue), ECONNRESET sans status.
  const isTransportError =
    !!err && (statusCode === undefined || statusCode < 400)
  // log error = panne à surveiller : 5xx serveur ou panne de transport. Les 4xx
  // (401/404/408…) restent en info : refus/timeout HTTP attendus.
  const isCrash = (!!statusCode && statusCode >= 500) || isTransportError
  emit(isCrash ? 'error' : 'info', obj, 'external_api_call')
}

export function parseUrl(config: ConfigWithMetadata | undefined): {
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
export function serializeQuery(
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
