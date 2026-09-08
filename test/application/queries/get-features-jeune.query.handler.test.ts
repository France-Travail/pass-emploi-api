import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { GetFeaturesJeuneQueryHandler } from '../../../src/application/queries/get-features-jeune.query.handler'
import { FeatureJeuneQueryModel } from '../../../src/application/queries/query-models/jeunes.query-model'
import { success } from '../../../src/building-blocks/types/result'
import { FeatureFlip } from '../../../src/domain/feature-flip'
import { TOUT_PROFIL_SAUF_INVITE } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, expect, stubClass } from '../../utils'

describe('GetFeaturesJeuneQueryHandler', () => {
  let featureFlipRepository: StubbedType<FeatureFlip.Repository>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let handler: GetFeaturesJeuneQueryHandler

  beforeEach(() => {
    const sandbox = createSandbox()
    featureFlipRepository = stubInterface<FeatureFlip.Repository>(sandbox)
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    handler = new GetFeaturesJeuneQueryHandler(
      featureFlipRepository,
      jeuneAuthorizer
    )
  })

  describe('handle', () => {
    it('renvoie chaque feature avec son état pour le jeune', async () => {
      // Given
      featureFlipRepository.getTagsActifsPourLeConseillerDuJeune
        .withArgs('idJeune')
        .resolves([FeatureFlip.Tag.MIGRATION_PHASE_A])

      // When
      const result = await handler.handle({ idJeune: 'idJeune' })

      // Then
      const expected: FeatureJeuneQueryModel[] = [
        { featureTag: FeatureFlip.Tag.MIGRATION_PHASE_A, active: true },
        { featureTag: FeatureFlip.Tag.MIGRATION_PHASE_B, active: false },
        { featureTag: FeatureFlip.Tag.MIGRATION_PHASE_TEST, active: false }
      ]
      expect(result).to.deep.equal(success(expected))
    })

    it("renvoie toutes les features inactives quand le conseiller du jeune n'en a aucune", async () => {
      // Given
      featureFlipRepository.getTagsActifsPourLeConseillerDuJeune
        .withArgs('idJeune')
        .resolves([])

      // When
      const result = await handler.handle({ idJeune: 'idJeune' })

      // Then
      expect(result).to.deep.equal(
        success(
          Object.values(FeatureFlip.Tag).map(featureTag => ({
            featureTag,
            active: false
          }))
        )
      )
    })
  })

  describe('authorize', () => {
    it('autorise un jeune', async () => {
      // When
      await handler.authorize({ idJeune: 'idJeune' }, unUtilisateurJeune())

      // Then
      expect(jeuneAuthorizer.autoriserLeJeune).to.have.been.calledWithExactly(
        'idJeune',
        unUtilisateurJeune()
      )
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(handler.profilsAutorises).to.deep.equal(TOUT_PROFIL_SAUF_INVITE)
    })
  })
})
