import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import {
  BeneficiaireMigration,
  ConseillerMigration,
  FeatureFlip
} from '../../domain/feature-flip'
import { SequelizeInjectionToken } from '../sequelize/providers'
import { Core } from '../../domain/core'

@Injectable()
export class FeatureFlipSqlRepository implements FeatureFlip.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  private mapToBeneficiaireMigration(row: {
    id: string
    structure: string
    structureConseillerRattachement: string
  }): BeneficiaireMigration {
    return new BeneficiaireMigration(
      row.id,
      row.structure as Core.Structure,
      row.structureConseillerRattachement as Core.Structure
    )
  }

  private mapToConseillerMigration(row: {
    id: string
    structure: string
  }): ConseillerMigration {
    return new ConseillerMigration(row.id, row.structure as Core.Structure)
  }

  async getBeneficiairesDeLaFeature(
    tag: FeatureFlip.Tag
  ): Promise<BeneficiaireMigration[]> {
    const rows = await this.sequelize.query<{
      id: string
      structure: string
      structureConseillerRattachement: string
    }>(
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
    return rows.map(row => this.mapToBeneficiaireMigration(row))
  }

  async getBeneficiaireSiFeatureActive(
    tag: FeatureFlip.Tag,
    idBeneficiaire: string
  ): Promise<BeneficiaireMigration | undefined> {
    const rows = await this.sequelize.query<{
      id: string
      structure: string
      structureConseillerRattachement: string
    }>(
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
    if (rows.length === 0) return undefined

    return this.mapToBeneficiaireMigration(rows[0])
  }

  async getConseillerSiFeatureActive(
    tag: FeatureFlip.Tag,
    idConseiller: string
  ): Promise<ConseillerMigration | undefined> {
    const rows = await this.sequelize.query<{
      id: string
      structure: string
    }>(
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
    if (rows.length === 0) return undefined

    return this.mapToConseillerMigration(rows[0])
  }
}
