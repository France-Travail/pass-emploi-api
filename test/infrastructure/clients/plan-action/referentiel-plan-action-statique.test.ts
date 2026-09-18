import { PlanAction } from '../../../../src/domain/plan-action'
import { ReferentielPlanActionStatique } from '../../../../src/infrastructure/clients/plan-action/referentiel-plan-action-statique'
import { expect } from '../../../utils'

// Invariants du référentiel embarqué, vérifiés à chaque régénération : les
// valeurs fermées (objectifs, obstacles, situations…) sont déjà garanties par le
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

  it('porte une objectif ou un obstacle sur chaque solution, jamais les deux', () => {
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

  it("couvre toutes les objectifs de l'onboarding", () => {
    // Then
    const objectifs = new Set(solutions.map(solution => solution.category))
    const objectifsSansSolution = Object.values(PlanAction.Objectif).filter(
      objectif => !objectifs.has(objectif)
    )
    expect(objectifsSansSolution).to.deep.equal([])
  })

  it('couvre les obstacles qui ont des solutions dans le référentiel', () => {
    // PAS_DE_DIPLOME et PEU_EXPERIENCE n'ont pas encore de solution dans le
    // Grist (trou connu du référentiel) ; AUTRE et RIEN_NE_ME_BLOQUE n'en ont
    // jamais par construction
    const obstaclesAttendus = Object.values(PlanAction.Obstacle).filter(
      obstacle =>
        ![
          PlanAction.Obstacle.PAS_DE_DIPLOME,
          PlanAction.Obstacle.PEU_EXPERIENCE,
          PlanAction.Obstacle.AUTRE,
          PlanAction.Obstacle.RIEN_NE_ME_BLOQUE
        ].includes(obstacle)
    )

    // Then
    const obstacles = new Set(solutions.map(solution => solution.blocker))
    const obstaclesSansSolution = obstaclesAttendus.filter(
      obstacle => !obstacles.has(obstacle)
    )
    expect(obstaclesSansSolution).to.deep.equal([])
  })
})
