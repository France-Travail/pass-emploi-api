import { PlanAction } from '../../../src/domain/plan-action'
import { CatalogueSolutionsStatique } from '../../../src/infrastructure/plan-action/catalogue-solutions-statique'
import { expect } from '../../utils'

// Invariants du référentiel embarqué, vérifiés à chaque régénération : les
// valeurs fermées (envies, blocages, situations…) sont déjà garanties par le
// typage de referentiel-solutions.ts
describe('CatalogueSolutionsStatique', () => {
  const solutions = new CatalogueSolutionsStatique().getSolutions()

  it('embarque un référentiel non vide aux ids uniques', () => {
    // Then
    expect(solutions.length).to.be.greaterThan(150)
    expect(new Set(solutions.map(solution => solution.id)).size).to.equal(
      solutions.length
    )
  })

  it('porte une envie ou un blocage sur chaque solution, jamais les deux', () => {
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

  it("couvre toutes les envies de l'onboarding", () => {
    // Then
    const envies = new Set(solutions.map(solution => solution.category))
    const enviesSansSolution = Object.keys(PlanAction.TITRES_ENVIES).filter(
      envie => !envies.has(envie as PlanAction.Envie)
    )
    expect(enviesSansSolution).to.deep.equal([])
  })

  it('couvre les blocages qui ont des solutions dans le référentiel', () => {
    // PAS_DE_DIPLOME et PEU_EXPERIENCE n'ont pas encore de solution dans le
    // Grist (trou connu du référentiel) ; AUTRE et RIEN_NE_ME_BLOQUE n'en ont
    // jamais par construction
    const blocagesAttendus: PlanAction.Blocage[] = [
      'PAS_DE_PERMIS',
      'PAS_DE_TRANSPORT',
      'PAS_DE_LOGEMENT',
      'MANQUE_CONFIANCE',
      'FIN_DE_MOIS',
      'GARDE_ENFANT',
      'NUMERIQUE',
      'HANDICAP',
      'SANTE',
      'FRANCAIS'
    ]

    // Then
    const blocages = new Set(solutions.map(solution => solution.blocker))
    const blocagesSansSolution = blocagesAttendus.filter(
      blocage => !blocages.has(blocage)
    )
    expect(blocagesSansSolution).to.deep.equal([])
  })
})
