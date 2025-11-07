import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import { FeatureFlip } from '../../domain/feature-flip'
import { SequelizeInjectionToken } from '../sequelize/providers'
import { Core } from '../../domain/core'

@Injectable()
export class FeatureFlipSqlRepository implements FeatureFlip.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async getIdsBeneficiaires(tag: FeatureFlip.Tag): Promise<string[]> {
    const rows = await this.sequelize.query(
      `
      SELECT j.id
      FROM feature_flip ff
      JOIN conseiller c ON c.email = ff.email_conseiller
      JOIN jeune j ON (j.id_conseiller = c.id OR j.id_conseiller_initial = c.id)
      WHERE ff.feature_tag = :featureTag
      AND (
        ff.feature_tag != :featureTagMigration
        OR j.structure = :structureMigration
      )
      `,
      {
        replacements: {
          featureTag: tag,
          featureTagMigration: FeatureFlip.Tag.MIGRATION,
          structureMigration: Core.Structure.POLE_EMPLOI
        },
        type: QueryTypes.SELECT,
        mapToModel: false
      }
    )

    return rows.map((row: { id: string }) => row.id)
  }

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
        AND (
        ff.feature_tag != :featureTagMigration
        OR j.structure = :structureMigration
      )
      LIMIT 1
      `,
      {
        replacements: {
          idJeune: idBeneficiaire,
          featureTag: tag,
          featureTagMigration: FeatureFlip.Tag.MIGRATION,
          structureMigration: Core.Structure.POLE_EMPLOI
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
        AND (
        ff.feature_tag != :featureTagMigration
        OR c.structure = :structureMigration
      )
      LIMIT 1
      `,
      {
        replacements: {
          idConseiller,
          featureTag: tag,
          featureTagMigration: FeatureFlip.Tag.MIGRATION,
          structureMigration: Core.Structure.POLE_EMPLOI
        },
        type: QueryTypes.SELECT
      }
    )
    return rows.length > 0
  }
}
