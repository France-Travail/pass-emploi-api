import { UpdateAgenceConseillerCommandHandler } from '../../../../src/application/commands/support/update-agence-conseiller.command.handler'
import {
  emptySuccess,
  success
} from '../../../../src/building-blocks/types/result'
import { Agence } from '../../../../src/domain/agence'
import { expect, StubbedClass, stubClass } from '../../../utils'

describe('UpdateAgenceConseillerCommandHandler', () => {
  let updateAgenceConseillerCommandHandler: UpdateAgenceConseillerCommandHandler
  let agenceService: StubbedClass<Agence.Service>

  beforeEach(async () => {
    agenceService = stubClass(Agence.Service)
    updateAgenceConseillerCommandHandler =
      new UpdateAgenceConseillerCommandHandler(agenceService)
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
    it('autorise : le profil support est déjà garanti par profilsAutorises', async () => {
      // When
      const result = await updateAgenceConseillerCommandHandler.authorize()

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })
})
