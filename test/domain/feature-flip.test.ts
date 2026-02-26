import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { Authentification } from '../../src/domain/authentification'
import { FeatureFlip } from '../../src/domain/feature-flip'
import { expect } from '../utils'
import Type = Authentification.Type
import Tag = FeatureFlip.Tag

describe('FeatureFlip', () => {
  describe('Service', () => {
    let repository: StubbedType<FeatureFlip.Repository>
    let service: FeatureFlip.Service

    beforeEach(() => {
      const sandbox = createSandbox()
      repository = stubInterface<FeatureFlip.Repository>(sandbox)
      service = new FeatureFlip.Service(repository)
    })

    describe('laFeatureEstActive', () => {
      it('renvoie true quand le conseiller fait partie de la feature', async () => {
        // Given
        const idConseiller = 'conseiller-1'
        repository.getTagSiFeatureActivePourLeConseiller
          .withArgs([FeatureFlip.Tag.DEMARCHES_IA], idConseiller)
          .resolves(FeatureFlip.Tag.DEMARCHES_IA)

        // When
        const result = await service.laFeatureEstActive(Tag.DEMARCHES_IA, {
          id: idConseiller,
          type: Type.CONSEILLER
        })

        // Then
        expect(result).to.be.true()
      })

      it('renvoie false quand le conseiller ne fait partie de la feature', async () => {
        // Given
        const idConseiller = 'conseiller-1'
        repository.getTagSiFeatureActivePourLeConseiller
          .withArgs([FeatureFlip.Tag.DEMARCHES_IA], idConseiller)
          .resolves(undefined)

        // When
        const result = await service.laFeatureEstActive(Tag.DEMARCHES_IA, {
          id: idConseiller,
          type: Type.CONSEILLER
        })

        // Then
        expect(result).to.be.false()
      })

      it('renvoie true quand le bénéficiaire fait partie de la feature', async () => {
        // Given
        const idJeune = 'jeune-1'
        repository.getTagSiFeatureActivePourLeConseillerDuJeune
          .withArgs([FeatureFlip.Tag.DEMARCHES_IA], idJeune)
          .resolves(FeatureFlip.Tag.DEMARCHES_IA)

        // When
        const result = await service.laFeatureEstActive(Tag.DEMARCHES_IA, {
          id: idJeune,
          type: Type.JEUNE
        })

        // Then
        expect(result).to.be.true()
      })

      it('renvoie false quand le bénéficiaire ne fait pas partie de la feature', async () => {
        // Given
        const idJeune = 'jeune-1'
        repository.getTagSiFeatureActivePourLeConseillerDuJeune
          .withArgs([FeatureFlip.Tag.DEMARCHES_IA], idJeune)
          .resolves(undefined)

        // When
        const result = await service.laFeatureEstActive(Tag.DEMARCHES_IA, {
          id: idJeune,
          type: Type.JEUNE
        })

        // Then
        expect(result).to.be.false()
      })
    })
  })
})
