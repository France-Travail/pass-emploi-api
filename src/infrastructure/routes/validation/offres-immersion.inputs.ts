import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
  IsEnum,
  IsEmail,
  MaxLength,
  ValidateIf,
  Matches,
  IsPhoneNumber
} from 'class-validator'
import {
  transformStringToFloat,
  transformStringToInteger
} from './utils/transformers'

interface GetOffresImmersionQuery {
  rome: string
  lat: number
  lon: number
  distance?: number
}

export class GetOffresImmersionQueryParams implements GetOffresImmersionQuery {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rome: string

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Transform(params => transformStringToFloat(params, 'lat'))
  lat: number

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Transform(params => transformStringToFloat(params, 'lon'))
  lon: number

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Transform(params => transformStringToInteger(params, 'distance'))
  distance?: number
}

export class GetOffresImmersionQueryParamsV3 {
  @ApiPropertyOptional()
  @ValidateIf(o => !o.appellationCode)
  @IsString()
  @IsNotEmpty()
  rome?: string

  @ApiPropertyOptional()
  @ValidateIf(o => !o.rome)
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{5}\d?$/)
  appellationCode?: string

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Transform(params => transformStringToFloat(params, 'lat'))
  lat: number

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  @Transform(params => transformStringToFloat(params, 'lon'))
  lon: number

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Transform(params => transformStringToInteger(params, 'distance'))
  distance?: number

  @ApiProperty()
  @IsNumber()
  @Transform(params => transformStringToInteger(params, 'page'))
  page: number

  @ApiProperty()
  @IsNumber()
  @Transform(params => transformStringToInteger(params, 'limit'))
  limit: number
}

export class GetOffresImmersionQueryBody {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rome: string

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  lat: number

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  lon: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  distance?: number
}

class Location {
  @ApiProperty()
  @IsNumber()
  lat: number

  @ApiProperty()
  @IsNumber()
  lon: number
}

class NouvelleOffreImmersion {
  @ApiPropertyOptional({ type: Location })
  @ValidateNested()
  @IsOptional()
  @Type(() => Location)
  location?: Location

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rome: string

  @ApiProperty()
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  siret: string
}

export class NouvellesOffresImmersions {
  @ApiProperty({ type: NouvelleOffreImmersion, isArray: true })
  @ValidateNested()
  @Type(() => NouvelleOffreImmersion)
  @IsArray()
  immersions: NouvelleOffreImmersion[]
}

enum ModeContact {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  IN_PERSON = 'IN_PERSON'
}

export class PostImmersionContactBody {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  codeRome: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  labelRome: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  siret: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  prenom: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nom: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string

  @ApiProperty({ enum: ModeContact })
  @IsString()
  @IsNotEmpty()
  @IsEnum(ModeContact)
  contactMode: ModeContact

  @ApiPropertyOptional()
  @ValidateIf(payload => payload.contactMode === ModeContact.EMAIL)
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  message?: string
}

export class PostImmersionContactBodyV3 {
  @ApiProperty({
    example: '11573'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{5}\d?$/)
  appellationCode: string

  @ApiProperty({
    example: '12345678901234'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:\s*\d){14}\s*$/)
  siret: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  locationId: string

  @ApiProperty({
    example: '0606060606'
  })
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber('FR')
  numeroTelephone: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  prenom: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nom: string

  @ApiProperty({
    example: 'user@example.fr'
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string

  @ApiProperty({ enum: ModeContact })
  @IsString()
  @IsNotEmpty()
  @IsEnum(ModeContact)
  contactMode: ModeContact

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(6000)
  datePreferences: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(1024)
  experienceAdditionalInformation?: string

  @ApiPropertyOptional({
    example: 'https://www.linkedin.com/in/user-example-5797a891/'
  })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @Matches(/^https?:\/\/.+?$/, {
    message: 'Le lien doit être une URL valide'
  })
  resumeLink?: string
}
