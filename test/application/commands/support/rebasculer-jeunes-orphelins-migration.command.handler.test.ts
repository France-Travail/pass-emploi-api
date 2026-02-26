import { createSandbox } from 'sinon'
import { SupportAuthorizer } from '../../../../src/application/authorizers/support-authorizer'
import {
  RebasculerJeunesOrphelinsMigrationCommand,
  RebasculerJeunesOrphelinsMigrationCommandHandler
} from '../../../../src/application/commands/rebasculer-jeunes-orphelins-migration.command.handler'
import { emptySuccess } from '../../../../src/building-blocks/types/result'
import {
  Migration,
  RebasculementOrphelin
} from '../../../../src/domain/migration'
import { unUtilisateurSupport } from '../../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'
import PhaseDeMigration = Migration.PhaseDeMigration

describe('RebasculerJeunesOrphelinsMigrationCommandHandler', () => {
  let handler: RebasculerJeunesOrphelinsMigrationCommandHandler
  let migrationService: StubbedClass<Migration.Service>
  let authorizeSupport: StubbedClass<SupportAuthorizer>
  const sandbox = createSandbox()

  beforeEach(() => {
    migrationService = stubClass(Migration.Service)
    authorizeSupport = stubClass(SupportAuthorizer)
    handler = new RebasculerJeunesOrphelinsMigrationCommandHandler(
      migrationService,
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
      migrationService.rebasculerOrphelinsDePhase.resolves(rebasculements)

      // When
      const result = await handler.handle(command)

      // Then
      expect(
        migrationService.rebasculerOrphelinsDePhase
      ).to.have.been.calledWithExactly(PhaseDeMigration.PHASE_B)
      expect(result).to.deep.equal(emptySuccess())
    })

    it('log chaque jeune rebasculé avec son ancien et nouveau conseiller', async () => {
      // Given
      const command: RebasculerJeunesOrphelinsMigrationCommand = {
        phaseDeMigration: PhaseDeMigration.PHASE_B
      }
      migrationService.rebasculerOrphelinsDePhase.resolves(rebasculements)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
