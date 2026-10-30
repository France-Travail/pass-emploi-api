import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches } from 'class-validator'

export class CodeCentreInteretRomeParams {
  @ApiProperty()
  @IsString()
  @Matches(/^\d{1,3}$/)
  code: string
}

export class CodeMetierRomeParams {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z]\d{4}$/)
  code: string
}
