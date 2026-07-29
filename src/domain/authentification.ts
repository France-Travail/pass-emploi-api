import { Injectable } from '@nestjs/common'
import { ConseillerNonValide } from '../building-blocks/types/domain-error'
import { failure, Result, success } from '../building-blocks/types/result'
import { IdService } from '../utils/id-service'
import { Core } from './core'

export const AuthentificationRepositoryToken = 'Authentification.Repository'

export namespace Authentification {
  export enum Type {
    JEUNE = 'JEUNE',
    CONSEILLER = 'CONSEILLER',
    SUPPORT = 'SUPPORT'
  }
  export type JeuneOuConseiller =
    Authentification.Type.JEUNE | Authentification.Type.CONSEILLER

  export enum Role {
    SUPERVISEUR = 'SUPERVISEUR'
  }

  export const METADATA_IDENTIFIER_API_KEY_PARTENAIRE = 'partenaire'

  export enum Partenaire {
    KEYCLOAK = 'KEYCLOAK',
    IMMERSION = 'IMMERSION',
    POLE_EMPLOI = 'POLE_EMPLOI',
    SUPPORT = 'SUPPORT',
    ADMIN = 'ADMIN'
  }

  export function unUtilisateurSupport(): Utilisateur {
    return {
      id: 'SUPPORT',
      prenom: 'support',
      nom: 'cej',
      // @ts-expect-error structure utilisateur SUPPORT inutile ailleurs
      structure: 'SUPPORT',
      type: Authentification.Type.SUPPORT,
      roles: []
    }
  }

  export interface Utilisateur {
    id: string
    /**
     * Identifiant de l'utilisateur chez son fournisseur d'identité. Son format
     * dépend de la structure et n'est PAS uniforme :
     *
     * - FT (`POLE_EMPLOI*`, `FT_*`, `AVENIR_PRO`) : sub de l'IDP France Travail,
     *   qui est aussi l'`idExterneDE`. Format imposé par FT, et consommé comme
     *   tel — cf. `notifier-rendez-vous-pole-emploi.job.handler` (rapprochement
     *   avec `idExterneDE`) et `get-demarches.query.getter` (token exchange).
     *   Ne jamais le traiter comme une clé opaque réattribuable.
     * - MILO : sub Keycloak Milo (uuid). Deux producteurs : Connect via
     *   `PUT /auth/users/:idAuthentification`, et `CreerJeuneMiloCommandHandler`
     *   via l'`idKeycloak` renvoyé par le client Milo.
     * - CONSEIL_DEPT : sub de l'IDP départemental.
     * - PASS_EMPLOI (comptes de recette créés à la main) : username Keycloak,
     *   égal à `id` par convention — cf. `docs/CONTRIBUTING.md`.
     * - INVITE : uuid v4 fabriqué par Connect, sans signification externe. Seul
     *   format dont on maîtrise la production de bout en bout, donc le seul
     *   qu'on valide (`ParseUUIDPipe` sur `PUT /auth/users/invite/:id`).
     *
     * Contrainte transverse : Connect sérialise ses accountId en
     * `TYPE|STRUCTURE|SUB` et les reparse par découpage sur `|`. Un
     * idAuthentification contenant `|` casserait cette lecture.
     */
    idAuthentification?: string
    prenom: string
    nom: string
    structure: Core.Structure
    type: Authentification.Type
    roles: Authentification.Role[]
    email?: string
    datePremiereConnexion?: Date
    dateDerniereConnexion?: Date
    appVersion?: string
    installationId?: string
    username?: string
  }

  export function estSuperviseur(utilisateur: Utilisateur): boolean {
    return utilisateur.roles.includes(Authentification.Role.SUPERVISEUR)
  }

  export function estJeune(type: Authentification.Type): boolean {
    return type === Authentification.Type.JEUNE
  }

  export function estConseiller(type: Authentification.Type): boolean {
    return type === Authentification.Type.CONSEILLER
  }

  export interface Repository {
    getConseiller(idAuthentification: string): Promise<Utilisateur | undefined>

    getJeuneByStructure(
      idAuthentification: string,
      structure: Core.Structure
    ): Promise<Utilisateur | undefined>

    getJeuneByIdAuthentification(
      idAuthentification: string
    ): Promise<Utilisateur | undefined>

    getJeuneById(id: string): Promise<Utilisateur | undefined>

    getJeuneByEmail(email: string): Promise<Utilisateur | undefined>

    getJeuneInvite(idAuthentification: string): Promise<Utilisateur | undefined>

    creerJeuneInvite(jeuneInvite: {
      id: string
      idAuthentification: string
      prenom: string
      dateCreation: Date
    }): Promise<void>

    update(utilisateur: Authentification.Utilisateur): Promise<void>

    save(utilisateur: Utilisateur, dateCreation?: Date): Promise<void>

    updateJeune(
      utilisateur: Partial<Authentification.Utilisateur>
    ): Promise<void>

    deleteUtilisateurIdp(idUserCEJ: string): Promise<void>

    estConseillerSuperviseur(
      structure: Core.Structure,
      email?: string | null
    ): Promise<boolean>

    recupererAccesPartenaire(
      bearer: string,
      structure: Core.Structure
    ): Promise<string>

    seFairePasserPourUnConseiller(
      idConseiller: string,
      bearer: string,
      structure: Core.Structure
    ): Promise<Result<string>>
  }

  @Injectable()
  export class Factory {
    constructor(private readonly idService: IdService) {}

    buildConseiller(
      idAuthentification: string,
      nom: string | undefined,
      prenom: string | undefined,
      email: string | undefined,
      username: string | undefined,
      structure: Core.Structure,
      superviseur: boolean
    ): Result<Utilisateur> {
      if (!nom || !prenom) {
        return failure(new ConseillerNonValide())
      }

      const roles = superviseur ? [Authentification.Role.SUPERVISEUR] : []

      const utilisateur: Utilisateur = {
        id: this.idService.uuid(),
        idAuthentification,
        prenom: prenom,
        nom: nom,
        email: email,
        username,
        type: Type.CONSEILLER,
        structure: structure,
        roles
      }
      return success(utilisateur)
    }
  }
}
