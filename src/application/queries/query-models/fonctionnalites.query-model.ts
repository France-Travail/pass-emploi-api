import { ApiProperty } from '@nestjs/swagger'

export class FonctionnalitesJeuneQueryModel {
  @ApiProperty({
    type: String,
    isArray: true,
    description:
      "Ids des fonctionnalités actives pour le bénéficiaire. Une fonctionnalité affectée au conseiller mais dont la date d'activation n'est pas atteinte n'y figure pas."
  })
  fonctionnalites: string[]
}

export class FonctionnalitesSupportQueryModel {
  @ApiProperty({
    type: String,
    isArray: true,
    description:
      'Ids du référentiel, à utiliser dans POST /support/deploiements',
    example: ['DEMARCHES_IA', 'PLAN_D_ACTION']
  })
  fonctionnalites: string[]
}
