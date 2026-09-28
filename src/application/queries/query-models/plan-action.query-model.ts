import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export enum TypeActionPlan {
  LIEN = 'LIEN',
  NAVIGATION = 'NAVIGATION',
  CONSEIL = 'CONSEIL'
}

export class ActionPlanQueryModel {
  @ApiProperty()
  id: string

  @ApiProperty()
  libelle: string

  @ApiProperty({ enum: TypeActionPlan })
  type: TypeActionPlan

  @ApiPropertyOptional()
  url?: string

  @ApiPropertyOptional()
  nomService?: string
}

export class ObjectivePlanActionQueryModel {
  @ApiProperty()
  id: string

  @ApiProperty()
  titre: string

  @ApiProperty()
  theme: string

  @ApiProperty({ type: [ActionPlanQueryModel] })
  actions: ActionPlanQueryModel[]
}

export class PlanActionQueryModel {
  @ApiProperty()
  id: string

  @ApiProperty({ type: [ObjectivePlanActionQueryModel] })
  objectives: ObjectivePlanActionQueryModel[]
}
