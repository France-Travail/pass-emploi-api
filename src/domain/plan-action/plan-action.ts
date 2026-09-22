import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Profil } from '../profil'
import { IdService } from '../../utils/id-service'
import { DateService } from '../../utils/date-service'
import { ReferentielPlanAction } from './referentiel-plan-action'

export const PlanActionRepositoryToken = 'PlanActionRepositoryToken'
export const GenerateurDePlanActionToken = 'GenerateurDePlanActionToken'

export interface PlanAction {
  id: string
  idJeune: string
  dateCreation: DateTime
  objectifs: PlanAction.Objectif[]
}

type ProfilStructure = Profil.Structure

export namespace PlanAction {
  export enum TypeTache {
    LIEN = 'LIEN',
    NAVIGATION = 'NAVIGATION',
    CONSEIL = 'CONSEIL'
  }

  export enum Destination {
    OFFRES_ALTERNANCE = 'OFFRES_ALTERNANCE',
    OFFRES_SERVICE_CIVIQUE = 'OFFRES_SERVICE_CIVIQUE',
    OFFRES_EMPLOI = 'OFFRES_EMPLOI',
    ALLER_VERS = 'ALLER_VERS',
    EVENEMENTS = 'EVENEMENTS'
  }

  export enum Besoin {
    ORIENTER = 'ORIENTER',
    DECOUVRIR_METIERS = 'DECOUVRIR_METIERS',
    FORMER = 'FORMER',
    STAGE_IMMERSION = 'STAGE_IMMERSION',
    ALTERNANCE = 'ALTERNANCE',
    EMPLOI = 'EMPLOI',
    ENGAGER = 'ENGAGER',
    MOBILITE_INTERNATIONALE = 'MOBILITE_INTERNATIONALE',
    ACCOMPAGNE = 'ACCOMPAGNE',
    CREER_ACTIVITE = 'CREER_ACTIVITE',
    VIE_QUOTIDIENNE = 'VIE_QUOTIDIENNE'
  }

  export enum Contrainte {
    PAS_DE_PERMIS = 'PAS_DE_PERMIS',
    PAS_DE_TRANSPORT = 'PAS_DE_TRANSPORT',
    PAS_DE_LOGEMENT = 'PAS_DE_LOGEMENT',
    MANQUE_CONFIANCE = 'MANQUE_CONFIANCE',
    FIN_DE_MOIS = 'FIN_DE_MOIS',
    HANDICAP = 'HANDICAP',
    SANTE = 'SANTE',
    GARDE_ENFANT = 'GARDE_ENFANT',
    NUMERIQUE = 'NUMERIQUE',
    PAS_DE_DIPLOME = 'PAS_DE_DIPLOME',
    PEU_EXPERIENCE = 'PEU_EXPERIENCE',
    FRANCAIS = 'FRANCAIS'
  }

  export interface Objectif {
    id: string
    titre: string
    theme: string
    taches: Tache[]
  }

  export interface Tache {
    id: string
    idSolution: string
    terminee: boolean
    dateCreation: DateTime
    dateTerminee?: DateTime
  }

  export interface Commune {
    codeInsee: string
    nom: string
  }

  export interface Profil {
    structure: ProfilStructure
    situation: string
    besoins: Besoin[]
    contraintes: Contrainte[]
    dateNaissance?: DateTime
    domaine?: string
    habitation?: Commune
    villeRecherche?: Commune
    rayonKm?: number
  }

  export interface SuggestionObjectif {
    titre: string
    theme: string
    idsSolutions: string[]
  }

  export interface Suggestion {
    accroche: string
    genereLe: DateTime
    generateur: string
    objectifs: SuggestionObjectif[]
  }

  export interface Generateur {
    genererPlan(profil: Profil): Promise<Result<Suggestion>>
  }

  export interface Repository {
    save(plan: PlanAction): Promise<void>

    getDernierPlan(idJeune: string): Promise<PlanAction | undefined>
  }

  export class Factory {
    constructor(
      private readonly idService: IdService,
      private readonly dateService: DateService
    ) {}

    creer(
      idJeune: string,
      suggestion: Suggestion,
      solutions: ReferentielPlanAction.Solution[]
    ): Result<PlanAction> {
      const idsConnus = new Set(solutions.map(solution => solution.id))
      const maintenant = this.dateService.now()
      const id = this.idService.uuid()

      const objectifs = suggestion.objectifs
        .map(objectif =>
          this.construireObjectif(objectif, idsConnus, maintenant)
        )
        .filter((objectif): objectif is Objectif => objectif !== undefined)

      if (!objectifs.length) {
        return failure(
          new MauvaiseCommandeError(
            "Aucune solution du plan d'action généré n'est présente dans le référentiel"
          )
        )
      }

      return success({ id, idJeune, dateCreation: maintenant, objectifs })
    }

    private construireObjectif(
      objectif: SuggestionObjectif,
      idsConnus: Set<string>,
      maintenant: DateTime
    ): Objectif | undefined {
      const idsRetenus = Array.from(new Set(objectif.idsSolutions)).filter(
        idSolution => idsConnus.has(idSolution)
      )
      if (!idsRetenus.length) return undefined

      return {
        id: this.idService.uuid(),
        titre: objectif.titre,
        theme: objectif.theme,
        taches: idsRetenus.map(idSolution => ({
          id: this.idService.uuid(),
          idSolution,
          terminee: false,
          dateCreation: maintenant
        }))
      }
    }
  }
}
