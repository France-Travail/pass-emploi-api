import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, Matches } from 'class-validator'
import { TypeStructureAccompagnement } from '../../../application/queries/query-models/structures-accompagnement.query-model'

export class GetStructuresAccompagnementQueryParams {
  @ApiProperty({ enum: TypeStructureAccompagnement })
  @IsEnum(TypeStructureAccompagnement)
  type: TypeStructureAccompagnement

  @ApiProperty({ example: '31555' })
  @Matches(/^(\d{5}|2[AB]\d{3})$/)
  codeInsee: string

  @ApiProperty({ example: '31000' })
  @Matches(/^\d{5}$/)
  codePostal: string
}
