import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf
} from 'class-validator'

export class CreateActualiteMiloPayload {
  @ApiProperty({ description: "Titre de l'actualité" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  titre: string

  @ApiProperty({ description: "Contenu/description de l'actualité" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  contenu: string

  @ApiPropertyOptional({ description: 'Titre du lien optionnel' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  titreLien?: string

  @ApiPropertyOptional({ description: 'URL du lien optionnel' })
  @ValidateIf(o => o.titreLien !== undefined)
  @IsNotEmpty({
    message: 'Le lien est requis quand un titre de lien est fourni'
  })
  @IsString()
  @MaxLength(2000)
  @IsUrl({
    require_protocol: true,
    require_tld: false,
    protocols: ['http', 'https']
  })
  lien?: string
}
