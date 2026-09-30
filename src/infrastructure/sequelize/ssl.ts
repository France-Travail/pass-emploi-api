const SSL_REQUIRED_ENVIRONMENTS = ['staging', 'perf']

export function requiresSsl(environment?: string): boolean {
  return SSL_REQUIRED_ENVIRONMENTS.includes(environment ?? '')
}
