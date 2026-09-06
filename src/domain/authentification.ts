import { Injectable } from '@nestjs/common'
import { ConseillerNonValide } from '../building-blocks/types/domain-error'
import { failure, Result, success } from '../building-blocks/types/result'
import { IdService } from '../utils/id-service'
import { Profil } from './profil'

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
      profil: {
        // @ts-expect-error le support est hors modèle de profil (cf. verifierProfils)
        structure: 'SUPPORT',
        dispositif: null
      },
      type: Authentification.Type.SUPPORT,
      roles: []
    }
  }

  export interface Utilisateur {
    id: string
    idAuthentification?: string
    prenom: string
    nom: string
    profil: Profil
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

    getJeuneByProfil(
      idAuthentification: string,
      profil: Profil
    ): Promise<Utilisateur | undefined>

    getJeuneByIdAuthentification(
      idAuthentification: string
    ): Promise<Utilisateur | undefined>

    getJeuneById(id: string): Promise<Utilisateur | undefined>

    getJeuneByEmail(
      email: string,
      structure?: Profil.Structure
    ): Promise<Utilisateur | undefined>

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

    updateInstallationIdJeune(
      idJeune: string,
      installationId: string
    ): Promise<void>

    deleteUtilisateurIdp(idUserCEJ: string): Promise<void>

    supprimerCompteIdpInvite(idAuthentification: string): Promise<void>

    estConseillerSuperviseur(
      profil: Profil,
      email?: string | null
    ): Promise<boolean>

    recupererAccesPartenaire(
      bearer: string,
      structure: Profil.Structure
    ): Promise<string>

    seFairePasserPourUnConseiller(
      idConseiller: string,
      bearer: string,
      structure: Profil.Structure
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
      profil: Profil,
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
        profil,
        roles
      }
      return success(utilisateur)
    }
  }
}
