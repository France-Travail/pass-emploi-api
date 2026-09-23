import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AxiosError, AxiosResponse } from 'axios'
import * as APM from 'elastic-apm-node'
import { ErreurMiloHttp } from 'src/building-blocks/types/domain-error'
import {
  Failure,
  failure,
  Result,
  success
} from 'src/building-blocks/types/result'
import { ExternalApiLoggerService } from '../../../utils/external-api-logger.service'
import { ExternalApiClient } from '../external-api-client'
import { getAPMInstance } from '../../monitoring/apm.init'

const OPERATEUR_CEJ = 'APPLICATION_CEJ'

/**
 * Levée quand Milo répond en 2xx avec un corps qui n'est pas du JSON
 * (typiquement une page HTML de WAF/maintenance). Traitée comme une erreur
 * technique : jamais convertie en Result pour ne pas confirmer à tort une
 * écriture ou mapper un corps inexploitable.
 */
export class ErreurMiloReponseInvalide extends Error {
  constructor(
    readonly suffixUrl: string,
    readonly contentType?: string
  ) {
    super(
      `Réponse Milo non JSON sur ${suffixUrl} (content-type: ${
        contentType ?? 'inconnu'
      }) : page WAF/HTML probable`
    )
    this.name = 'ErreurMiloReponseInvalide'
  }
}

function verifierReponseExploitable(
  response: AxiosResponse,
  suffixUrl: string
): void {
  const contentType = response.headers?.['content-type']
  const contentTypeHtml =
    typeof contentType === 'string' &&
    contentType.toLowerCase().includes('text/html')
  const corpsHtml =
    typeof response.data === 'string' &&
    response.data.trimStart().startsWith('<')

  if (contentTypeHtml || corpsHtml) {
    throw new ErreurMiloReponseInvalide(
      suffixUrl,
      typeof contentType === 'string' ? contentType : undefined
    )
  }
}

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
export class MiloClientUtils extends ExternalApiClient {
  private readonly apiUrl: string
  private readonly apmService: APM.Agent

  constructor(
    configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('MiloClient', externalApiLogger)
    this.apmService = getAPMInstance()
    this.apiUrl = configService.get('milo').url
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

    try {
      const response = await this.axios.get<T>(fullUrl, {
        params,
        headers
      })
      verifierReponseExploitable(response, suffixUrl)

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

    try {
      const response = await this.axios.put<T>(fullUrl, payload, {
        headers
      })
      verifierReponseExploitable(response, suffixUrl)

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

    try {
      const response = await this.axios.post<T>(fullUrl, payload, {
        headers
      })
      verifierReponseExploitable(response, suffixUrl)

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

    try {
      const response = await this.axios.delete(fullUrl, { headers })
      verifierReponseExploitable(response, suffixUrl)

      return success(response.data)
    } catch (e) {
      this.apmService.captureError(e)
      return this.handleAxiosError(e, 'Erreur DELETE Milo')
    }
  }

  handleAxiosError(error: AxiosError, message: string): Failure {
    const MIN_STATUS = HttpStatus.BAD_REQUEST
    const MAX_STATUS = HttpStatus.INTERNAL_SERVER_ERROR
    const status = error.response?.status
    if (status !== undefined && status >= MIN_STATUS && status < MAX_STATUS) {
      const data = (error.response?.data ?? {}) as {
        message?: string
        code?: string
        'id-keycloak'?: string
      }
      const erreurHttp = new ErreurMiloHttp(
        data.message ?? message,
        status,
        data.code,
        data['id-keycloak']
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
