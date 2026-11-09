import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class PutPrenomInvitePayload {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  prenom: string
}

export class PutCGUInvitePayload {
  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  dateSignatureCGU: string
}
