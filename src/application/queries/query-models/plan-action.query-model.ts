import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export enum TypeActionPlan {
  LIEN = 'LIEN',
  NAVIGATION = 'NAVIGATION',
  CONSEIL = 'CONSEIL'
}

export enum DestinationActionPlan {
  OFFRES_ALTERNANCE = 'OFFRES_ALTERNANCE',
  OFFRES_SERVICE_CIVIQUE = 'OFFRES_SERVICE_CIVIQUE',
  EVENEMENTS = 'EVENEMENTS'
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

  @ApiPropertyOptional({ enum: DestinationActionPlan })
  destination?: DestinationActionPlan

  @ApiPropertyOptional()
  nomService?: string

  @ApiPropertyOptional()
  descriptionService?: string
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

  @ApiProperty()
  accroche: string

  @ApiProperty()
  genereLe: string

  @ApiProperty()
  generateur: string

  @ApiProperty({ type: [ObjectivePlanActionQueryModel] })
  objectives: ObjectivePlanActionQueryModel[]
}
