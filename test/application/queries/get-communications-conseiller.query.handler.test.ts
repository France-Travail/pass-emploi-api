import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import { GetCommunicationsConseillerQueryHandler } from '../../../src/application/queries/get-communications-conseiller.query.handler'
import {
  emptySuccess,
  success
} from '../../../src/building-blocks/types/result'
import { Communication } from '../../../src/domain/communication'
import { DISPOSITIFS_ACCOMPAGNES } from '../../../src/domain/profil'
import { DateService } from '../../../src/utils/date-service'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('GetCommunicationsConseillerQueryHandler', () => {
  const maintenant = DateTime.fromISO('2026-10-01T12:00:00.000Z')

  let communicationRepository: StubbedType<Communication.Repository>
  let dateService: StubbedClass<DateService>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let handler: GetCommunicationsConseillerQueryHandler

  beforeEach(() => {
    communicationRepository =
      stubInterface<Communication.Repository>(createSandbox())
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    handler = new GetCommunicationsConseillerQueryHandler(
      communicationRepository,
      dateService,
      conseillerAuthorizer
    )
  })

  it('est ouvert aux dispositifs accompagnés', () => {
    expect(handler.profilsAutorises).to.equal(DISPOSITIFS_ACCOMPAGNES)
  })

  describe('handle', () => {
    it('renvoie le message informatif visible maintenant', async () => {
      // Given
      communicationRepository.getMessageInformatifDuConseiller
        .withArgs('id-conseiller', maintenant)
        .resolves({ id: 3, titre: 'Titre', contenu: 'Contenu' })

      // When
      const result = await handler.handle({ idConseiller: 'id-conseiller' })

      // Then
      expect(result).to.deep.equal(
        success({
          messageInformatif: { id: 3, titre: 'Titre', contenu: 'Contenu' }
        })
      )
    })

    it("renvoie un objet vide quand il n'y a rien à afficher", async () => {
      // Given
      communicationRepository.getMessageInformatifDuConseiller.resolves(
        undefined
      )

      // When
      const result = await handler.handle({ idConseiller: 'id-conseiller' })

      // Then
      expect(result).to.deep.equal(success({}))
    })
  })

  describe('authorize', () => {
    it('autorise le conseiller lui-même', async () => {
      // Given
      const utilisateur = unUtilisateurConseiller()
      conseillerAuthorizer.autoriserLeConseiller
        .withArgs('id-conseiller', utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(
        { idConseiller: 'id-conseiller' },
        utilisateur
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })
})
