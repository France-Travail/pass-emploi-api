import { PlanAction } from 'src/domain/plan-action/plan-action'
import { ReferentielPlanAction } from 'src/domain/plan-action/referentiel-plan-action'
import { Profil } from 'src/domain/profil'
import { MauvaiseCommandeError } from 'src/building-blocks/types/domain-error'
import { failure, isSuccess } from 'src/building-blocks/types/result'
import { DateService } from 'src/utils/date-service'
import { IdService } from 'src/utils/id-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'

describe('PlanAction.Factory', () => {
  let factory: PlanAction.Factory
  let idService: StubbedClass<IdService>
  let dateService: StubbedClass<DateService>

  const maintenant = uneDatetime()

  function uneSolution(id: string): ReferentielPlanAction.Solution {
    return {
      id,
      type: PlanAction.TypeTache.LIEN,
      libelle: 'Je consulte des sites',
      situations: [],
      authentifications: [Profil.Structure.FRANCE_TRAVAIL],
      territoires: []
    }
  }

  function uneSuggestion(
    idsSolutions: string[][] = [['p-2']]
  ): PlanAction.Suggestion {
    return {
      accroche: 'Bonjour',
      genereLe: maintenant,
      generateur: 'llm',
      objectifs: idsSolutions.map((ids, index) => ({
        titre: `Objectif ${index}`,
        theme: 'apprenticeship',
        idsSolutions: ids
      }))
    }
  }

  beforeEach(() => {
    idService = stubClass(IdService)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)

    let compteur = 0
    idService.uuid.callsFake(() => `uuid-${compteur++}`)

    factory = new PlanAction.Factory(idService, dateService)
  })

  it('attribue nos propres identifiants au plan, aux objectifs et aux tâches', () => {
    // When
    const result = factory.creer('jeune-1', uneSuggestion(), [
      uneSolution('p-2')
    ])

    // Then
    expect(isSuccess(result)).to.equal(true)
    if (isSuccess(result)) {
      expect(result.data.id).to.equal('uuid-0')
      expect(result.data.objectifs[0].id).to.equal('uuid-1')
      expect(result.data.objectifs[0].taches[0].id).to.equal('uuid-2')
      expect(result.data.objectifs[0].taches[0].idSolution).to.equal('p-2')
    }
  })

  it('pose le jeune, la date de création et des tâches non terminées', () => {
    // When
    const result = factory.creer('jeune-1', uneSuggestion(), [
      uneSolution('p-2')
    ])

    // Then
    if (isSuccess(result)) {
      expect(result.data.idJeune).to.equal('jeune-1')
      expect(result.data.dateCreation).to.deep.equal(maintenant)
      expect(result.data.objectifs[0].taches[0].terminee).to.equal(false)
      expect(result.data.objectifs[0].taches[0].dateTerminee).to.equal(
        undefined
      )
    }
  })

  it('écarte les identifiants de solution absents du référentiel', () => {
    // When
    const result = factory.creer(
      'jeune-1',
      uneSuggestion([['p-2', 'inconnue']]),
      [uneSolution('p-2')]
    )

    // Then
    if (isSuccess(result)) {
      expect(result.data.objectifs[0].taches).to.have.length(1)
      expect(result.data.objectifs[0].taches[0].idSolution).to.equal('p-2')
    }
  })

  it('écarte les objectifs devenus vides', () => {
    // When
    const result = factory.creer(
      'jeune-1',
      uneSuggestion([['p-2'], ['inconnue']]),
      [uneSolution('p-2')]
    )

    // Then
    if (isSuccess(result)) {
      expect(result.data.objectifs).to.have.length(1)
      expect(result.data.objectifs[0].titre).to.equal('Objectif 0')
    }
  })

  it('échoue quand aucun objectif ne survit au filtrage', () => {
    // When
    const result = factory.creer('jeune-1', uneSuggestion([['inconnue']]), [
      uneSolution('p-2')
    ])

    // Then
    expect(result).to.deep.equal(
      failure(
        new MauvaiseCommandeError(
          "Aucune solution du plan d'action généré n'est présente dans le référentiel"
        )
      )
    )
  })

  it('déduplique les identifiants répétés dans un même objectif', () => {
    // When
    const result = factory.creer('jeune-1', uneSuggestion([['p-2', 'p-2']]), [
      uneSolution('p-2')
    ])

    // Then
    if (isSuccess(result)) {
      expect(result.data.objectifs[0].taches).to.have.length(1)
    }
  })
})
