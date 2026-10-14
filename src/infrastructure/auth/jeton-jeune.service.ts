import { Injectable } from '@nestjs/common'
import { errors } from 'jose'
import { Authentification } from '../../domain/authentification'
import { estInvite } from '../../domain/profil'
import { JwtService } from './jwt.service'
import { utilisateurDuJeton } from './oidc.auth-guard'

@Injectable()
export class JetonJeuneJwtService implements Authentification.JetonService {
  constructor(private readonly jwtService: JwtService) {}

  // jwtVerify ne contrôle ni iss ni aud : n'importe quel access token de
  // connect passe la signature, d'où le contrôle explicite du profil
  async jeuneDuJeton(
    jeton: string
  ): Promise<Authentification.Utilisateur | undefined> {
    try {
      const jeune = utilisateurDuJeton(
        await this.jwtService.verifyTokenAndGetJwt(jeton)
      )
      const estJeuneConnecte =
        typeof jeune.id === 'string' &&
        jeune.type === Authentification.Type.JEUNE &&
        !estInvite(jeune.profil.structure)
      return estJeuneConnecte ? jeune : undefined
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
