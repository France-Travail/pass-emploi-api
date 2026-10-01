import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { DateService } from '../../utils/date-service'
import { IdService } from '../../utils/id-service'
import { Questionnaire } from './questionnaire'
import { ReferentielPlanAction } from './referentiel-plan-action'

export const PlanActionRepositoryToken = 'PlanActionRepositoryToken'

// Plan d'action suggéré au jeune à la fin de l'onboarding, puis conservé pour
// qu'il retrouve ses tâches et leur avancement d'une session à l'autre
export interface PlanAction {
  id: string
  idJeune: string
  dateCreation: DateTime
  objectifs: PlanAction.Objectif[]
}

export namespace PlanAction {
  export interface Objectif {
    id: string
    titre: string
    theme: Questionnaire.Besoin | Questionnaire.Contrainte
    taches: Tache[]
  }

  // Une solution du référentiel rendue adressable : c'est la tâche, pas la
  // solution, que le jeune coche
  export interface Tache {
    id: string
    idSolution: string
    terminee: boolean
    dateCreation: DateTime
    dateTerminee?: DateTime
    dateSuppression?: DateTime
  }

  export interface Repository {
    save(plan: PlanAction): Promise<void>

    getDernierPlan(idJeune: string): Promise<PlanAction | undefined>

    getTache(idJeune: string, idTache: string): Promise<Tache | undefined>

    saveTache(tache: Tache): Promise<void>

    supprimerTache(idTache: string, dateSuppression: DateTime): Promise<void>
  }

  export function changerStatutTache(
    tache: Tache,
    terminee: boolean,
    maintenant: DateTime
  ): Tache {
    if (tache.terminee === terminee) return tache

    const { dateTerminee: _dateTerminee, ...tacheSansDateTerminee } = tache
    return terminee
      ? { ...tacheSansDateTerminee, terminee, dateTerminee: maintenant }
      : { ...tacheSansDateTerminee, terminee }
  }

  export const TITRES_BESOINS: Record<Questionnaire.Besoin, string> = {
    ORIENTER: "Je cherche à m'orienter",
    DECOUVRIR_METIERS: 'Découvrir des métiers',
    FORMER: 'Me former, me qualifier',
    STAGE_IMMERSION: 'Un stage ou une immersion',
    ALTERNANCE: 'Trouver une alternance',
    EMPLOI: 'Trouver un emploi',
    ENGAGER: "M'engager",
    MOBILITE_INTERNATIONALE: 'Ma mobilité internationale',
    ACCOMPAGNE: 'Être accompagné dans mes démarches',
    CREER_ACTIVITE: 'Créer mon activité',
    VIE_QUOTIDIENNE: 'Ma vie quotidienne'
  }

  export const TITRES_CONTRAINTES: Record<Questionnaire.Contrainte, string> = {
    PAS_DE_PERMIS: 'Passer mon permis',
    PAS_DE_TRANSPORT: 'Me déplacer plus facilement',
    PAS_DE_LOGEMENT: 'Trouver un logement',
    MANQUE_CONFIANCE: 'Ma confiance en moi',
    FIN_DE_MOIS: 'Boucler mes fins de mois',
    PAS_DE_DIPLOME: 'Valider mon expérience',
    PEU_EXPERIENCE: 'Gagner en expérience',
    HANDICAP: 'Être accompagné avec mon handicap',
    SANTE: 'Prendre soin de ma santé',
    GARDE_ENFANT: 'Faire garder mon enfant',
    NUMERIQUE: 'Le numérique',
    FRANCAIS: 'Progresser en français',
    AUTRE: 'Lever mes blocages',
    RIEN_NE_ME_BLOQUE: 'Rien ne me bloque'
  }

  export function filtrerSolutionsEligibles(args: {
    questionnaire: Questionnaire
    solutions: ReferentielPlanAction.Solution[]
    maintenant: DateTime
  }): ReferentielPlanAction.Solution[] {
    const { questionnaire, solutions, maintenant } = args
    const age = Questionnaire.calculerAge(questionnaire, maintenant)
    return solutions.filter(
      solution =>
        matchTheme(questionnaire, solution) &&
        matchStructure(questionnaire, solution) &&
        matchSituation(questionnaire, solution) &&
        matchAge(age, solution) &&
        matchTerritoire(questionnaire, solution)
    )
  }

