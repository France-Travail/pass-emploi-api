import { Questionnaire } from '../../../../src/domain/questionnaire'
import { ReferentielPlanActionStatique } from '../../../../src/infrastructure/clients/plan-action/referentiel-plan-action-statique'
import { expect } from '../../../utils'

// Invariants du référentiel embarqué, vérifiés à chaque régénération : les
// valeurs fermées (besoins, contraintes, situations…) sont déjà garanties par le
// typage de referentiel-plan-action.ts
describe('ReferentielPlanActionStatique', () => {
  const solutions = new ReferentielPlanActionStatique().getSolutions()

  it('embarque un référentiel non vide aux ids uniques', () => {
    // Then
    expect(solutions.length).to.be.greaterThan(150)
    expect(new Set(solutions.map(solution => solution.id)).size).to.equal(
      solutions.length
    )
  })

  it('porte un besoin ou une contrainte sur chaque solution, jamais les deux', () => {
    // Then
    const invalides = solutions.filter(
      solution => Boolean(solution.category) === Boolean(solution.blocker)
    )
    expect(invalides.map(solution => solution.id)).to.deep.equal([])
  })

  it('a un libellé sur chaque solution', () => {
    // Then
    const sansLibelle = solutions.filter(solution => !solution.label.trim())
    expect(sansLibelle.map(solution => solution.id)).to.deep.equal([])
  })

  it('a une URL http(s) sur chaque lien web', () => {
    // Then
    const liensInvalides = solutions.filter(
      solution =>
        solution.kind === 'link' && !/^https?:\/\//.test(solution.url ?? '')
    )
    expect(liensInvalides.map(solution => solution.id)).to.deep.equal([])
  })

  it("couvre tous les besoins de l'onboarding", () => {
    // Then
    const besoins = new Set(solutions.map(solution => solution.category))
    const besoinsSansSolution = Object.values(Questionnaire.Besoin).filter(
      besoin => !besoins.has(besoin)
    )
    expect(besoinsSansSolution).to.deep.equal([])
  })

  it('couvre les contraintes qui ont des solutions dans le référentiel', () => {
    // PAS_DE_DIPLOME et PEU_EXPERIENCE n'ont pas encore de solution dans le
    // Grist (trou connu du référentiel) ; AUTRE et RIEN_NE_ME_BLOQUE n'en ont
    // jamais par construction
    const contraintesAttendues = Object.values(Questionnaire.Contrainte).filter(
      contrainte =>
        ![
          Questionnaire.Contrainte.PAS_DE_DIPLOME,
          Questionnaire.Contrainte.PEU_EXPERIENCE,
          Questionnaire.Contrainte.AUTRE,
          Questionnaire.Contrainte.RIEN_NE_ME_BLOQUE
        ].includes(contrainte)
    )

    // Then
    const contraintes = new Set(solutions.map(solution => solution.blocker))
    const contraintesSansSolution = contraintesAttendues.filter(
      contrainte => !contraintes.has(contrainte)
    )
    expect(contraintesSansSolution).to.deep.equal([])
  })
})
