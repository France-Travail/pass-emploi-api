import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import {
  RebasculerJeunesOrphelinsMigrationCommand,
  RebasculerJeunesOrphelinsMigrationCommandHandler
} from '../../../../src/application/commands/rebasculer-jeunes-orphelins-migration.command.handler'
import { NonTrouveError } from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../../src/building-blocks/types/result'
import {
  Migration,
  RebasculementOrphelin
} from '../../../../src/domain/migration'
import { rootLogger } from '../../../../src/utils/logger.module'
import { expect, StubbedClass, stubClass } from '../../../utils'

describe('RebasculerJeunesOrphelinsMigrationCommandHandler', () => {
  let handler: RebasculerJeunesOrphelinsMigrationCommandHandler
  let migrationService: StubbedClass<Migration.Service>
  let migrationRepository: StubbedType<Migration.Repository>
  const sandbox = createSandbox()

  beforeEach(() => {
    migrationService = stubClass(Migration.Service)
    migrationRepository = stubInterface<Migration.Repository>(sandbox)
    handler = new RebasculerJeunesOrphelinsMigrationCommandHandler(
      migrationService,
      migrationRepository
    )
  })

  afterEach(() => sandbox.restore())

  describe('authorize', () => {
    it('autorise : le profil support est déjà garanti par profilsAutorises', async () => {
      // When
      const result = await handler.authorize()

      // Then
      expect(result).to.deep.equal(emptySuccess())
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
        idPopulationQuiMigre: 'PHASE_B'
      }
      migrationRepository.populationConcerneeParUneMigration
        .withArgs('PHASE_B')
        .resolves(true)
      migrationService.rebasculerOrphelins.resolves(rebasculements)

      // When
      const result = await handler.handle(command)

      // Then
      expect(
        migrationService.rebasculerOrphelins
      ).to.have.been.calledWithExactly('PHASE_B')
      expect(result).to.deep.equal(emptySuccess())
    })

    it("échoue quand la vague de migration n'existe pas", async () => {
      // Given
      migrationRepository.populationConcerneeParUneMigration
        .withArgs('PHASE_INCONNUE')
        .resolves(false)

      // When
      const result = await handler.handle({
        idPopulationQuiMigre: 'PHASE_INCONNUE'
      })

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Migration', 'PHASE_INCONNUE'))
      )
      expect(migrationService.rebasculerOrphelins).not.to.have.been.called()
    })

    it('log chaque jeune rebasculé avec son ancien et nouveau conseiller', async () => {
      // Given
      const command: RebasculerJeunesOrphelinsMigrationCommand = {
        idPopulationQuiMigre: 'PHASE_B'
      }
      migrationRepository.populationConcerneeParUneMigration
        .withArgs('PHASE_B')
        .resolves(true)
      migrationService.rebasculerOrphelins.resolves(rebasculements)
      const logInfo = sandbox.stub(rootLogger, 'info')

      // When
      await handler.handle(command)

      // Then
      for (const idJeune of ['jeune-1', 'jeune-2']) {
        expect(logInfo).to.have.been.calledWith(
          {
            context: 'RebasculerJeunesOrphelinsMigrationCommandHandler',
            labels: {
              population_id: 'PHASE_B',
              jeune_id: idJeune,
              ancien_conseiller_id: 'conseiller-migrant',
              nouveau_conseiller_id: 'conseiller-initial'
            }
          },
          'Jeune orphelin rebasculé vers son conseiller initial'
        )
      }
    })
  })
})
