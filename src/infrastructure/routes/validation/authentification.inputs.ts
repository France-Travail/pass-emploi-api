import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'
import { Authentification } from '../../../domain/authentification'
import { Profil } from '../../../domain/profil'

export class ProfilPayload {
  @ApiProperty({ enum: Profil.Structure })
  @IsEnum(Profil.Structure)
  structure: Profil.Structure

  @ApiProperty({ enum: Profil.Dispositif, nullable: true })
  @IsOptional()
  @IsEnum(Profil.Dispositif)
  dispositif: Profil.Dispositif | null
}

export class PutUtilisateurPayload {
  @ApiProperty()
  @IsString()
  @IsOptional()
  nom?: string

  @ApiProperty()
  @IsString()
  @IsOptional()
  prenom?: string

  @ApiProperty()
  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty()
  @IsString()
  @IsOptional()
  username?: string

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  installationId?: string

  @ApiProperty()
  @IsString()
  @IsIn([Authentification.Type.JEUNE, Authentification.Type.CONSEILLER])
  type: Authentification.Type

  @ApiProperty({ type: ProfilPayload })
  @ValidateNested()
  @Type(() => ProfilPayload)
  profil: ProfilPayload
}

export class GetUtilisateurQueryParams {
  @ApiProperty()
  @IsString()
  @IsIn([Authentification.Type.JEUNE, Authentification.Type.CONSEILLER])
  typeUtilisateur: Authentification.Type

  @ApiProperty({ enum: Profil.Structure })
  @IsEnum(Profil.Structure)
  structure: Profil.Structure

  @ApiProperty({ enum: Profil.Dispositif, required: false })
  @IsOptional()
  @IsEnum(Profil.Dispositif)
  dispositif?: Profil.Dispositif
}