  function matchTheme(
    questionnaire: Questionnaire,
    solution: ReferentielPlanAction.Solution
  ): boolean {
    const repondAUnBesoinDuJeune =
      solution.besoin !== undefined &&
      questionnaire.besoins.includes(solution.besoin)
    const leveUneContrainteDuJeune =
      solution.contrainte !== undefined &&
      questionnaire.contraintes.includes(solution.contrainte)

    return repondAUnBesoinDuJeune || leveUneContrainteDuJeune
  }

  function matchStructure(
    questionnaire: Questionnaire,
    solution: ReferentielPlanAction.Solution
  ): boolean {
    return (
      solution.authentifications.length === 0 ||
      solution.authentifications.includes(questionnaire.structure)
    )
  }

  function matchSituation(
    questionnaire: Questionnaire,
    solution: ReferentielPlanAction.Solution
  ): boolean {
    return (
      solution.situations.length === 0 ||
      solution.situations.includes(questionnaire.situation)
    )
  }

  function matchAge(
    age: number | undefined,
    solution: ReferentielPlanAction.Solution
  ): boolean {
    if (age === undefined) return true
    if (solution.ageMin !== undefined && age < solution.ageMin) return false
    if (solution.ageMax !== undefined && age > solution.ageMax) return false
    return true
  }

  function matchTerritoire(
    questionnaire: Questionnaire,
    solution: ReferentielPlanAction.Solution
  ): boolean {
    if (!solution.territoires.length) return true
    const departement = Questionnaire.calculerDepartement(questionnaire)
    if (!departement) return false
    // Comparaison en minuscules pour la Corse (2A/2B) : le POC comparait le
    // département en majuscules à un territoire minusculisé et ne matchait jamais ces deux codes
    return solution.territoires
      .flatMap(territoire => territoire.split(','))
      .map(territoire => territoire.trim().toLowerCase())
      .some(territoire =>
        territoire.includes('outre-mer')
          ? departement.startsWith('97') || departement.startsWith('98')
          : territoire === departement.toLowerCase()
      )
  }

  @Injectable()
  export class Factory {
    constructor(
      private readonly idService: IdService,
      private readonly dateService: DateService
    ) {}

    // Un objectif par besoin puis par contrainte du questionnaire, chacun avec
    // toutes les solutions éligibles de son thème, dans l'ordre du référentiel
    creer(
      idJeune: string,
      questionnaire: Questionnaire,
      referentiel: ReferentielPlanAction.Solution[],
      planPrecedent?: PlanAction
    ): PlanAction {
      const maintenant = this.dateService.now()
      // L'identifiant du plan est tiré avant ceux des objectifs et des tâches
      const id = this.idService.uuid()
      const solutionsEligibles = filtrerSolutionsEligibles({
        questionnaire,
        solutions: referentiel,
        maintenant
      })

      const themes = [
        ...Array.from(new Set(questionnaire.besoins)).map(besoin => ({
          theme: besoin,
          titre: TITRES_BESOINS[besoin],
          solutions: solutionsEligibles.filter(
            solution => solution.besoin === besoin
          )
        })),
        ...Array.from(new Set(questionnaire.contraintes)).map(contrainte => ({
          theme: contrainte,
          titre: TITRES_CONTRAINTES[contrainte],
          solutions: solutionsEligibles.filter(
            solution => solution.contrainte === contrainte
          )
        }))
      ]

      const objectifs = themes
        .filter(({ solutions }) => solutions.length > 0)
        .map(({ theme, titre, solutions }) => {
          const tachesPrecedentes =
            planPrecedent?.objectifs.find(objectif => objectif.theme === theme)
              ?.taches ?? []
          return {
            id: this.idService.uuid(),
            titre,
            theme,
            taches: solutions.map(solution => {
              const tachePrecedente = tachesPrecedentes.find(
                tache => tache.idSolution === solution.id
              )
              return tachePrecedente
                ? { ...tachePrecedente, id: this.idService.uuid() }
                : {
                    id: this.idService.uuid(),
                    idSolution: solution.id,
                    terminee: false,
                    dateCreation: maintenant
                  }
            })
          }
        })

      return { id, idJeune, dateCreation: maintenant, objectifs }
    }
  }
}
