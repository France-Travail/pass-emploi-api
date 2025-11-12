import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import { FeatureFlip } from '../../domain/feature-flip'
import { SequelizeInjectionToken } from '../sequelize/providers'
import { Core } from '../../domain/core'

export interface IdEtStructure {
  id: string
  structure: Core.Structure
}

@Injectable()
export class FeatureFlipSqlRepository implements FeatureFlip.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async getIdsBeneficiairesDeLaFeature(
    tag: FeatureFlip.Tag
  ): Promise<IdEtStructure[]> {
    return await this.sequelize.query<IdEtStructure>(
      `
      SELECT j.id, j.structure
      FROM feature_flip ff
      JOIN conseiller c ON c.email = ff.email_conseiller
      JOIN jeune j ON (j.id_conseiller = c.id OR j.id_conseiller_initial = c.id)
      WHERE ff.feature_tag = :featureTag
      `,
      {
        replacements: {
          featureTag: tag
        },
        type: QueryTypes.SELECT,
        mapToModel: false
      }
    )
  }

  async getBeneficiaireSiFeatureActive(
    tag: FeatureFlip.Tag,
    idBeneficiaire: string
  ): Promise<IdEtStructure | undefined> {
    const rows = await this.sequelize.query<IdEtStructure>(
      `
      SELECT j.id, j.structure
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
    return rows.length > 0 ? rows[0] : undefined
  }

  async getConseillerSiFeatureActive(
    tag: FeatureFlip.Tag,
    idConseiller: string
  ): Promise<IdEtStructure | undefined> {
    const rows = await this.sequelize.query<IdEtStructure>(
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
