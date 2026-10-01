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

  @ApiProperty()
  terminee: boolean

  @ApiProperty({
    description:
      'Vrai quand cocher ouvre la déclaration : date, et commentaire pour Mission Locale'
  })
  declarationRequise: boolean

  @ApiPropertyOptional()
  url?: string

  @ApiPropertyOptional()
  nomService?: string

  @ApiPropertyOptional({
    description:
      "Catégorie Mission Locale ou thématique France Travail selon le profil, absente pour l'Espace candidat et l'invité"
  })
  categorie?: string
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
