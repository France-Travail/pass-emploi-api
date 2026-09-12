import { stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import {
  ArchiverJeunesMigrationCommand,
  ArchiverJeunesMigrationCommandHandler
} from '../../../../src/application/commands/archiver-jeunes-migrations.command.handler'
import { NonTrouveError } from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../../src/building-blocks/types/result'
import { ArchiveJeune } from '../../../../src/domain/archive-jeune'
import { expect, StubbedClass, stubClass } from '../../../utils'
import { DateService } from '../../../../src/utils/date-service'
import { Mail } from '../../../../src/domain/mail'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { Chat } from '../../../../src/domain/chat'
import { Authentification } from '../../../../src/domain/authentification'
import { Migration } from '../../../../src/domain/migration'
import { EvenementService } from '../../../../src/domain/evenement'
import Service = ArchiveJeune.Service

describe('ArchiverJeunesMigrationCommandHandler', () => {
  let archiverJeunesMigrationSupportCommandHandler: ArchiverJeunesMigrationCommandHandler
  let serviceMock: Service
  let migrationService: StubbedClass<Migration.Service>
  let evenementService: StubbedClass<EvenementService>

  const maintenant = new Date('2022-03-01T03:24:00Z')

  beforeEach(() => {
    const sandbox = createSandbox()

    const jeuneRepositoryStub = stubInterface<Jeune.Repository>(sandbox)
    const archiveJeuneRepositoryStub =
      stubInterface<ArchiveJeune.Repository>(sandbox)
    const chatRepositoryStub = stubInterface<Chat.Repository>(sandbox)
    const authentificationRepositoryStub =
      stubInterface<Authentification.Repository>(sandbox)
    const dateService = stubClass(DateService)
    const mailService = stubInterface<Mail.Service>(sandbox)

    serviceMock = {
      jeuneRepository: jeuneRepositoryStub,
      archiveJeuneRepository: archiveJeuneRepositoryStub,
      chatRepository: chatRepositoryStub,
      authentificationRepository: authentificationRepositoryStub,
      dateService: dateService.nowJs.returns(maintenant),
      mailService: mailService,

      archiver: sandbox.stub().resolves(emptySuccess())
    } as unknown as Service

    migrationService = stubClass(Migration.Service)
    evenementService = stubClass(EvenementService)
    archiverJeunesMigrationSupportCommandHandler =
      new ArchiverJeunesMigrationCommandHandler(
        evenementService,
        migrationService,
        serviceMock
      )
  })

  describe('authorize', () => {
    it('autorise : le profil support est déjà garanti par profilsAutorises', async () => {
      // When
      const result =
        await archiverJeunesMigrationSupportCommandHandler.authorize()

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })

  describe('handle', () => {
    it("échoue quand la vague de migration n'existe pas", async () => {
      // Given
      migrationService.migrationExiste
        .withArgs('PHASE_INCONNUE')
        .resolves(false)

      // When
      const result = await archiverJeunesMigrationSupportCommandHandler.handle({
        phaseDeMigration: 'PHASE_INCONNUE'
      })

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Migration', 'PHASE_INCONNUE'))
      )
      expect(
        migrationService.recupererIdsDesBeneficiaireAMigrer
      ).not.to.have.been.called()
    })

    describe('quand le jeune existe', () => {
      it('archive le jeune', async () => {
        // Given
        const command: ArchiverJeunesMigrationCommand = {
          phaseDeMigration: 'PHASE_A'
        }
        const idJeunes = ['1', '2', '3']
        migrationService.migrationExiste.withArgs('PHASE_A').resolves(true)
        migrationService.recupererIdsDesBeneficiaireAMigrer.resolves(idJeunes)

        // When
        const result =
          await archiverJeunesMigrationSupportCommandHandler.handle(command)

        // Then
        expect(result).to.deep.equal(emptySuccess())
      })
    })
  })
})
