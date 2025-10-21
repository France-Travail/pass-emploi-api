import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import { FeatureFlip } from '../../domain/feature-flip'
import { SequelizeInjectionToken } from '../sequelize/providers'

@Injectable()
export class FeatureFlipSqlRepository implements FeatureFlip.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async featureActivePourBeneficiaire(
    tag: FeatureFlip.Tag,
    idBeneficiaire: string
  ): Promise<boolean> {
    const rows = await this.sequelize.query(
      `
      SELECT 1
      FROM feature_flip ff
      JOIN jeune j ON j.id = :idJeune
      JOIN conseiller c ON c.id IN (j.id_conseiller, j.id_conseiller_initial)
      WHERE ff.feature_tag = :featureTag
        AND ff.email_conseiller = c.email
      LIMIT 1
      `,
      {
        replacements: {
          idJeune: idBeneficiaire,
          featureTag: tag
        },
        type: QueryTypes.SELECT
      }
    )
    return rows.length > 0
  }

  async featureActivePourConseiller(
    tag: FeatureFlip.Tag,
    idConseiller: string
  ): Promise<boolean> {
    const rows = await this.sequelize.query(
      `
      SELECT 1
      FROM feature_flip ff
      JOIN conseiller c ON c.id = :idConseiller
      WHERE ff.feature_tag = :featureTag
        AND ff.email_conseiller = c.email
      LIMIT 1
      `,
      {
        replacements: {
          idConseiller,
          featureTag: tag
        },
        type: QueryTypes.SELECT
      }
    )
    return rows.length > 0
  }
}
