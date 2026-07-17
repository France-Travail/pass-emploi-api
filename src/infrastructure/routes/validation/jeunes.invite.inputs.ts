import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class PutPrenomInvitePayload {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  prenom: string
}
