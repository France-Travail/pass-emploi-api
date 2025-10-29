import { SupportAuthorizer } from '../../../../src/application/authorizers/support-authorizer'
import {
  UpdateAgenceConseillerCommand,
  UpdateAgenceConseillerCommandHandler
} from '../../../../src/application/commands/support/update-agence-conseiller.command.handler'
import { DroitsInsuffisants } from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  success
} from '../../../../src/building-blocks/types/result'
import { Agence } from '../../../../src/domain/agence'
import {
  unUtilisateurConseiller,
  unUtilisateurSupport
} from '../../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'

describe('UpdateAgenceConseillerCommandHandler', () => {
  let updateAgenceConseillerCommandHandler: UpdateAgenceConseillerCommandHandler
  let agenceService: StubbedClass<Agence.Service>
  let authorizeSupport: StubbedClass<SupportAuthorizer>

  beforeEach(async () => {
    agenceService = stubClass(Agence.Service)
    authorizeSupport = stubClass(SupportAuthorizer)
    updateAgenceConseillerCommandHandler =
      new UpdateAgenceConseillerCommandHandler(agenceService, authorizeSupport)
  })

  describe('handle', () => {
    it('appelle le service', async () => {
      // Given
      agenceService.changerAgenceConseiller.resolves(
        success({
          idAncienneAgence: 'test',
          idNouvelleAgence: 'test',
          infosTransfertAnimationsCollectives: []
        })
      )
      // When
      const result = await updateAgenceConseillerCommandHandler.handle({
        idConseiller: 'test',
        idNouvelleAgence: 'agence-002'
      })
      // Then
      expect(result).to.deep.equal(
        success({
          idAncienneAgence: 'test',
          idNouvelleAgence: 'test',
          infosTransfertAnimationsCollectives: []
        })
      )
    })
  })

  describe('authorize', () => {
    const command: UpdateAgenceConseillerCommand = {
      idConseiller: 'test',
      idNouvelleAgence: 'idNouvelleAgence'
    }
    it('autorise le support', async () => {
      // Given
      authorizeSupport.autoriserSupport
        .withArgs(unUtilisateurSupport())
        .resolves(emptySuccess())
      // When
      const result = await updateAgenceConseillerCommandHandler.authorize(
        command,
        unUtilisateurSupport()
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
    it('rejette les autres', async () => {
      // Given
      authorizeSupport.autoriserSupport
        .withArgs(unUtilisateurConseiller())
        .resolves(failure(new DroitsInsuffisants()))
      // When
      const result = await updateAgenceConseillerCommandHandler.authorize(
        command,
        unUtilisateurConseiller()
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })
  })
})
