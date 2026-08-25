import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsNotIn } from 'class-validator'
import { Profil } from '../../../domain/profil'

export class GetAgencesQueryParams {
  @ApiProperty({
    required: true,
    enum: Profil.Structure
  })
  @IsEnum(Profil.Structure)
  @IsNotEmpty()
  structure: Profil.Structure
}

export class AgenceInput {
  @ApiPropertyOptional({ type: 'string' })
  @IsNotIn([''], { message: 'id ne peut pas être vide' })
  id?: string

  @ApiPropertyOptional({ type: 'string' })
  @IsNotIn([''], { message: 'nom ne peut pas être vide' })
  nom?: string
}
