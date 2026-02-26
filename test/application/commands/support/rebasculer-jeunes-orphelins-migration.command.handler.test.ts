import { createSandbox } from 'sinon'
import { SupportAuthorizer } from '../../../../src/application/authorizers/support-authorizer'
import {
  RebasculerJeunesOrphelinsMigrationCommand,
  RebasculerJeunesOrphelinsMigrationCommandHandler
} from '../../../../src/application/commands/rebasculer-jeunes-orphelins-migration.command.handler'
import { emptySuccess } from '../../../../src/building-blocks/types/result'
import { FeatureFlip, RebasculementOrphelin } from '../../../../src/domain/feature-flip'
import { unUtilisateurSupport } from '../../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'
import PhaseDeMigration = FeatureFlip.PhaseDeMigration

describe('RebasculerJeunesOrphelinsMigrationCommandHandler', () => {
  let handler: RebasculerJeunesOrphelinsMigrationCommandHandler
  let featureFlipService: StubbedClass<FeatureFlip.Service>
  let authorizeSupport: StubbedClass<SupportAuthorizer>
  const sandbox = createSandbox()

  beforeEach(() => {
    featureFlipService = stubClass(FeatureFlip.Service)
    authorizeSupport = stubClass(SupportAuthorizer)
    handler = new RebasculerJeunesOrphelinsMigrationCommandHandler(
      featureFlipService,
      authorizeSupport
    )
  })

  afterEach(() => sandbox.restore())

  describe('authorize', () => {
    it('autorise un membre du support', () => {
      // Given
      const command: RebasculerJeunesOrphelinsMigrationCommand = {
        phaseDeMigration: PhaseDeMigration.PHASE_B
      }
      // When
      handler.authorize(command, unUtilisateurSupport())

      // Then
      expect(authorizeSupport.autoriserSupport).to.have.been.calledWithExactly(
        unUtilisateurSupport()
      )
    })
  })

  describe('handle', () => {
    const rebasculements: RebasculementOrphelin[] = [
      {
        idJeune: 'jeune-1',
        ancienIdConseiller: 'conseiller-migrant',
        nouveauIdConseiller: 'conseiller-initial'
      },
      {
        idJeune: 'jeune-2',
        ancienIdConseiller: 'conseiller-migrant',
        nouveauIdConseiller: 'conseiller-initial'
      }
    ]

    it('rebasculer les jeunes orphelins et retourner un succès', async () => {
      // Given
      const command: RebasculerJeunesOrphelinsMigrationCommand = {
        phaseDeMigration: PhaseDeMigration.PHASE_B
      }
      featureFlipService.rebasculerOrphelinsDePhase.resolves(rebasculements)

      // When
      const result = await handler.handle(command)

      // Then
      expect(
        featureFlipService.rebasculerOrphelinsDePhase
      ).to.have.been.calledWithExactly(PhaseDeMigration.PHASE_B)
      expect(result).to.deep.equal(emptySuccess())
    })

    it('log chaque jeune rebasculé avec son ancien et nouveau conseiller', async () => {
      // Given
      const command: RebasculerJeunesOrphelinsMigrationCommand = {
        phaseDeMigration: PhaseDeMigration.PHASE_B
      }
      featureFlipService.rebasculerOrphelinsDePhase.resolves(rebasculements)
      const logStub = sandbox.stub((handler as any).logger, 'log')

      // When
      await handler.handle(command)

      // Then
      expect(logStub).to.have.been.calledWith(
        {
          idJeune: 'jeune-1',
          ancienIdConseiller: 'conseiller-migrant',
          nouveauIdConseiller: 'conseiller-initial'
        },
        'Jeune rebasculé'
      )
      expect(logStub).to.have.been.calledWith(
        {
          idJeune: 'jeune-2',
          ancienIdConseiller: 'conseiller-migrant',
          nouveauIdConseiller: 'conseiller-initial'
        },
        'Jeune rebasculé'
      )
      expect(logStub).to.have.been.calledWith(
        { phaseDeMigration: PhaseDeMigration.PHASE_B, count: 2 },
        'Rebasculement orphelins terminé'
      )
    })
  })
})
