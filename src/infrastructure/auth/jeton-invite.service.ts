import { Injectable } from '@nestjs/common'
import { errors } from 'jose'
import { JeuneInvite } from '../../domain/jeune/jeune-invite'
import { estInvite } from '../../domain/profil'
import { JwtService } from './jwt.service'
import { profilDuClaim } from './oidc.auth-guard'

@Injectable()
export class JetonInviteJwtService implements JeuneInvite.JetonService {
  constructor(private readonly jwtService: JwtService) {}

  // jwtVerify ne contrôle ni iss ni aud : n'importe quel access token de
  // connect passe la signature, d'où le contrôle explicite du profil invité
  async idInviteDuJeton(jeton: string): Promise<string | undefined> {
    try {
      const payload = await this.jwtService.verifyTokenAndGetJwt(jeton)
      if (!estInvite(profilDuClaim(payload).structure)) return undefined
      return typeof payload.userId === 'string' ? payload.userId : undefined
    } catch (e) {
      // Seul un jeton refusé est une preuve invalide (400) ; une panne de
      // Connect/JWKS doit remonter en 500 pour que l'app réessaie
      if (e instanceof errors.JOSEError && !(e instanceof errors.JWKSTimeout)) {
        return undefined
      }
      throw e
    }
  }
}
