import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JsonWebTokenError, JwtService as NestJwtService } from '@nestjs/jwt'
import * as JwksClient from 'jwks-rsa'
import { Issuer } from 'openid-client'

export interface IJwtService {
  verifyTokenAndGetJwt(token: string): Promise<JWTPayload>
}

@Injectable()
export class JwtService implements IJwtService {
  private cacheJWKS: string | undefined

  constructor(
    private configService: ConfigService,
    private readonly nestJwtService: NestJwtService
  ) {}

  async verifyTokenAndGetJwt(token: string): Promise<JWTPayload> {
    try {
      return await this.verifyTokenAndGetJwtWithoutRetry(token)
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        this.cacheJWKS = undefined
        return this.verifyTokenAndGetJwtWithoutRetry(token)
      }
      throw error
    }
  }

  private async verifyTokenAndGetJwtWithoutRetry(
    token: string
  ): Promise<JWTPayload> {
    const JWKS = await this.getJWKS()

    return this.nestJwtService.verifyAsync(token, {
      algorithms: ['RS256'],
      // On peut rajouter une vérification d'audience pour renforcer la sécurité
      // audience: 'https://api.pass-emploi.beta.gouv.fr',
      publicKey: JWKS,
      issuer: this.configService.get('oidc.issuerUrl')!
    })
  }

  private async getJWKS(): Promise<string> {
    // Cette variable n'est plus nécessaire étant donné que JwksClient porte la logique de cache
    if (!this.cacheJWKS) {
      const issuer = await Issuer.discover(
        this.configService.get('oidc.issuerUrl')!
      )

      const jwksClient = JwksClient({
        jwksUri: issuer.metadata.jwks_uri!,
        cache: true,
        cacheMaxEntries: 2,
        cacheMaxAge: 600000, // 10m
        timeout: 3000 // 3s
      })

      const key = await jwksClient.getSigningKey()

      this.cacheJWKS = key.getPublicKey()
    }
    return this.cacheJWKS
  }
}

interface JWTPayload {
  iss?: string
  sub?: string
  aud?: string | string[]
  jti?: string
  nbf?: number
  exp?: number
  iat?: number

  [p: string]: unknown
}
