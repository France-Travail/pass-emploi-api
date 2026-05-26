import { IncomingMessage } from 'node:http'

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

export const isPlainObject = (
  value: unknown
): value is Record<string, unknown> =>
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

export const mixinMergeStrategy = (
  mergeObject: Record<string, unknown>,
  mixinObject: Record<string, unknown>
): Record<string, unknown> => deepMerge({ ...mixinObject }, mergeObject)

// Une clé est sensible si son nom (insensible à la casse) contient un de ces
// fragments : couvre toutes les variantes sans les énumérer (subject_token,
// access_token, client_secret...). Volontairement pas `code`/`key` : ils
// collisionnent avec des champs métier (code d'une démarche...).
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'pwd',
  'token',
  'secret',
  'authorization',
  'bearer',
  'api_key',
  'apikey',
  'credential'
]

export const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some(pattern => lower.includes(pattern))
}

const BODY_MAX_LENGTH = 4096

const truncateBody = (str: string): string =>
  str.length > BODY_MAX_LENGTH
    ? str.slice(0, BODY_MAX_LENGTH) + '...[truncated]'
    : str

// Masque récursivement les valeurs des clés sensibles (secrets/credentials).
// La PII "ordinaire" n'est pas masquable par clé : assumée, d'où le logging
// sur échec uniquement.
const redactDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactDeep)
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? '[Redacted]' : redactDeep(val)
    }
    return out
  }
  return value
}

// Sérialise un body de requête pour le log : JSON, form-urlencoded ou
// URLSearchParams, clés sensibles masquées, tronqué. undefined si vide.
export const serializeBodyForLog = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined
  if (Buffer.isBuffer(value)) return '[binary]'
  if (
    typeof value === 'object' &&
    typeof (value as { pipe?: unknown }).pipe === 'function'
  ) {
    return '[stream]'
  }

  if (value instanceof URLSearchParams) {
    const redacted = new URLSearchParams()
    let empty = true
    value.forEach((v, k) => {
      empty = false
      redacted.append(k, isSensitiveKey(k) ? '[Redacted]' : v)
    })
    return empty ? undefined : truncateBody(redacted.toString())
  }

  if (typeof value === 'string') {
    if (value.length === 0) return undefined
    try {
      return serializeBodyForLog(JSON.parse(value))
    } catch {
      if (/^[\w.%+-]+=[^&\s]*(&[\w.%+-]+=[^&\s]*)*$/.test(value)) {
        return serializeBodyForLog(new URLSearchParams(value))
      }
      return truncateBody(value)
    }
  }

  if (Array.isArray(value) || isPlainObject(value)) {
    const isEmpty = Array.isArray(value)
      ? value.length === 0
      : Object.keys(value).length === 0
    if (isEmpty) return undefined
    try {
      return truncateBody(JSON.stringify(redactDeep(value)))
    } catch {
      return undefined
    }
  }

  return truncateBody(String(value))
}

// Fragment ECS http.request.body.content, vide si pas de body.
export const requestBodyFragment = (
  req: IncomingMessage
): Record<string, unknown> => {
  const content = serializeBodyForLog((req as { body?: unknown }).body)
  return content ? { http: { request: { body: { content } } } } : {}
}

export const customLogLevel = (
  _req: IncomingMessage,
  res: { statusCode: number },
  err?: Error
): 'info' | 'error' => {
  if (err || !res.statusCode || res.statusCode >= 500) return 'error'
  return 'info'
}

export const buildCustomSuccessObject =
  (isDebugEnabled: () => boolean) =>
  (
    req: IncomingMessage,
    res: { statusCode: number },
    val: Record<string, unknown>
  ): Record<string, unknown> => {
    const outcome =
      !res.statusCode || res.statusCode >= 400 ? 'failure' : 'success'
    const log = { ...val, event: { action: 'request_completed', outcome } }
    // body sur échec (4xx inclus) ; sur succès seulement si LOG_LEVEL=debug
    const includeBody = outcome === 'failure' || isDebugEnabled()
    return includeBody ? { ...log, ...requestBodyFragment(req) } : log
  }

export const customErrorObject = (
  req: IncomingMessage,
  _res: unknown,
  _err: Error,
  val: Record<string, unknown>
): Record<string, unknown> => ({
  ...val,
  event: { action: 'request_failed', outcome: 'failure' },
  ...requestBodyFragment(req)
})

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

interface MinimalLogger {
  info: (obj: Record<string, unknown>, msg: string) => void
  error: (obj: Record<string, unknown>, msg: string) => void
}

// Émet le log `handler_executed` partagé par les 3 base classes CQRS
// (command/query/job). Centralise le format ECS : outcome, level, duration,
// optionnellement error et champs additionnels (ex: labels.job_type).
export function emitHandlerExecuted(
  logger: MinimalLogger,
  params: {
    context: string
    startNs: bigint
    error?: unknown
    failed?: boolean
    extra?: Record<string, unknown>
  }
): void {
  const { context, startNs, error, failed, extra } = params
  const isFailure = error !== undefined || failed === true
  const level: 'info' | 'error' = error instanceof Error ? 'error' : 'info'
  logger[level](
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
