import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNotEmpty, IsNumber, IsString } from 'class-validator'

export class CreateRendezVousPayload {
  @ApiProperty()
  @IsString()
  comment: string

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  date: string

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  duration: number

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  modality: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  jeuneId: string
}
