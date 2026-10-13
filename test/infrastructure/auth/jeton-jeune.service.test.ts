import { errors } from 'jose'
import { Authentification } from '../../../src/domain/authentification'
import { Profil } from '../../../src/domain/profil'
import { JetonJeuneJwtService } from '../../../src/infrastructure/auth/jeton-jeune.service'
import { JwtService } from '../../../src/infrastructure/auth/jwt.service'
import { StubbedClass, expect, stubClass } from '../../utils'

describe('JetonJeuneJwtService', () => {
  let jwtService: StubbedClass<JwtService>
  let service: JetonJeuneJwtService

  const payloadJeuneConnecte = {
    userId: 'id-jeune',
    userType: Authentification.Type.JEUNE,
    given_name: 'Kenji',
    family_name: 'Girac',
    email: 'kenji@example.com',
    userProfile: {
      structure: Profil.Structure.MILO,
      dispositif: Profil.Dispositif.CEJ
    },
    userRoles: []
  }

  beforeEach(() => {
    jwtService = stubClass(JwtService)
    service = new JetonJeuneJwtService(jwtService)
  })

  describe('jeuneDuJeton', () => {
    it('retourne le jeune connecté lu dans les claims émis par connect', async () => {
      // Given
      jwtService.verifyTokenAndGetJwt
        .withArgs('jeton-valide')
        .resolves(payloadJeuneConnecte)

      // When
      const jeune = await service.jeuneDuJeton('jeton-valide')

      // Then
      expect(jeune).to.deep.equal({
        id: 'id-jeune',
        type: Authentification.Type.JEUNE,
        prenom: 'Kenji',
        nom: 'Girac',
        email: 'kenji@example.com',
        profil: {
          structure: Profil.Structure.MILO,
          dispositif: Profil.Dispositif.CEJ
        },
        username: undefined,
        roles: []
      })
    })

    it("refuse le jeton d'un invité", async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.resolves({
        ...payloadJeuneConnecte,
        userProfile: { structure: Profil.Structure.INVITE, dispositif: null }
      })

      // When
      const jeune = await service.jeuneDuJeton('jeton-invite')

      // Then
      expect(jeune).to.equal(undefined)
    })

    it("refuse le jeton d'un conseiller", async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.resolves({
        ...payloadJeuneConnecte,
        userType: Authentification.Type.CONSEILLER
      })

      // When
      const jeune = await service.jeuneDuJeton('jeton-conseiller')

      // Then
      expect(jeune).to.equal(undefined)
    })

    it('refuse un jeton sans userId', async () => {
      // Given
      const { userId: _userId, ...sansUserId } = payloadJeuneConnecte
      jwtService.verifyTokenAndGetJwt.resolves(sansUserId)

      // When
      const jeune = await service.jeuneDuJeton('jeton-sans-id')

      // Then
      expect(jeune).to.equal(undefined)
    })

    it('refuse un jeton dont la signature est invalide', async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.rejects(
        new errors.JWSSignatureVerificationFailed()
      )

      // When
      const jeune = await service.jeuneDuJeton('jeton-falsifie')

      // Then
      expect(jeune).to.equal(undefined)
    })

    it('remonte un timeout JWKS au lieu de refuser la preuve', async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.rejects(new errors.JWKSTimeout())

      // When
      const promesse = service.jeuneDuJeton('jeton')

      // Then
      await expect(promesse).to.be.rejectedWith(errors.JWKSTimeout)
    })

    it('remonte une panne de connect au lieu de refuser la preuve', async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.rejects(new Error('connect injoignable'))

      // When
      const promesse = service.jeuneDuJeton('jeton')

      // Then
      await expect(promesse).to.be.rejectedWith('connect injoignable')
    })
  })
})
