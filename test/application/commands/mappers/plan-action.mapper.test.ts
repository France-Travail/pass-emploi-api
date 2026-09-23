import { DateTime } from 'luxon'
import { GenererPlanActionCommand } from '../../../../src/application/commands/generer-plan-action.command.handler'
import {
  toPlanActionQueryModel,
  toQuestionnaire
} from '../../../../src/application/commands/mappers/plan-action.mapper'
import { TypeActionPlan } from '../../../../src/application/queries/query-models/plan-action.query-model'
import { PlanAction } from '../../../../src/domain/plan-action'
import { Profil } from '../../../../src/domain/profil'
import { Questionnaire } from '../../../../src/domain/questionnaire'
import { expect } from '../../../utils'

function uneCommand(
  args: Partial<GenererPlanActionCommand> = {}
): GenererPlanActionCommand {
  return {
    idJeune: 'id-jeune',
    situation: Questionnaire.Situation.LYCEE,
    besoins: [Questionnaire.Besoin.ALTERNANCE],
    contraintes: [],
    ...args
  }
}

describe('plan-action.mapper', () => {
  describe('toQuestionnaire', () => {
    it('relaie la structure, la situation et les besoins', () => {
      // When
      const questionnaire = toQuestionnaire(
        uneCommand({
          situation: Questionnaire.Situation.EMPLOI,
          besoins: [Questionnaire.Besoin.FORMER, Questionnaire.Besoin.EMPLOI]
        }),
        Profil.Structure.MILO
      )

      // Then
      expect(questionnaire).to.deep.equal({
        structure: Profil.Structure.MILO,
        situation: Questionnaire.Situation.EMPLOI,
        besoins: [Questionnaire.Besoin.FORMER, Questionnaire.Besoin.EMPLOI],
        contraintes: []
      })
    })

    it('applique les règles du questionnaire aux contraintes', () => {
      // When
      const questionnaire = toQuestionnaire(
        uneCommand({
          contraintes: [
            Questionnaire.Contrainte.RIEN_NE_ME_BLOQUE,
            Questionnaire.Contrainte.PAS_DE_TRANSPORT
          ]
        }),
        Profil.Structure.INVITE
      )

      // Then
      expect(questionnaire.contraintes).to.deep.equal([
        Questionnaire.Contrainte.RIEN_NE_ME_BLOQUE
      ])
    })

    it('relaie la date de naissance et les communes quand elles sont renseignées', () => {
      // Given
      const dateNaissance = DateTime.fromISO('2006-05-12')
      const rouen = { codeInsee: '76540', nom: 'Rouen' }
      const fortDeFrance = { codeInsee: '97209', nom: 'Fort-de-France' }

      // When
      const questionnaire = toQuestionnaire(
        uneCommand({
          dateNaissance,
          communeResidence: fortDeFrance,
          communeRecherche: rouen
        }),
        Profil.Structure.INVITE
      )

      // Then
      expect(questionnaire.dateNaissance).to.equal(dateNaissance)
      expect(questionnaire.communeResidence).to.deep.equal(fortDeFrance)
      expect(questionnaire.communeRecherche).to.deep.equal(rouen)
    })

    it("ne produit ni date de naissance ni commune quand rien n'est renseigné", () => {
      // When
      const questionnaire = toQuestionnaire(
        uneCommand(),
        Profil.Structure.INVITE
      )

      // Then
      expect(questionnaire).to.not.have.property('dateNaissance')
      expect(questionnaire).to.not.have.property('communeResidence')
      expect(questionnaire).to.not.have.property('communeRecherche')
    })
  })

  describe('toPlanActionQueryModel', () => {
    function uneSolution(
      args: Partial<PlanAction.Solution> = {}
    ): PlanAction.Solution {
      return {
        id: 'p-1',
        category: Questionnaire.Besoin.ALTERNANCE,
        blocker: null,
        situations: [],
        structures: [],
        minAge: null,
        maxAge: null,
        territory: null,
        kind: 'advice',
        label: 'Je fais une action',
        url: null,
        serviceName: null,
        ...args
      }
    }

    function unPlan(solutions: PlanAction.Solution[]): PlanAction.Plan {
      return {
        id: 'plan-1',
        objectifs: [
          {
            id: 'objective-1',
            titre: 'Trouver une alternance',
            theme: Questionnaire.Besoin.ALTERNANCE,
            solutions
          }
        ]
      }
    }

    it("recopie l'id du plan et les objectifs (id, titre, theme)", () => {
      // When
      const queryModel = toPlanActionQueryModel(unPlan([]))

      // Then
      expect(queryModel).to.deep.equal({
        id: 'plan-1',
        objectives: [
          {
            id: 'objective-1',
            titre: 'Trouver une alternance',
            theme: 'ALTERNANCE',
            actions: []
          }
        ]
      })
    })

    it('mappe link vers LIEN avec url et service', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan([
          uneSolution({
            kind: 'link',
            url: 'https://exemple.fr',
            serviceName: 'Exemple'
          })
        ])
      )

      // Then
      expect(queryModel.objectives[0].actions[0]).to.deep.equal({
        id: 'p-1',
        libelle: 'Je fais une action',
        type: TypeActionPlan.LIEN,
        url: 'https://exemple.fr',
        nomService: 'Exemple'
      })
    })

    it('mappe app vers NAVIGATION', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan([uneSolution({ kind: 'app' })])
      )

      // Then
      expect(queryModel.objectives[0].actions[0].type).to.equal(
        TypeActionPlan.NAVIGATION
      )
    })

    it("mappe advice vers CONSEIL, sans url ni service quand la solution n'en a pas", () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan([uneSolution({ kind: 'advice' })])
      )

      // Then
      expect(queryModel.objectives[0].actions[0]).to.deep.equal({
        id: 'p-1',
        libelle: 'Je fais une action',
        type: TypeActionPlan.CONSEIL
      })
    })
  })
})
