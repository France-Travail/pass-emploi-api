import { errors } from 'jose'
import { JetonInviteJwtService } from '../../../src/infrastructure/auth/jeton-invite.service'
import { JwtService } from '../../../src/infrastructure/auth/jwt.service'
import { Profil } from '../../../src/domain/profil'
import { StubbedClass, expect, stubClass } from '../../utils'

describe('JetonInviteJwtService', () => {
  let jwtService: StubbedClass<JwtService>
  let service: JetonInviteJwtService

  const payloadInvite = {
    userId: 'id-invite',
    userProfile: { structure: Profil.Structure.INVITE, dispositif: null }
  }

  beforeEach(() => {
    jwtService = stubClass(JwtService)
    service = new JetonInviteJwtService(jwtService)
  })

  describe('idInviteDuJeton', () => {
    it("retourne l'id du jeune invité quand le jeton est valide", async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.resolves(payloadInvite)

      // When
      const result = await service.idInviteDuJeton('jeton-valide')

      // Then
      expect(result).to.equal('id-invite')
    })

    it("retourne undefined quand le jeton n'est pas celui d'un invité", async () => {
      // Given
      const payloadNonInvite = {
        userId: 'id-jeune',
        userProfile: {
          structure: Profil.Structure.MILO,
          dispositif: Profil.Dispositif.CEJ
        }
      }
      jwtService.verifyTokenAndGetJwt.resolves(payloadNonInvite)

      // When
      const result = await service.idInviteDuJeton('jeton-milo')

      // Then
      expect(result).to.be.undefined()
    })

    it("retourne undefined quand userId n'est pas une string", async () => {
      // Given
      const payloadSansUserId = {
        userId: 12345,
        userProfile: { structure: Profil.Structure.INVITE, dispositif: null }
      }
      jwtService.verifyTokenAndGetJwt.resolves(payloadSansUserId)

      // When
      const result = await service.idInviteDuJeton('jeton-userid-invalide')

      // Then
      expect(result).to.be.undefined()
    })

    it('retourne undefined quand la vérification JWT échoue (signature invalide)', async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.rejects(
        new errors.JWSSignatureVerificationFailed()
      )

      // When
      const result = await service.idInviteDuJeton('jeton-signature-invalide')

      // Then
      expect(result).to.be.undefined()
    })

    it('rejette quand Connect est temporairement injoignable (JWKSTimeout)', async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.rejects(new errors.JWKSTimeout())

      // When
      const promesse = service.idInviteDuJeton('jeton-timeout')

      // Then
      await expect(promesse).to.be.rejectedWith(errors.JWKSTimeout)
    })

    it('rejette quand une erreur réseau générique survient', async () => {
      // Given
      const erreurReseau = new Error('connect injoignable')
      jwtService.verifyTokenAndGetJwt.rejects(erreurReseau)

      // When
      const promesse = service.idInviteDuJeton('jeton-erreur-reseau')

      // Then
      await expect(promesse).to.be.rejectedWith('connect injoignable')
    })
  })
})
