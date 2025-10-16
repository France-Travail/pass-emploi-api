import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import { FeatureFlipTag } from '../../../infrastructure/sequelize/models/feature-flip.sql-model'
import { SequelizeInjectionToken } from '../../../infrastructure/sequelize/providers'

export interface GetFeaturesQuery {
  idJeune: string
  featureTag: FeatureFlipTag
}

@Injectable()
export class GetFeaturesQueryGetter {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async handle(query: GetFeaturesQuery): Promise<boolean> {
    const rows = await this.sequelize.query(
      `
      SELECT 1
      FROM feature_flip ff
      JOIN jeune j ON j.id = :idJeune
      JOIN conseiller c ON c.id = j.id_conseiller
      WHERE ff.feature_tag = :featureTag
        AND ff.email_conseiller = c.email
      LIMIT 1
      `,
      {
        replacements: {
          idJeune: query.idJeune,
          featureTag: query.featureTag
        },
        type: QueryTypes.SELECT
      }
    )
    return rows.length > 0
  }
}
