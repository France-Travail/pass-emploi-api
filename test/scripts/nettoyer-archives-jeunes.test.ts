import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { NettoyerArchivesJeunesCommandHandler } from '../../src/application/commands/nettoyer-archives-jeunes.command.handler'
import { Migration } from '../../src/domain/migration'
import { Planificateur } from '../../src/domain/planificateur'
import {
  lireIdPopulation,
  planifierNettoyageDesArchives
} from '../../src/scripts/nettoyer-archives-jeunes'
import { DateService } from '../../src/utils/date-service'
import { expect, StubbedClass, stubClass } from '../utils'

describe('nettoyer-archives-jeunes', () => {
  describe('lireIdPopulation', () => {
    it('lit la population', () => {
      expect(lireIdPopulation(['PHASE_A'])).to.equal('PHASE_A')
    })

    it('renvoie undefined sans argument', () => {
      expect(lireIdPopulation([])).to.equal(undefined)
    })

    it('refuse plus d’un argument', () => {
      expect(() => lireIdPopulation(['PHASE_A', 'PHASE_B'])).to.throw(
        'Usage : yarn nettoyer-archives-jeunes [idPopulation]'
      )
    })
  })

  describe('planifierNettoyageDesArchives', () => {
    let commandHandler: NettoyerArchivesJeunesCommandHandler
    let migrationRepository: StubbedType<Migration.Repository>
    let planificateurRepository: StubbedType<Planificateur.Repository>
    let dateService: StubbedClass<DateService>
    const maintenant = new Date('2026-10-26T10:00:00Z')

    beforeEach(() => {
      const sandbox = createSandbox()
      migrationRepository = stubInterface<Migration.Repository>(sandbox)
      planificateurRepository = stubInterface<Planificateur.Repository>(sandbox)
      dateService = stubClass(DateService)
      dateService.nowJs.returns(maintenant)
      commandHandler = new NettoyerArchivesJeunesCommandHandler(
        migrationRepository,
        planificateurRepository,
        dateService
      )
    })

    it('planifie le job restreint à la population', async () => {
      // Given
      migrationRepository.populationConcerneeParUneMigration
        .withArgs('PHASE_A')
        .resolves(true)

      // When
      await planifierNettoyageDesArchives(commandHandler, 'PHASE_A')

      // Then
      expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith({
        dateExecution: maintenant,
        type: Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES,
        contenu: { idPopulation: 'PHASE_A' }
      })
    })

    it('planifie le job sur toutes les archives sans population', async () => {
      // When
      await planifierNettoyageDesArchives(commandHandler, undefined)

      // Then
      expect(planificateurRepository.ajouterJob).to.have.been.calledOnceWith({
        dateExecution: maintenant,
        type: Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES,
        contenu: {}
      })
    })

    it('échoue pour une population inconnue, sans planifier', async () => {
      // Given
      migrationRepository.populationConcerneeParUneMigration
        .withArgs('PHASE_INCONNUE')
        .resolves(false)

      // When
      const promesse = planifierNettoyageDesArchives(
        commandHandler,
        'PHASE_INCONNUE'
      )

      // Then
      await expect(promesse).to.be.rejectedWith(
        "Population PHASE_INCONNUE : aucun déploiement de nature MIGRATION ne la vise, rien n'est planifié"
      )
      expect(planificateurRepository.ajouterJob).not.to.have.been.called()
    })
  })
})
