import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { DateService } from '../utils/date-service'
import { IdService } from '../utils/id-service'

export const PlanActionCatalogueRepositoryToken =
  'PlanActionCatalogueRepositoryToken'

// Suggestion de plan d'action de l'onboarding app jeune, internalisée depuis
// le POC bayesimpact/1jeune-des-solutions dans son seul mode déterministe :
// un objectif par envie puis par blocage du profil, contenant toutes les
// solutions éligibles du référentiel pour ce thème, dans l'ordre du
// référentiel. La génération LLM du POC (accroche personnalisée, titres
// d'objectifs variables, écart des solutions hors sujet) n'est pas reprise.
export namespace PlanAction {
  export type AuthProvider = 'france-travail' | 'mission-locale' | 'guest'

  export type Situation =
    'COLLEGE' | 'LYCEE' | 'ETUDES_SUPERIEURES' | 'EMPLOI' | 'AUTRE'

  export type Envie =
    | 'ORIENTER'
    | 'DECOUVRIR_METIERS'
    | 'FORMER'
    | 'STAGE_IMMERSION'
    | 'ALTERNANCE'
    | 'EMPLOI'
    | 'ENGAGER'
    | 'MOBILITE_INTERNATIONALE'
    | 'ACCOMPAGNE'
    | 'CREER_ACTIVITE'
    | 'VIE_QUOTIDIENNE'

  // RIEN_NE_ME_BLOQUE est exclusif : combiné à un autre blocage, il est
  // réduit au seul RIEN_NE_ME_BLOQUE par le mapper du payload. AUTRE et
  // RIEN_NE_ME_BLOQUE n'ont jamais de solution dans le référentiel.
  export type Blocage =
    | 'PAS_DE_PERMIS'
    | 'PAS_DE_TRANSPORT'
    | 'PAS_DE_LOGEMENT'
    | 'MANQUE_CONFIANCE'
    | 'FIN_DE_MOIS'
    | 'PAS_DE_DIPLOME'
    | 'PEU_EXPERIENCE'
    | 'HANDICAP'
    | 'SANTE'
    | 'GARDE_ENFANT'
    | 'NUMERIQUE'
    | 'FRANCAIS'
    | 'AUTRE'
    | 'RIEN_NE_ME_BLOQUE'

  export interface Commune {
    codeInsee: string
    nom: string
  }

  // Réponses du questionnaire d'onboarding, dans le vocabulaire du référentiel
  export interface ProfilJeune {
    authProvider: AuthProvider
    situation: Situation
    goals: Envie[]
    obstacles: Blocage[]
    // Format YYYY-MM-DD
    dateNaissance?: string
    habitation?: Commune
    villeRecherche?: Commune
  }

  export type TypeSolution = 'link' | 'app' | 'advice'

  // Une ligne du référentiel « services et solutions » (vocabulaire du back
  // office Grist), réduite aux colonnes que l'app exploite. Une solution
  // porte une envie (category) OU un blocage (blocker), jamais les deux. Une
  // liste vide vaut « pas de filtre ».
  export interface Solution {
    id: string
    category: Envie | null
    blocker: Blocage | null
    situations: Situation[]
    auth: AuthProvider[]
    minAge: number | null
    maxAge: number | null
    // Liste de départements (« 75, 93 ») ou « Territoires d'Outre-mer »
    territory: string | null
    kind: TypeSolution
    label: string
    url: string | null
    serviceName: string | null
  }

  export interface Objectif {
    id: string
    titre: string
    theme: Envie | Blocage
    solutions: Solution[]
  }

  export interface Plan {
    id: string
    objectifs: Objectif[]
  }

  export interface CatalogueRepository {
    getSolutions(): Solution[]
  }

  export function calculerAge(
    profil: ProfilJeune,
    maintenant: DateTime
  ): number | undefined {
    if (!profil.dateNaissance) return undefined
    const naissance = DateTime.fromISO(profil.dateNaissance, { zone: 'utc' })
    if (!naissance.isValid) return undefined
    return Math.floor(maintenant.toUTC().diff(naissance, 'years').years)
  }

  // Code département dérivé du code INSEE de commune : 3 caractères en
  // outre-mer (97x/98x), 2 sinon (couvre la Corse 2A/2B). La ville de
  // recherche prime sur la ville d'habitation.
  export function calculerDepartement(profil: ProfilJeune): string | undefined {
    const codeInsee =
      profil.villeRecherche?.codeInsee ?? profil.habitation?.codeInsee
    if (!codeInsee) return undefined
    return codeInsee.startsWith('97') || codeInsee.startsWith('98')
      ? codeInsee.slice(0, 3)
      : codeInsee.slice(0, 2)
  }

