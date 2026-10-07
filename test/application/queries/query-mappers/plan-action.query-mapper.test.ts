import { PlanAction } from 'src/domain/plan-action/plan-action'
import { Questionnaire } from 'src/domain/plan-action/questionnaire'
import { ReferentielPlanAction } from 'src/domain/plan-action/referentiel-plan-action'
import { Profil } from 'src/domain/profil'
import { toPlanActionQueryModel } from 'src/application/queries/query-mappers/plan-action.query-mapper'
import {
  unProfilCD,
  unProfilFT,
  unProfilInvite,
  unProfilMilo
} from 'test/fixtures/profil.fixture'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { expect } from 'test/utils'

describe('toPlanActionQueryModel', () => {
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
          theme: Questionnaire.Besoin.ALTERNANCE,
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
      type: ReferentielPlanAction.TypeSolution.LIEN,
      libelle: 'Je consulte des sites',
      service: { id: 'service-1', nom: 'ONISEP' },
      situations: [],
      authentifications: [Profil.Structure.FRANCE_TRAVAIL],
      territoires: []
    }
  }

  it("expose l'identifiant de la tâche, jamais celui de la solution", () => {
    // When
    const queryModel = toPlanActionQueryModel(
      unPlan(),
      [uneSolution('p-2')],
      unProfilMilo()
    )

    // Then
    expect(queryModel.objectives[0].actions[0].id).to.equal('tache-1')
  })

  it('matérialise le libellé et le service depuis le référentiel', () => {
    // When
    const queryModel = toPlanActionQueryModel(
      unPlan(),
      [uneSolution('p-2')],
      unProfilMilo()
    )

    // Then
    expect(queryModel.objectives[0].actions[0].libelle).to.equal(
      'Je consulte des sites'
    )
    expect(queryModel.objectives[0].actions[0].nomService).to.equal('ONISEP')
  })

  it("expose l'état terminé de la tâche", () => {
    // Given
    const plan = unPlan()
    plan.objectifs[0].taches[0] = {
      ...plan.objectifs[0].taches[0],
      terminee: true,
      dateTerminee: maintenant
    }

    // When
    const queryModel = toPlanActionQueryModel(
      plan,
      [uneSolution('p-2')],
      unProfilMilo()
    )

    // Then
    expect(queryModel.objectives[0].actions[0].terminee).to.equal(true)
  })

  it("n'expose pas une tâche supprimée, ni son objectif s'il se vide", () => {
    // Given
    const plan = unPlan()
    plan.objectifs[0].taches[0] = {
      ...plan.objectifs[0].taches[0],
      dateSuppression: maintenant
    }

    // When
    const queryModel = toPlanActionQueryModel(
      plan,
      [uneSolution('p-2')],
      unProfilMilo()
    )

    // Then
    expect(queryModel.objectives).to.deep.equal([])
  })

  it('écarte un objectif dont toutes les solutions ont disparu du référentiel', () => {
    // When
    const queryModel = toPlanActionQueryModel(unPlan(), [], unProfilMilo())

    // Then
    expect(queryModel.objectives).to.deep.equal([])
  })

  it('conserve les objectifs restants quand une seule solution a disparu du référentiel', () => {
    // Given
    const plan: PlanAction = {
      id: 'plan-1',
      idJeune: 'jeune-1',
      dateCreation: maintenant,
      objectifs: [
        ...unPlan().objectifs,
        {
          id: 'objectif-2',
          titre: 'Se former',
          theme: Questionnaire.Besoin.FORMER,
          taches: [
            {
              id: 'tache-2',
              idSolution: 'inconnue',
              terminee: false,
              dateCreation: maintenant
            }
          ]
        }
      ]
    }

    // When
    const queryModel = toPlanActionQueryModel(
      plan,
      [uneSolution('p-2')],
      unProfilMilo()
    )

    // Then
    expect(queryModel.objectives).to.have.length(1)
    expect(queryModel.objectives[0].id).to.equal('objectif-1')
  })

  describe('déclaration', () => {
    const solutionConvertie: ReferentielPlanAction.Solution = {
      ...uneSolution('p-2'),
      conversionML: { categorie: 'Emploi', codeCategorie: 'EMPLOI' },
      conversionFT: {
        thematique: 'Mes candidatures',
        codePourquoi: 'P03',
        codeQuoi: 'Q12'
      }
    }

    it('annonce la catégorie Mission Locale à un jeune Mission Locale', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan(),
        [solutionConvertie],
        unProfilMilo(Profil.Dispositif.CEJ)
      )

      // Then
      expect(queryModel.objectives[0].actions[0]).to.include({
        declarationRequise: true,
        categorie: 'Emploi'
      })
    })

    it('annonce la thématique France Travail à un jeune France Travail', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan(),
        [solutionConvertie],
        unProfilFT(Profil.Dispositif.CEJ)
      )

      // Then
      expect(queryModel.objectives[0].actions[0]).to.include({
        declarationRequise: true,
        categorie: 'Mes candidatures'
      })
    })

    it('annonce la thématique France Travail à un jeune du Conseil départemental', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan(),
        [solutionConvertie],
        unProfilCD()
      )

      // Then
      expect(queryModel.objectives[0].actions[0]).to.include({
        declarationRequise: true,
        categorie: 'Mes candidatures'
      })
    })

    it('requiert la déclaration même sans catégorie renseignée', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan(),
        [uneSolution('p-2')],
        unProfilMilo()
      )

      // Then
      expect(queryModel.objectives[0].actions[0].declarationRequise).to.equal(
        true
      )
      expect(queryModel.objectives[0].actions[0]).not.to.have.property(
        'categorie'
      )
    })

    it('requiert la déclaration à un jeune France Travail sans conversion France Travail', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan(),
        [uneSolution('p-2')],
        unProfilFT(Profil.Dispositif.CEJ)
      )

      // Then
      expect(queryModel.objectives[0].actions[0].declarationRequise).to.equal(
        true
      )
      expect(queryModel.objectives[0].actions[0]).not.to.have.property(
        'categorie'
      )
    })

    it("n'annonce rien à un jeune de l'Espace candidat", () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan(),
        [solutionConvertie],
        unProfilFT(Profil.Dispositif.ESPACE_CANDIDAT)
      )

      // Then
      expect(queryModel.objectives[0].actions[0].declarationRequise).to.equal(
        false
      )
      expect(queryModel.objectives[0].actions[0]).not.to.have.property(
        'categorie'
      )
    })

    it("n'annonce rien à l'invité", () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan(),
        [solutionConvertie],
        unProfilInvite()
      )

      // Then
      expect(queryModel.objectives[0].actions[0].declarationRequise).to.equal(
        false
      )
      expect(queryModel.objectives[0].actions[0]).not.to.have.property(
        'categorie'
      )
    })
  })
})
