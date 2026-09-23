import { PlanAction } from 'src/domain/plan-action/plan-action'
import { ReferentielPlanAction } from 'src/domain/plan-action/referentiel-plan-action'
import { Profil } from 'src/domain/profil'
import { ReferentielPlanActionSolutionSqlModel } from 'src/infrastructure/sequelize/models/referentiel-plan-action-solution.sql-model'
import { ReferentielPlanActionSqlRepository } from 'src/infrastructure/repositories/plan-action/referentiel-plan-action-sql.repository.db'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('ReferentielPlanActionSqlRepository', () => {
  let repository: ReferentielPlanActionSqlRepository
  let dateService: StubbedClass<DateService>

  const onisep: ReferentielPlanAction.Service = {
    id: '1',
    nom: 'ONISEP',
    description: 'site pour trouver une formation'
  }

  const plafondLarge: ReferentielPlanAction.PlafondDesactivations = {
    pourcentageMax: 100,
    nombreMin: 100
  }

  const enEcriture: { dryRun: boolean } = { dryRun: false }

  function uneSolution(
    override: Partial<ReferentielPlanAction.Solution> = {}
  ): ReferentielPlanAction.Solution {
    return {
      id: 'p-2',
      besoin: PlanAction.Besoin.ORIENTER,
      type: PlanAction.TypeTache.LIEN,
      libelle: 'Je consulte des sites',
      url: 'https://www.onisep.fr/',
      service: onisep,
      situations: ['Au collège'],
      authentifications: [Profil.Structure.FRANCE_TRAVAIL],
      territoires: [],
      ...override
    }
  }

  beforeEach(async () => {
    const database = getDatabase()
    await database.cleanPG()
    dateService = stubClass(DateService)
    dateService.now.returns(uneDatetime())
    repository = new ReferentielPlanActionSqlRepository(
      dateService,
      database.sequelize
    )
  })

  describe('remplacer', () => {
    it('crée les services et les solutions', async () => {
      // When
      const diff = await repository.remplacer(
        [onisep],
        [uneSolution()],
        plafondLarge,
        enEcriture
      )

      // Then
      expect(diff).to.deep.equal({
        nbCreees: 1,
        nbMisesAJour: 0,
        nbDesactivees: 0
      })
    })

    it('met à jour une solution déjà connue sans la dupliquer', async () => {
      // Given
      await repository.remplacer(
        [onisep],
        [uneSolution()],
        plafondLarge,
        enEcriture
      )

      // When
      const diff = await repository.remplacer(
        [onisep],
        [uneSolution({ libelle: 'Nouveau libellé' })],
        plafondLarge,
        enEcriture
      )

      // Then
      expect(diff.nbCreees).to.equal(0)
      expect(diff.nbMisesAJour).to.equal(1)
      const solutions = await repository.trouverSolutions(['p-2'])
      expect(solutions[0].libelle).to.equal('Nouveau libellé')
    })

    it('désactive les solutions absentes du nouveau référentiel', async () => {
      // Given
      await repository.remplacer(
        [onisep],
        [uneSolution(), uneSolution({ id: 'p-3' })],
        plafondLarge,
        enEcriture
      )

      // When
      const diff = await repository.remplacer(
        [onisep],
        [uneSolution()],
        plafondLarge,
        enEcriture
      )

      // Then
      expect(diff.nbDesactivees).to.equal(1)
      const desactivee =
        await ReferentielPlanActionSolutionSqlModel.findByPk('p-3')
      expect(desactivee!.active).to.equal(false)
    })

    it('réactive une solution revenue dans le référentiel', async () => {
      // Given
      await repository.remplacer(
        [onisep],
        [uneSolution()],
        plafondLarge,
        enEcriture
      )
      await repository.remplacer([onisep], [], plafondLarge, enEcriture)

      // When
      await repository.remplacer(
        [onisep],
        [uneSolution()],
        plafondLarge,
        enEcriture
      )

      // Then
      const solutions = await repository.trouverSolutions(['p-2'])
      expect(solutions).to.have.length(1)
    })

    it('persiste une solution sans service', async () => {
      // When
      await repository.remplacer(
        [],
        [uneSolution({ service: undefined })],
        plafondLarge,
        enEcriture
      )

      // Then
      const solutions = await repository.trouverSolutions(['p-2'])
      expect(solutions[0].service).to.equal(undefined)
    })

    it('refuse de désactiver au-delà du plafond et ne touche à rien', async () => {
      // Given
      await repository.remplacer(
        [onisep],
        [uneSolution(), uneSolution({ id: 'p-3' }), uneSolution({ id: 'p-4' })],
        plafondLarge,
        enEcriture
      )

      // When
      const promesse = repository.remplacer(
        [onisep],
        [uneSolution()],
        { pourcentageMax: 10, nombreMin: 1 },
        enEcriture
      )

      // Then
      await expect(promesse).to.be.rejectedWith(
        'Plafond de désactivations dépassé : 2 > 1'
      )
      const encoreActives = await repository.trouverSolutions([
        'p-2',
        'p-3',
        'p-4'
      ])
      expect(encoreActives).to.have.length(3)
    })

    it('simule sans rien écrire en mode dryRun', async () => {
      // When
      const diff = await repository.remplacer(
        [onisep],
        [uneSolution()],
        plafondLarge,
        { dryRun: true }
      )

      // Then
      expect(diff).to.deep.equal({
        nbCreees: 1,
        nbMisesAJour: 0,
        nbDesactivees: 0
      })
      const solutions = await repository.trouverSolutions(['p-2'])
      expect(solutions).to.deep.equal([])
      const solutionsEnBase =
        await ReferentielPlanActionSolutionSqlModel.findAll()
      expect(solutionsEnBase).to.have.length(0)
    })
  })

  describe('trouverSolutions', () => {
    it('rend les solutions demandées avec leur service', async () => {
      // Given
      await repository.remplacer(
        [onisep],
        [uneSolution()],
        plafondLarge,
        enEcriture
      )

      // When
      const solutions = await repository.trouverSolutions(['p-2'])

      // Then
      expect(solutions).to.deep.equal([uneSolution()])
    })

    it('ignore les identifiants inconnus', async () => {
      // Given
      await repository.remplacer(
        [onisep],
        [uneSolution()],
        plafondLarge,
        enEcriture
      )

      // When
      const solutions = await repository.trouverSolutions(['p-2', 'inconnue'])

      // Then
      expect(solutions).to.have.length(1)
    })

    it('ignore les solutions désactivées', async () => {
      // Given
      await repository.remplacer(
        [onisep],
        [uneSolution()],
        plafondLarge,
        enEcriture
      )
      await repository.remplacer([onisep], [], plafondLarge, enEcriture)

      // When
      const solutions = await repository.trouverSolutions(['p-2'])

      // Then
      expect(solutions).to.deep.equal([])
    })

    it('rend un tableau vide sans identifiant demandé', async () => {
      // When
      const solutions = await repository.trouverSolutions([])

      // Then
      expect(solutions).to.deep.equal([])
    })
  })
})
