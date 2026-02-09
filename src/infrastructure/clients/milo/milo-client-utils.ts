import { HttpService } from '@nestjs/axios'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as APM from 'elastic-apm-node'
import { firstValueFrom } from 'rxjs'
import { ErreurMiloHttp } from 'src/building-blocks/types/domain-error'
import {
  Failure,
  failure,
  Result,
  success
} from 'src/building-blocks/types/result'
import { getAPMInstance } from '../../monitoring/apm.init'
import { AxiosError } from '@nestjs/terminus/dist/errors/axios.error'
import { buildError } from '../../../utils/logger.module'

const OPERATEUR_CEJ = 'APPLICATION_CEJ'

@Injectable()
export class MiloClientUtils {
  private readonly apiUrl: string
  private readonly logger: Logger
  private readonly apmService: APM.Agent

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.logger = new Logger('MiloClientUtils')
    this.apmService = getAPMInstance()
    this.apiUrl = this.configService.get('milo').url
  }

  async get<T>(
    suffixUrl: string,
    auth: {
      apiKey: string
      idpToken?: string
    },
    params?: URLSearchParams,
    operateur?: string // todo: supprimer après migration
  ): Promise<Result<T>> {
    const fullUrl = `${this.apiUrl}/${suffixUrl}`
    const headers = this.generateHeaders(auth, undefined, operateur)

    this.logRequest('GET', fullUrl, headers, params)

    try {
      const response = await firstValueFrom(
        this.httpService.get<T>(fullUrl, {
          params,
          headers
        })
      )

      this.logResponse('GET', fullUrl, response.status, response.data)

      if (!response.data) {
        return failure(new ErreurMiloHttp('Ressource Milo introuvable', 404))
      }
      return success(response?.data)
    } catch (e) {
      this.apmService.captureError(e)
      return this.handleAxiosError(e, 'Erreur GET Milo')
    }
  }

  async put<T>(
    suffixUrl: string,
    payload: { [p: string]: string | undefined } | string,
    auth: {
      apiKey: string
      idpToken?: string
    }
  ): Promise<Result<T>> {
    const fullUrl = `${this.apiUrl}/${suffixUrl}`
    const headers = this.generateHeaders(auth, payload)

    this.logRequest('PUT', fullUrl, headers, undefined, payload)

    try {
      const response = await firstValueFrom(
        this.httpService.put<T>(fullUrl, payload, {
          headers
        })
      )

      this.logResponse('PUT', fullUrl, response.status, response.data)

      return success(response?.data)
    } catch (e) {
      this.apmService.captureError(e)
      return this.handleAxiosError(e, 'Erreur PUT Milo')
    }
  }

  async post<T>(
    suffixUrl: string,
    payload: { [p: string]: string | undefined } | string,
    auth: {
      apiKey: string
      idpToken?: string
    }
  ): Promise<Result<T>> {
    const fullUrl = `${this.apiUrl}/${suffixUrl}`
    const headers = this.generateHeaders(auth, payload)

    this.logRequest('POST', fullUrl, headers, undefined, payload)

    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(fullUrl, payload, {
          headers
        })
      )

      this.logResponse('POST', fullUrl, response.status, response.data)

      return success(response?.data)
    } catch (e) {
      this.apmService.captureError(e)
      return this.handleAxiosError(e, 'Erreur POST Milo')
    }
  }

  async delete(
    suffixUrl: string,
    auth: {
      apiKey: string
      idpToken?: string
    }
  ): Promise<Result> {
    const fullUrl = `${this.apiUrl}/${suffixUrl}`
    const headers = this.generateHeaders(auth)

    this.logRequest('DELETE', fullUrl, headers)

    try {
      const response = await firstValueFrom(
        this.httpService.delete(fullUrl, { headers })
      )

      this.logResponse('DELETE', fullUrl, response.status, response.data)

      return success(response.data)
    } catch (e) {
      this.apmService.captureError(e)
      return this.handleAxiosError(e, 'Erreur DELETE Milo')
    }
  }

  private logRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    params?: URLSearchParams,
    body?: unknown
  ): void {
    const logData: Record<string, unknown> = {
      method,
      url,
      headers
    }

    if (params) {
      logData.queryParams = params.toString()
    }

    if (body !== undefined) {
      logData.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    this.logger.debug(`Requête API Milo: ${JSON.stringify(logData)}`)
  }

  private logResponse(
    method: string,
    url: string,
    status: number,
    data: unknown
  ): void {
    const responsePreview =
      typeof data === 'string'
        ? data.substring(0, 500)
        : JSON.stringify(data).substring(0, 500)

    this.logger.debug(
      `Réponse API Milo: ${JSON.stringify({
        method,
        url,
        status,
        responsePreview:
          responsePreview + (responsePreview.length === 500 ? '...' : '')
      })}`
    )
  }

  handleAxiosError(error: AxiosError, message: string): Failure {
    this.logger.error(buildError(message, error))

    const MIN_STATUS = HttpStatus.BAD_REQUEST
    const MAX_STATUS = HttpStatus.INTERNAL_SERVER_ERROR
    if (
      error.response?.status >= MIN_STATUS &&
      error.response?.status < MAX_STATUS
    ) {
      const erreurHttp = new ErreurMiloHttp(
        error.response?.data?.message ?? message,
        error.response?.status,
        error.response?.data.code,
        error.response?.data['id-keycloak']
      )
      return failure(erreurHttp)
    }
    throw error
  }

  private generateHeaders(
    auth: { apiKey: string; idpToken?: string },
    payload?:
      | {
          [p: string]: string | undefined
        }
      | string,
    operateur?: string
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Gravitee-Api-Key': auth.apiKey,
      operateur: operateur || OPERATEUR_CEJ
    }
    if (payload) {
      headers['Content-Type'] =
        typeof payload === 'string' ? 'text/plain' : 'application/json'
    }
    if (auth.idpToken) {
      headers.Authorization = `Bearer ${auth.idpToken}`
    }
    return headers
  }
}
