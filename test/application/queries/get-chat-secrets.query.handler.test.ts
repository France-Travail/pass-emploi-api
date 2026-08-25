import { ForbiddenException } from '@nestjs/common'
import { SinonSandbox } from 'sinon'
import {
  GetChatSecretsQuery,
  GetChatSecretsQueryHandler
} from 'src/application/queries/get-chat-secrets.query.handler'
import { Authentification } from 'src/domain/authentification'
import { TOUT_CONSEIL_DEPARTEMENTAL, Profil } from 'src/domain/profil'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune
} from 'test/fixtures/authentification.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { FirebaseClient } from '../../../src/infrastructure/clients/firebase-client'
import { testConfig } from '../../utils/module-for-testing'
import { unProfilInvite, unProfilMilo } from '../../fixtures/profil.fixture'

describe('GetChatSecretsQueryHandler', () => {
  let firebaseClient: StubbedClass<FirebaseClient>
  let getChatSecretsQueryHandler: GetChatSecretsQueryHandler
  let sandbox: SinonSandbox

  before(() => {
    sandbox = createSandbox()
    firebaseClient = stubClass(FirebaseClient)

    getChatSecretsQueryHandler = new GetChatSecretsQueryHandler(
      firebaseClient,
      testConfig()
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    it('retourne les secrets du chat', async () => {
      // Given
      const utilisateur: Authentification.Utilisateur =
        unUtilisateurConseiller()
      const getChatSecretsQuery: GetChatSecretsQuery = {
        utilisateur
      }

      firebaseClient.getToken.withArgs(utilisateur).resolves('un-token')

      // When
      const actual =
        await getChatSecretsQueryHandler.handle(getChatSecretsQuery)

      // Then
      expect(actual).to.deep.equal({
        cle: 'firebase-encryption-key',
        token: 'un-token'
      })
    })
  })

  describe('execute', () => {
    let firebaseClientLocal: StubbedClass<FirebaseClient>
    let handlerLocal: GetChatSecretsQueryHandler

    beforeEach(() => {
      firebaseClientLocal = stubClass(FirebaseClient)
      handlerLocal = new GetChatSecretsQueryHandler(
        firebaseClientLocal,
        testConfig()
      )
    })

    it('rejette un invité sans appeler firebase', async () => {
      // Given
      const utilisateur = unUtilisateurJeune({
        profil: unProfilInvite()
      })
      const query: GetChatSecretsQuery = { utilisateur }

      // When
      const promise = handlerLocal.execute(query, utilisateur)

      // Then
      await expect(promise).to.be.rejectedWith(ForbiddenException)
      expect(firebaseClientLocal.getToken).not.to.have.been.called()
    })

    it('autorise un bénéficiaire MiLo', async () => {
      // Given
      const utilisateur = unUtilisateurJeune({
        profil: unProfilMilo()
      })
      const query: GetChatSecretsQuery = { utilisateur }
      firebaseClientLocal.getToken.withArgs(utilisateur).resolves('un-token')

      // When
      const actual = await handlerLocal.execute(query, utilisateur)

      // Then
      expect(actual).to.deep.equal({
        cle: 'firebase-encryption-key',
        token: 'un-token'
      })
    })

    it('autorise un conseiller', async () => {
      // Given
      const utilisateur = unUtilisateurConseiller()
      const query: GetChatSecretsQuery = { utilisateur }
      firebaseClientLocal.getToken.withArgs(utilisateur).resolves('un-token')

      // When
      const actual = await handlerLocal.execute(query, utilisateur)

      // Then
      expect(actual).to.deep.equal({
        cle: 'firebase-encryption-key',
        token: 'un-token'
      })
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(getChatSecretsQueryHandler.profilsAutorises).to.deep.equal([
        { structure: Profil.Structure.MILO },
        {
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositifs: [
            Profil.Dispositif.CEJ,
            Profil.Dispositif.BRSA,
            Profil.Dispositif.AIJ,
            Profil.Dispositif.AVENIR_PRO,
            Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
            Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
            Profil.Dispositif.EQUIP_EMPLOI_RECRUT
          ]
        },
        TOUT_CONSEIL_DEPARTEMENTAL
      ])
    })
  })
})
