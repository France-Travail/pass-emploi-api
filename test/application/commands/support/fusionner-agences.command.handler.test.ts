import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SupportAuthorizer } from '../../../../src/application/authorizers/support-authorizer'
import {
  FusionnerAgencesCommand,
  FusionnerAgencesCommandHandler
} from '../../../../src/application/commands/support/fusionner-agences.command.handler'
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
import { unConseiller } from '../../../fixtures/conseiller.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'

describe('FusionnerAgencesCommandHandler', () => {
  let fusionnerAgencesCommandHandler: FusionnerAgencesCommandHandler
  let agenceService: StubbedClass<Agence.Service>
  let authorizeSupport: StubbedClass<SupportAuthorizer>
  let agenceRepository: StubbedType<Agence.Repository>

  beforeEach(async () => {
    const sandbox = createSandbox()
    agenceService = stubClass(Agence.Service)
    authorizeSupport = stubClass(SupportAuthorizer)
    agenceRepository = stubInterface(sandbox)
    fusionnerAgencesCommandHandler = new FusionnerAgencesCommandHandler(
      agenceService,
      authorizeSupport,
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
    const command: FusionnerAgencesCommand = {
      idAgenceSource: 'test',
      idAgenceCible: 'test'
    }
    it('autorise le support', async () => {
      // Given
      authorizeSupport.autoriserSupport
        .withArgs(unUtilisateurSupport())
        .resolves(emptySuccess())
      // When
      const result = await fusionnerAgencesCommandHandler.authorize(
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
      const result = await fusionnerAgencesCommandHandler.authorize(
        command,
        unUtilisateurConseiller()
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })
  })
})
