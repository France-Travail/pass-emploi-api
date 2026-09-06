import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception'
import { AxiosResponse, isAxiosError } from 'axios'
import { Authentification } from 'src/domain/authentification'
import { Profil } from 'src/domain/profil'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'
import { ConseillerSqlModel } from '../sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../sequelize/models/jeune.sql-model'
import { ExternalApiClient } from './external-api-client'

@Injectable()
export class OidcClient extends ExternalApiClient {
  private logger: Logger
  private issuerUrl: string
  private clientId: string
  private clientSecret: string

  constructor(
    private configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('OidcClient', externalApiLogger)
    this.logger = new Logger('OidcClient')
    this.issuerUrl = this.configService.get('oidc').issuerUrl
    this.clientId = this.configService.get('oidc').clientId
    this.clientSecret = this.configService.get('oidc').clientSecret
  }

  // La structure ne part pas vers connect : elle ne sert qu'au libellé du 401 (savoir quel IdP a expiré côté front)
  async exchangeToken(
    bearer: string,
    structure?: Profil.Structure,
    target?: { sub: string; type: Authentification.Type }
  ): Promise<string> {
    const url = `${this.issuerUrl}/protocol/openid-connect/token`
    const query = new URLSearchParams({
      subject_token: bearer,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      client_id: this.clientId,
      client_secret: this.clientSecret
    })
    if (target) {
      query.append('requested_token_sub', target.sub)
      query.append('requested_sub_type', target.type)
    }
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }

    try {
      const result: TokenExchangeResponse = (
        await this.axios.post(url, query, { headers })
      ).data
      return result.access_token
    } catch (e) {
      let message
      if (e.code === 'ECONNABORTED' || e.status >= '500') {
        message = 'token_exchange_error'
      } else {
        switch (structure) {
          case Profil.Structure.MILO:
            message = 'token_milo_expired'
            break
          case Profil.Structure.FRANCE_TRAVAIL:
          case Profil.Structure.CONSEIL_DEPARTEMENTAL:
            message = 'token_pole_emploi_expired'
            break
          default:
            message = 'token_expired'
        }
      }

      throw new UnauthorizedException({
        statusCode: 401,
        code: 'Unauthorized',
        message
      })
    }
  }

  public async deleteUserByIdUser(idUserCEJ: string): Promise<void> {
    const token = await this.getToken()
    const url = `${this.configService.get('oidc').issuerApiUrl}/users`

    const headers = {
      Authorization: `Bearer ${token}`
    }
    const params = {
      q: `id_user:${idUserCEJ}`
    }

    try {
      const reponseGet: AxiosResponse<UserResponse[]> = await this.axios.get(
        url,
        { params, headers }
      )

      const userIdAuth = reponseGet.data[0]?.id

      if (userIdAuth) {
        await this.axios.delete(`${url}/${userIdAuth}`, { headers })
        this.logger.log(`utilisateur ${idUserCEJ} supprimé`)
      } else {
        this.logger.log(`utilisateur ${idUserCEJ} n'existe pas`)
      }
    } catch (e) {
      if (e.response?.status !== 404) {
        throw new RuntimeException(e)
      }
    }
  }

  public async deleteAccount(idUser: string): Promise<void> {
    const jeune = await JeuneSqlModel.findByPk(idUser)
    let idAuth = jeune?.idAuthentification

    if (!idAuth) {
      const conseiller = await ConseillerSqlModel.findByPk(idUser)
      idAuth = conseiller?.idAuthentification
    }

    if (!idAuth) {
      throw new NotFoundException('User to delete not found')
    }

    await this.supprimerCompteAuth(idAuth, false)
  }

  public async deleteAccountByIdAuth(
    idAuthentification: string
  ): Promise<void> {
    if (!idAuthentification) {
      throw new NotFoundException('User to delete not found')
    }

    await this.supprimerCompteAuth(idAuthentification, true)
  }

  private async supprimerCompteAuth(
    idAuthentification: string,
    tolererNotFound: boolean
  ): Promise<void> {
    const apiKey = this.configService.get('oidc.apiKey')
    const url = `${this.configService.get('oidc').issuerApiUrl}/accounts`
    const headers = {
      'X-API-KEY': apiKey
    }

    try {
      await this.axios.delete(`${url}/${idAuthentification}`, { headers })
    } catch (e) {
      if (tolererNotFound && isAxiosError(e) && e.response?.status === 404) {
        return
      }
      throw e
    }
  }

  private async getToken(): Promise<string> {
    const url = `${this.issuerUrl}/protocol/openid-connect/token`
    const payload = {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    }
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }

    try {
      const result: TokenResponse = (
        await this.axios.post(url, new URLSearchParams(payload), { headers })
      ).data

      return result.access_token
    } catch (e) {
      throw new RuntimeException(e)
    }
  }
}

interface TokenExchangeResponse {
  access_token: string
  expires_in: string
}

interface TokenResponse {
  access_token: string
}

interface UserResponse {
  id: string
}
