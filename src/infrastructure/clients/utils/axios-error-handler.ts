import { AxiosError } from 'axios'
import { ErreurHttp } from '../../../building-blocks/types/domain-error'
import { failure, Failure } from '../../../building-blocks/types/result'

export function handleAxiosError(
  error: AxiosError,
  message: string,
  throwErrorStatusCode?: number
): Failure {
  const MIN_STATUS = 400
  const MAX_STATUS = throwErrorStatusCode ?? 500
  const status = error.response?.status
  if (status !== undefined && status >= MIN_STATUS && status < MAX_STATUS) {
    const data = error.response?.data as { message?: string } | undefined
    const erreurHttp = new ErreurHttp(data?.message ?? message, status)
    return failure(erreurHttp)
  }
  throw error
}
