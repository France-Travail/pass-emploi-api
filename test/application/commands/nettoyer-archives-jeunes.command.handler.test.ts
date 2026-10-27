import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { NettoyerArchivesJeunesCommandHandler } from '../../../src/application/commands/nettoyer-archives-jeunes.command.handler'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../src/building-blocks/types/result'
import { Migration } from '../../../src/domain/migration'
import { Planificateur } from '../../../src/domain/planificateur'
import { DateService } from '../../../src/utils/date-service'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('NettoyerArchivesJeunesCommandHandler', () => {
  let nettoyerArchivesJeunesCommandHandler: NettoyerArchivesJeunesCommandHandler
  let migrationRepository: StubbedType<Migration.Repository>
  let planificateurRepository: StubbedType<Planificateur.Repository>
  let dateService: StubbedClass<DateService>

  const maintenant = new Date('2026-10-23T10:00:00Z')

  beforeEach(() => {
    const sandbox = createSandbox()
    migrationRepository = stubInterface<Migration.Repository>(sandbox)
    planificateurRepository = stubInterface<Planificateur.Repository>(sandbox)
    dateService = stubClass(DateService)
    dateService.nowJs.returns(maintenant)

    nettoyerArchivesJeunesCommandHandler =
      new NettoyerArchivesJeunesCommandHandler(
        migrationRepository,
        planificateurRepository,
        dateService
      )
  })

  describe('handle', () => {
    it('planifie le nettoyage restreint à la population', async () => {
      // Given
      migrationRepository.populationConcerneeParUneMigration
        .withArgs('PHASE_A')
        .resolves(true)

      // When
      const result = await nettoyerArchivesJeunesCommandHandler.handle({
        idPopulationQuiMigre: 'PHASE_A'
      })

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith({
        dateExecution: maintenant,
        type: Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES,
        contenu: { idPopulation: 'PHASE_A' }
      })
    })

    it('planifie le nettoyage de toutes les archives sans population', async () => {
      // When
      const result = await nettoyerArchivesJeunesCommandHandler.handle({})

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        migrationRepository.populationConcerneeParUneMigration
      ).not.to.have.been.called()
      expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith({
        dateExecution: maintenant,
        type: Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES,
        contenu: {}
      })
    })

    it("renvoie NonTrouveError quand la population n'est visée par aucune migration", async () => {
      // Given
      migrationRepository.populationConcerneeParUneMigration
        .withArgs('PHASE_INCONNUE')
        .resolves(false)

      // When
      const result = await nettoyerArchivesJeunesCommandHandler.handle({
        idPopulationQuiMigre: 'PHASE_INCONNUE'
      })

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Migration', 'PHASE_INCONNUE'))
      )
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    })
  })

  describe('labelsDuLog', () => {
    it('porte la population', () => {
      // When - Then
      expect(
        nettoyerArchivesJeunesCommandHandler['labelsDuLog'](emptySuccess(), {
          idPopulationQuiMigre: 'PHASE_A'
        })
      ).to.deep.equal({ population_id: 'PHASE_A' })
    })

    it('ne porte rien sans population', () => {
      // When - Then
      expect(
        nettoyerArchivesJeunesCommandHandler['labelsDuLog'](emptySuccess(), {})
      ).to.equal(undefined)
    })
  })
})
