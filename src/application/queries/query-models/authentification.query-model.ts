import { ApiProperty } from '@nestjs/swagger'
import { Authentification } from '../../../domain/authentification'
import { Core } from '../../../domain/core'
import { Profil, profilVersStructureLegacy } from '../../../domain/profil'

export class ProfilQueryModel {
  @ApiProperty({ enum: Profil.Structure })
  structure: Profil.Structure

  @ApiProperty({ enum: Profil.Dispositif, nullable: true })
  dispositif: Profil.Dispositif | null
}

export class UtilisateurQueryModel {
  @ApiProperty()
  id: string

  @ApiProperty()
  prenom: string

  @ApiProperty()
  nom: string

  @ApiProperty()
  roles: Authentification.Role[]

  @ApiProperty({ required: false })
  email?: string

  @ApiProperty({ required: false })
  username?: string

  // Rétro-compat connect / app mobile (claim `userStructure`) : repli legacy du profil.
  @ApiProperty({
    enum: Core.Structure
  })
  structure: Core.Structure

  @ApiProperty({ type: ProfilQueryModel })
  profil: ProfilQueryModel

  @ApiProperty({
    enum: Authentification.Type
  })
  type: Authentification.Type
}

export class ChatSecretsQueryModel {
  @ApiProperty()
  token: string

  @ApiProperty()
  cle: string
}

export function queryModelFromUtilisateur(
  utilisateur: Authentification.Utilisateur
): UtilisateurQueryModel {
  return {
    id: utilisateur.id,
    prenom: utilisateur.prenom,
    nom: utilisateur.nom,
    email: utilisateur.email,
    username: utilisateur.username,
    structure: profilVersStructureLegacy(utilisateur.profil),
    profil: {
      structure: utilisateur.profil.structure,
      dispositif: utilisateur.profil.dispositif
    },
    type: utilisateur.type,
    roles: utilisateur.roles
  }
}
