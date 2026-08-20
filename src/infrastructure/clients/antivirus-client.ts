import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AxiosRequestConfig } from 'axios'
import * as https from 'node:https'
import {
  AnalyseAntivirusEchouee,
  AnalyseAntivirusPasTerminee,
  FichierMalveillant
} from 'src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result,
  success
} from 'src/building-blocks/types/result'
import { Fichier } from 'src/domain/fichier'
import { handleAxiosError } from 'src/infrastructure/clients/utils/axios-error-handler'
import { ExternalApiLoggerService } from 'src/utils/external-api-logger.service'
import { ExternalApiClient } from './external-api-client'

// Upload de fichier + scan : plus long que le timeout sortant par défaut (5s),
// mais borné pour ne pas rester bloqué indéfiniment.
const TIMEOUT_ANTIVIRUS_MS = 15000

@Injectable()
export class AntivirusClient extends ExternalApiClient {
  private readonly logger: Logger
  private readonly apiUrl: string
  private readonly requestConfig: AxiosRequestConfig

  constructor(
    configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('AntivirusClient', externalApiLogger, TIMEOUT_ANTIVIRUS_MS)
    this.logger = new Logger('AntivirusClient')

    const config = configService.get('jecliqueoupas')
    this.requestConfig = {
      headers: { 'X-Auth-token': config.token },
      httpsAgent: new https.Agent({
        ca: Buffer.from(config.cert, 'base64'),
        lookup: (_hostname, _opts, callback): void =>
          callback(null, [{ address: config.ip, family: 4 }])
      })
    }
    this.apiUrl = config.url
  }

  async declencherAnalyseAsynchrone(fichier: Fichier): Promise<Result<string>> {
    const body = new FormData()
    body.append('file', new Blob([new Uint8Array(fichier.buffer)]), fichier.nom)

    try {
      const response = await this.axios.post<AnalyseSoumiseDto>(
        this.apiUrl + '/submit',
        body,
        this.requestConfig
      )
      const data = response.data
      const idAnalyse = data.status ? data.uuid || data.id : undefined
      if (idAnalyse) {
        return success(idAnalyse)
      }

      const messageDerreur = data.status ? 'ID Analyse non trouvé' : data.error
      const analyseAntivirusEchouee = new AnalyseAntivirusEchouee(
        messageDerreur
      )
      this.logger.error(analyseAntivirusEchouee)
      return failure(analyseAntivirusEchouee)
    } catch (e) {
      if (e.config) e.config.data = 'REDACTED'
      return handleAxiosError(
        e,
        "L'analyse du fichier par l'antivirus a échoué"
      )
    }
  }

  async recupererResultatAnalyse(idAnalyse: string): Promise<Result> {
    try {
      const response = await this.axios.get<{
        done: boolean
        is_malware: boolean
      }>(this.apiUrl + '/results/' + idAnalyse, this.requestConfig)
      const data = response.data
      if (!data.done) return failure(new AnalyseAntivirusPasTerminee())
      if (!data.is_malware) return emptySuccess()
      return failure(new FichierMalveillant())
    } catch (e) {
      if (e.config) e.config.data = 'REDACTED'
      return handleAxiosError(
        e,
        'La récupération de l’analyse du fichier a échoué'
      )
    }
  }
}

type AnalyseSoumiseDto =
  | { status: true; uuid?: string; id?: string }
  | { status: false; error: string }
