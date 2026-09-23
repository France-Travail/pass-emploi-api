import { PlanAction } from 'src/domain/plan-action/plan-action'
import { ReferentielPlanAction } from 'src/domain/plan-action/referentiel-plan-action'
import { Profil } from 'src/domain/profil'
import { toPlanActionConnecteQueryModel } from 'src/application/queries/query-mappers/plan-action.query-mapper'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { expect } from 'test/utils'

describe('toPlanActionConnecteQueryModel', () => {
  const maintenant = uneDatetime()

  function unPlan(): PlanAction {
    return {
      id: 'plan-1',
      idJeune: 'jeune-1',
      dateCreation: maintenant,
      objectifs: [
        {
          id: 'objectif-1',
          titre: 'Trouver une alternance',
          theme: 'apprenticeship',
          taches: [
            {
              id: 'tache-1',
              idSolution: 'p-2',
              terminee: false,
              dateCreation: maintenant
            }
          ]
        }
      ]
    }
  }

  function uneSolution(id: string): ReferentielPlanAction.Solution {
    return {
      id,
      type: PlanAction.TypeTache.LIEN,
      libelle: 'Je consulte des sites',
      service: { id: 'service-1', nom: 'ONISEP' },
      situations: [],
      authentifications: [Profil.Structure.FRANCE_TRAVAIL],
      territoires: []
    }
  }

  it("expose l'identifiant de la tâche, jamais celui de la solution", () => {
    // When
    const queryModel = toPlanActionConnecteQueryModel(unPlan(), [
      uneSolution('p-2')
    ])

    // Then
    expect(queryModel.objectives[0].actions[0].id).to.equal('tache-1')
  })

  it('matérialise le libellé et le service depuis le référentiel', () => {
    // When
    const queryModel = toPlanActionConnecteQueryModel(unPlan(), [
      uneSolution('p-2')
    ])

    // Then
    expect(queryModel.objectives[0].actions[0].libelle).to.equal(
      'Je consulte des sites'
    )
    expect(queryModel.objectives[0].actions[0].nomService).to.equal('ONISEP')
  })

  it('omet une tâche dont la solution a disparu du référentiel', () => {
    // When
    const queryModel = toPlanActionConnecteQueryModel(unPlan(), [])

    // Then
    expect(queryModel.objectives[0].actions).to.deep.equal([])
  })
})