  export function filtrerSolutionsEligibles(args: {
    profil: ProfilJeune
    solutions: Solution[]
    maintenant: DateTime
  }): Solution[] {
    const { profil, solutions, maintenant } = args
    const age = calculerAge(profil, maintenant)
    return solutions.filter(
      solution =>
        matchTheme(profil, solution) &&
        matchAuth(profil, solution) &&
        matchSituation(profil, solution) &&
        matchAge(age, solution) &&
        matchTerritoire(profil, solution)
    )
  }

  function matchTheme(profil: ProfilJeune, solution: Solution): boolean {
    if (solution.category && profil.goals.includes(solution.category))
      return true
    if (solution.blocker && profil.obstacles.includes(solution.blocker))
      return true
    return false
  }

  function matchAuth(profil: ProfilJeune, solution: Solution): boolean {
    return (
      solution.auth.length === 0 || solution.auth.includes(profil.authProvider)
    )
  }

  function matchSituation(profil: ProfilJeune, solution: Solution): boolean {
    return (
      solution.situations.length === 0 ||
      solution.situations.includes(profil.situation)
    )
  }

  function matchAge(age: number | undefined, solution: Solution): boolean {
    if (age === undefined) return true
    if (solution.minAge !== null && age < solution.minAge) return false
    if (solution.maxAge !== null && age > solution.maxAge) return false
    return true
  }

  function matchTerritoire(profil: ProfilJeune, solution: Solution): boolean {
    if (!solution.territory) return true
    const departement = calculerDepartement(profil)
    if (!departement) return false
    const territoire = solution.territory.toLowerCase()
    if (territoire.includes('outre-mer'))
      return departement.startsWith('97') || departement.startsWith('98')
    // Comparaison en minuscules pour la Corse (2A/2B) : le POC comparait le
    // département en majuscules à un territoire minusculisé et ne matchait
    // jamais ces deux codes
    return territoire
      .split(/[,;]/)
      .map(code => code.trim())
      .includes(departement.toLowerCase())
  }

  export const TITRES_ENVIES: Record<Envie, string> = {
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

  export const TITRES_BLOCAGES: Record<Blocage, string> = {
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

  // Un objectif par envie puis par blocage, dans l'ordre du profil, chacun
  // avec toutes les solutions éligibles de son thème dans l'ordre du
  // référentiel. Les thèmes sans solution sont sautés. Les ids d'objectifs
  // sont positionnels comme dans le POC : l'app y rattache la progression du
  // jeune (actions cochées ou supprimées) d'une génération à l'autre.
  export function construirePlan(args: {
    profil: ProfilJeune
    solutionsEligibles: Solution[]
    id: string
  }): Plan {
    const { profil, solutionsEligibles, id } = args
    const objectifs: Objectif[] = []

    function ajouterObjectif(
      theme: Envie | Blocage,
      titre: string,
      solutions: Solution[]
    ): void {
      if (solutions.length === 0) return
      objectifs.push({
        id: `objective-${objectifs.length + 1}`,
        titre,
        theme,
        solutions
      })
    }

    for (const envie of new Set(profil.goals)) {
      ajouterObjectif(
        envie,
        TITRES_ENVIES[envie],
        solutionsEligibles.filter(solution => solution.category === envie)
      )
    }
    for (const blocage of new Set(profil.obstacles)) {
      ajouterObjectif(
        blocage,
        TITRES_BLOCAGES[blocage],
        solutionsEligibles.filter(solution => solution.blocker === blocage)
      )
    }

    return { id, objectifs }
  }

  @Injectable()
  export class Service {
    constructor(
      @Inject(PlanActionCatalogueRepositoryToken)
      private readonly catalogue: CatalogueRepository,
      private readonly idService: IdService,
      private readonly dateService: DateService
    ) {}

    genererPlan(profil: ProfilJeune): Plan {
      const solutionsEligibles = filtrerSolutionsEligibles({
        profil,
        solutions: this.catalogue.getSolutions(),
        maintenant: this.dateService.now()
      })
      return construirePlan({
        profil,
        solutionsEligibles,
        id: this.idService.uuid()
      })
    }
  }
}
