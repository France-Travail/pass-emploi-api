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
    try {
      const headers = this.generateHeaders(auth, undefined, operateur)

      const response = await firstValueFrom(
        this.httpService.get<T>(`${this.apiUrl}/${suffixUrl}`, {
          params,
          headers
        })
      )
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
    try {
      const headers = this.generateHeaders(auth, payload)

      const response = await firstValueFrom(
        this.httpService.put<T>(`${this.apiUrl}/${suffixUrl}`, payload, {
          headers
        })
      )
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
    try {
      const headers = this.generateHeaders(auth, payload)

      const response = await firstValueFrom(
        this.httpService.post<T>(`${this.apiUrl}/${suffixUrl}`, payload, {
          headers
        })
      )
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
    try {
      const headers = this.generateHeaders(auth)

      const response = await firstValueFrom(
        this.httpService.delete(`${this.apiUrl}/${suffixUrl}`, { headers })
      )

      return success(response.data)
    } catch (e) {
      this.apmService.captureError(e)
      this.logger.error(buildError('Erreur DELETE Milo', e))
      return this.handleAxiosError(e, 'Erreur DELETE Milo')
    }
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
