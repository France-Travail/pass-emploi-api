import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import { FeatureFlip } from '../../domain/feature-flip'
import { SequelizeInjectionToken } from '../sequelize/providers'
import { Core } from '../../domain/core'

export interface BeneficiaireMigration {
  id: string
  structure: Core.Structure
  structureConseillerRattachement: Core.Structure
}

@Injectable()
export class FeatureFlipSqlRepository implements FeatureFlip.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async getIdsBeneficiairesDeLaFeature(
    tag: FeatureFlip.Tag
  ): Promise<BeneficiaireMigration[]> {
    return await this.sequelize.query<BeneficiaireMigration>(
      `
      SELECT
        j.id,
        j.structure,
        c.structure AS "structureConseillerRattachement"
      FROM jeune j
      JOIN conseiller c ON c.id = COALESCE(j.id_conseiller_initial, j.id_conseiller)
      JOIN feature_flip ff ON ff.email_conseiller = c.email
      WHERE ff.feature_tag = :featureTag
      `,
      {
        replacements: {
          featureTag: tag
        },
        type: QueryTypes.SELECT
      }
    )
  }

  async getBeneficiaireSiFeatureActive(
    tag: FeatureFlip.Tag,
    idBeneficiaire: string
  ): Promise<BeneficiaireMigration | undefined> {
    const rows = await this.sequelize.query<BeneficiaireMigration>(
      `
      SELECT
          j.id,
          j.structure,
          c.structure AS "structureConseillerRattachement"
      FROM feature_flip ff
      JOIN jeune j ON j.id = :idJeune
      JOIN conseiller c ON c.id = COALESCE(j.id_conseiller_initial, j.id_conseiller)
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
    return rows.length > 0 ? rows[0] : undefined
  }

  async getConseillerSiFeatureActive(
    tag: FeatureFlip.Tag,
    idConseiller: string
  ): Promise<BeneficiaireMigration | undefined> {
    const rows = await this.sequelize.query<BeneficiaireMigration>(
      `
      SELECT c.id, c.structure
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
    return rows.length > 0 ? rows[0] : undefined
  }
}
