import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { isSuccess, Result } from '../building-blocks/types/result'
import { DateService } from '../utils/date-service'
import { IdService } from '../utils/id-service'
import { Core, estInvite, estMilo } from './core'

export const PlanActionCatalogueRepositoryToken =
  'PlanActionCatalogueRepositoryToken'
export const PlanActionGenerateurToken = 'PlanActionGenerateurToken'

// Génération de la suggestion de plan d'action de l'onboarding app jeune,
// internalisée depuis le POC bayesimpact/1jeune-des-solutions. Le générateur
// (LLM ou secours) ne produit que des références aux ids du référentiel : la
// matérialisation jette tout id inventé et re-trie selon l'ordre du
// référentiel, il ne peut donc pas halluciner une action ou une URL.
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
  // réduit au seul RIEN_NE_ME_BLOQUE par le mapper du payload.
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

  export interface Profil {
    authProvider: AuthProvider
    situation: Situation
    goals: Envie[]
    obstacles: Blocage[]
    // Date de naissance au format YYYY-MM-DD
    dateNaissance?: string
    // Texte libre, null = « Je ne sais pas encore »
    domaine?: string | null
    habitation?: Commune
    villeRecherche?: Commune
    rayonKm?: number
  }

  export type TypeSolution = 'link' | 'app' | 'advice'

  // Une ligne du référentiel « services et solutions » (vocabulaire du back
  // office Grist : une solution porte une envie (category) OU un blocage
  // (blocker), jamais les deux ; les listes vides valent « pas de filtre »
  export interface Solution {
    id: string
    category: Envie | null
    subCategory: string | null
    blocker: Blocage | null
    need: string | null
    situations: Situation[]
    auth: AuthProvider[]
    minAge: number | null
    maxAge: number | null
    territory: string | null
    domain: string | null
    kind: TypeSolution
    label: string
    url: string | null
    deepLink: string | null
    serviceName: string | null
    serviceDescription: string | null
  }

  // Ce que le générateur (LLM ou secours) a le droit de produire : une
  // accroche, des titres, et des références aux ids du référentiel —
  // jamais d'action libre
  export interface Ebauche {
    greeting: string
    objectives: Array<{
      title: string
      theme: string
      solutionIds: string[]
    }>
    // Modèle qui a produit l'ébauche, absent sur l'ébauche de secours
    model?: string
  }

  export interface Action {
    id: string
    label: string
    kind: TypeSolution
    url?: string
    deepLink?: string
    serviceName?: string
    serviceDescription?: string
  }

  export interface Objectif {
    id: string
    title: string
    // Valeur d'Envie ou de Blocage que l'objectif adresse
    theme: string
    actions: Action[]
  }

  export interface Plan {
    id: string
    greeting: string
    objectives: Objectif[]
    generatedAt: string
    generator: 'llm' | 'fallback'
    // Modèle qui a réellement produit le plan, absent sur un plan de secours
    model?: string
  }

  export interface CatalogueRepository {
    getSolutions(): Solution[]
  }

  export interface Generateur {
    generer(args: {
      profil: Profil
      solutionsEligibles: Solution[]
    }): Promise<Result<Ebauche>>
  }

  export function calculerAge(
    profil: Profil,
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
  export function calculerDepartement(profil: Profil): string | undefined {
    const codeInsee =
      profil.villeRecherche?.codeInsee ?? profil.habitation?.codeInsee
    if (!codeInsee) return undefined
    return codeInsee.startsWith('97') || codeInsee.startsWith('98')
      ? codeInsee.slice(0, 3)
      : codeInsee.slice(0, 2)
  }

  export function filtrerSolutionsEligibles(args: {
    profil: Profil
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

  function matchTheme(profil: Profil, solution: Solution): boolean {
    if (solution.category && profil.goals.includes(solution.category))
      return true
    if (solution.blocker && profil.obstacles.includes(solution.blocker))
      return true
    return false
  }

  function matchAuth(profil: Profil, solution: Solution): boolean {
    return (
      solution.auth.length === 0 || solution.auth.includes(profil.authProvider)
    )
  }

  function matchSituation(profil: Profil, solution: Solution): boolean {
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

  function matchTerritoire(profil: Profil, solution: Solution): boolean {
    if (!solution.territory) return true
    const departement = calculerDepartement(profil)
    if (!departement) return false
    const territoire = solution.territory.toLowerCase()
    if (territoire.includes('outre-mer'))
      return departement.startsWith('97') || departement.startsWith('98')
    // Comparaison en minuscules pour la Corse (2A/2B), le POC comparait le
    // département en majuscules à un territoire minusculisé et ne matchait
    // jamais ces deux codes
    return territoire
      .split(/[,;]/)
      .map(code => code.trim())
      .includes(departement.toLowerCase())
  }

  // Un objectif par envie sélectionnée plus un par blocage coché : le
  // générateur ne peut pas produire plus de thèmes que le profil n'en porte
  function maxObjectifs(profil: Profil): number {
    return profil.goals.length + profil.obstacles.length
  }

  // Le payload app jeune ne transporte pas de prénom : l'accroche par défaut
  // est générique (l'accroche personnalisée reste au générateur LLM)
  const ACCROCHE_PAR_DEFAUT =
    "Salut ! Voici ton plan d'action, coche les actions au fur et à mesure."

  const TITRE_PAR_DEFAUT = 'Mes prochaines actions'

  // Titres utilisés par l'ébauche de secours uniquement : sur le chemin LLM
  // les titres sont générés à chaque appel
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

  // Ébauche déterministe utilisée quand le LLM est indisponible : un objectif
  // par envie puis par blocage, actions dans l'ordre du référentiel
  export function construireEbaucheDeSecours(args: {
    profil: Profil
    solutionsEligibles: Solution[]
  }): Ebauche {
    const { profil, solutionsEligibles } = args
    const objectives: Ebauche['objectives'] = []

    for (const envie of profil.goals) {
      const solutions = solutionsEligibles.filter(s => s.category === envie)
      if (solutions.length === 0) continue
      objectives.push({
        title: TITRES_ENVIES[envie] ?? envie,
        theme: envie,
        solutionIds: solutions.map(s => s.id)
      })
    }

    for (const blocage of profil.obstacles) {
      const solutions = solutionsEligibles.filter(s => s.blocker === blocage)
      if (solutions.length === 0) continue
      objectives.push({
        title: TITRES_BLOCAGES[blocage] ?? blocage,
        theme: blocage,
        solutionIds: solutions.map(s => s.id)
      })
    }

    return {
      greeting: ACCROCHE_PAR_DEFAUT,
      objectives: objectives.slice(0, maxObjectifs(profil))
    }
  }

  // Transforme une ébauche (ids seulement) en plan complet. Tout id absent du
  // catalogue éligible est jeté : le générateur ne peut pas inventer
  // d'action. Les actions sont re-triées dans l'ordre du référentiel, quel
  // que soit l'ordre renvoyé par le générateur.
  export function materialiserPlan(args: {
    ebauche: Ebauche
    solutionsEligibles: Solution[]
    profil: Profil
    generateur: Plan['generator']
    idPlan: string
    genereLe: string
  }): Plan {
    const {
      ebauche,
      solutionsEligibles,
      profil,
      generateur,
      idPlan,
      genereLe
    } = args
    const parId = new Map(solutionsEligibles.map(s => [s.id, s]))
    const ordreCatalogue = new Map(solutionsEligibles.map((s, i) => [s.id, i]))
    const dejaUtilisees = new Set<string>()
    const objectives: Objectif[] = []

    for (const objectif of ebauche.objectives) {
      const idsOrdonnes = [...objectif.solutionIds].sort(
        (a, b) =>
          (ordreCatalogue.get(a) ?? Number.MAX_SAFE_INTEGER) -
          (ordreCatalogue.get(b) ?? Number.MAX_SAFE_INTEGER)
      )
      const actions: Action[] = []
      for (const id of idsOrdonnes) {
        const solution = parId.get(id)
        if (!solution || dejaUtilisees.has(id)) continue
        dejaUtilisees.add(id)
        actions.push({
          id: solution.id,
          label: solution.label,
          kind: solution.kind,
          ...(solution.url ? { url: solution.url } : {}),
          ...(solution.deepLink ? { deepLink: solution.deepLink } : {}),
          ...(solution.serviceName
            ? { serviceName: solution.serviceName }
            : {}),
          ...(solution.serviceDescription
            ? { serviceDescription: solution.serviceDescription }
            : {})
        })
      }
      if (actions.length === 0) continue
      objectives.push({
        id: `objective-${objectives.length + 1}`,
        title: objectif.title.trim() || TITRE_PAR_DEFAUT,
        theme: objectif.theme,
        actions
      })
      if (objectives.length === maxObjectifs(profil)) break
    }

    return {
      id: idPlan,
      greeting: ebauche.greeting.trim() || ACCROCHE_PAR_DEFAUT,
      objectives,
      generatedAt: genereLe,
      generator: generateur,
      ...(generateur === 'llm' && ebauche.model ? { model: ebauche.model } : {})
    }
  }

  export function authProviderDe(structure: Core.Structure): AuthProvider {
    if (estInvite(structure)) return 'guest'
    if (estMilo(structure)) return 'mission-locale'
    return 'france-travail'
  }

  @Injectable()
  export class Service {
    constructor(
      @Inject(PlanActionCatalogueRepositoryToken)
      private readonly catalogue: CatalogueRepository,
      @Inject(PlanActionGenerateurToken)
      private readonly generateur: Generateur,
      private readonly idService: IdService,
      private readonly dateService: DateService
    ) {}

    // Ne peut pas échouer : si le générateur LLM est indisponible ou renvoie
    // une ébauche inutilisable, l'ébauche de secours produit la même
    // structure avec des titres fixes
    async genererPlan(profil: Profil): Promise<Plan> {
      const maintenant = this.dateService.now()
      const solutionsEligibles = filtrerSolutionsEligibles({
        profil,
        solutions: this.catalogue.getSolutions(),
        maintenant
      })

      let ebauche: Ebauche
      let generateur: Plan['generator'] = 'llm'
      const resultatLlm = await this.generateur.generer({
        profil,
        solutionsEligibles
      })
      if (isSuccess(resultatLlm)) {
        ebauche = resultatLlm.data
      } else {
        ebauche = construireEbaucheDeSecours({ profil, solutionsEligibles })
        generateur = 'fallback'
      }

      const idPlan = this.idService.uuid()
      const genereLe = maintenant.toISO()!

      let plan = materialiserPlan({
        ebauche,
        solutionsEligibles,
        profil,
        generateur,
        idPlan,
        genereLe
      })
      if (plan.objectives.length === 0 && generateur === 'llm') {
        plan = materialiserPlan({
          ebauche: construireEbaucheDeSecours({ profil, solutionsEligibles }),
          solutionsEligibles,
          profil,
          generateur: 'fallback',
          idPlan,
          genereLe
        })
      }
      return plan
    }
  }
}
