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

interface Auth {
  apiKey: string
  idpToken?: string
}
interface Payload {
  [p: string]: string | undefined
}
interface MiloRequest {
  suffixUrl: string
  auth: Auth
  params?: URLSearchParams
  payload?: Payload | string
  operateur?: string
  contentType?: string
  accept?: string
}

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

  async get<T>({
    suffixUrl,
    auth,
    params,
    contentType,
    accept,
    operateur // todo: supprimer après migration
  }: MiloRequest): Promise<Result<T>> {
    const fullUrl = `${this.apiUrl}/${suffixUrl}`
    const headers = this.generateHeaders({
      auth,
      contentType,
      accept,
      operateur // todo: supprimer après migration
    })

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

  async put<T>({
    suffixUrl,
    auth,
    payload,
    contentType,
    accept,
    operateur // todo: supprimer après migration
  }: MiloRequest): Promise<Result<T>> {
    const fullUrl = `${this.apiUrl}/${suffixUrl}`
    const headers = this.generateHeaders({
      auth,
      payload,
      contentType,
      accept,
      operateur // todo: supprimer après migration
    })

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

  async post<T>({
    suffixUrl,
    auth,
    payload,
    contentType,
    accept,
    operateur // todo: supprimer après migration
  }: MiloRequest): Promise<Result<T>> {
    const fullUrl = `${this.apiUrl}/${suffixUrl}`
    const headers = this.generateHeaders({
      auth,
      payload,
      contentType,
      accept,
      operateur // todo: supprimer après migration
    })
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

  async delete({
    suffixUrl,
    auth,
    contentType,
    accept,
    operateur // todo: supprimer après migration
  }: MiloRequest): Promise<Result> {
    const fullUrl = `${this.apiUrl}/${suffixUrl}`
    const headers = this.generateHeaders({
      auth,
      contentType,
      accept,
      operateur // todo: supprimer après migration
    })

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

  private generateHeaders({
    auth,
    payload,
    contentType,
    accept,
    operateur
  }: {
    auth: Auth
    payload?: Payload | string
    contentType?: string
    accept?: string
    operateur?: string
  }): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Gravitee-Api-Key': auth.apiKey,
      operateur: operateur || OPERATEUR_CEJ
    }

    if (payload !== undefined) {
      headers['Content-Type'] = contentType || 'application/json'
    }

    if (accept) {
      headers.Accept = accept
    }

    if (auth.idpToken) {
      headers.Authorization = `Bearer ${auth.idpToken}`
    }
    return headers
  }
}
