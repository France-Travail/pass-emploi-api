import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { GetCommunicationsJeuneQueryHandler } from '../../../src/application/queries/get-communications-jeune.query.handler'
import {
  emptySuccess,
  success
} from '../../../src/building-blocks/types/result'
import { Communication } from '../../../src/domain/communication'
import { TOUT_PROFIL_SAUF_INVITE } from '../../../src/domain/profil'
import { DateService } from '../../../src/utils/date-service'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('GetCommunicationsJeuneQueryHandler', () => {
  const maintenant = DateTime.fromISO('2026-10-01T12:00:00.000Z')

  let communicationRepository: StubbedType<Communication.Repository>
  let dateService: StubbedClass<DateService>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let handler: GetCommunicationsJeuneQueryHandler

  beforeEach(() => {
    communicationRepository =
      stubInterface<Communication.Repository>(createSandbox())
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    handler = new GetCommunicationsJeuneQueryHandler(
      communicationRepository,
      dateService,
      jeuneAuthorizer
    )
  })

  it('est ouvert à tous les profils sauf invité', () => {
    expect(handler.profilsAutorises).to.equal(TOUT_PROFIL_SAUF_INVITE)
  })

  describe('handle', () => {
    it('renvoie le message informatif visible maintenant, avec son cta', async () => {
      // Given
      communicationRepository.getMessageInformatifDuJeune
        .withArgs('id-jeune', maintenant)
        .resolves({
          id: 3,
          titre: 'Titre',
          contenu: 'Contenu',
          cta: {
            label: 'Télécharger',
            urlAndroid: 'https://android',
            urlIos: 'https://ios'
          }
        })

      // When
      const result = await handler.handle({ idJeune: 'id-jeune' })

      // Then
      expect(result).to.deep.equal(
        success({
          messageInformatif: {
            id: 3,
            titre: 'Titre',
            contenu: 'Contenu',
            cta: {
              label: 'Télécharger',
              urlAndroid: 'https://android',
              urlIos: 'https://ios'
            }
          }
        })
      )
    })

    it("renvoie un objet vide quand il n'y a rien à afficher", async () => {
      // Given
      communicationRepository.getMessageInformatifDuJeune.resolves(undefined)

      // When
      const result = await handler.handle({ idJeune: 'id-jeune' })

      // Then
      expect(result).to.deep.equal(success({}))
    })
  })

  describe('authorize', () => {
    it('autorise le jeune lui-même', async () => {
      // Given
      const utilisateur = unUtilisateurJeune()
      jeuneAuthorizer.autoriserLeJeune
        .withArgs('id-jeune', utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(
        { idJeune: 'id-jeune' },
        utilisateur
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })
})
