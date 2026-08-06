import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { FusionnerAgencesCommandHandler } from '../../../../src/application/commands/support/fusionner-agences.command.handler'
import {
  emptySuccess,
  success
} from '../../../../src/building-blocks/types/result'
import { Agence } from '../../../../src/domain/agence'
import { unConseiller } from '../../../fixtures/conseiller.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'

describe('FusionnerAgencesCommandHandler', () => {
  let fusionnerAgencesCommandHandler: FusionnerAgencesCommandHandler
  let agenceService: StubbedClass<Agence.Service>
  let agenceRepository: StubbedType<Agence.Repository>

  beforeEach(async () => {
    const sandbox = createSandbox()
    agenceService = stubClass(Agence.Service)
    agenceRepository = stubInterface(sandbox)
    fusionnerAgencesCommandHandler = new FusionnerAgencesCommandHandler(
      agenceService,
      agenceRepository
    )
  })

  describe('handle', () => {
    it('appelle le service pour chaque conseiller', async () => {
      // Given
      const conseiller = unConseiller({
        agence: { id: 'ancienne-agence' }
      })
      const idAgenceCible = 'nouvelle-agence'
      agenceRepository.findAllConseillersByAgence.resolves([conseiller])
      agenceService.changerAgenceConseiller.resolves(
        success({
          emailConseiller: conseiller.email,
          idAncienneAgence: conseiller.agence!.id!,
          idNouvelleAgence: idAgenceCible,
          infosTransfertAnimationsCollectives: []
        })
      )
      // When
      const result = await fusionnerAgencesCommandHandler.handle({
        idAgenceSource: conseiller.agence!.id!,
        idAgenceCible
      })
      // Then
      expect(result).to.deep.equal(
        success([
          {
            emailConseiller: conseiller.email,
            idAncienneAgence: conseiller.agence!.id!,
            idNouvelleAgence: idAgenceCible,
            infosTransfertAnimationsCollectives: []
          }
        ])
      )
    })
  })

  describe('authorize', () => {
    it('autorise : le profil support est déjà garanti par profilsAutorises', async () => {
      // When
      const result = await fusionnerAgencesCommandHandler.authorize()

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })
})
