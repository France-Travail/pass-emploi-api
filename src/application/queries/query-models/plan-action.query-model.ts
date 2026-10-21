import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export enum TypeActionPlan {
  LIEN = 'LIEN',
  NAVIGATION = 'NAVIGATION',
  CONSEIL = 'CONSEIL'
}

export enum EcranAppPlan {
  OFFRES_ALTERNANCE = 'OFFRES_ALTERNANCE',
  OFFRES_SERVICE_CIVIQUE = 'OFFRES_SERVICE_CIVIQUE',
  OFFRES_EMPLOI = 'OFFRES_EMPLOI',
  ALLER_VERS = 'ALLER_VERS',
  EVENEMENTS = 'EVENEMENTS',
  OFFRES_IMMERSIONS = 'OFFRES_IMMERSIONS'
}

export class ActionPlanQueryModel {
  @ApiProperty()
  id: string

  @ApiProperty()
  idSolution: string

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

  @ApiPropertyOptional({
    enum: EcranAppPlan,
    description:
      "Écran de l'app vers lequel mène la tâche, présent uniquement quand type vaut NAVIGATION. De nouvelles valeurs peuvent apparaître sans livraison mobile : une valeur inconnue doit être ignorée (pas de navigation), sans masquer la tâche"
  })
  ecranApp?: EcranAppPlan

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
