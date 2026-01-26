import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import {
  BeneficiaireMigration,
  ConseillerMigration,
  FeatureFlip
} from '../../domain/feature-flip'
import { SequelizeInjectionToken } from '../sequelize/providers'

@Injectable()
export class FeatureFlipSqlRepository implements FeatureFlip.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async getBeneficiairesDeLaFeatureDuConseillerInitial(
    tag: FeatureFlip.Tag
  ): Promise<BeneficiaireMigration[]> {
    // on veut que le conseiller initial : si on est dans un cas de transfert temporaire il est dans le champ id_conseiller_initial, sinon dans le champ id_conseiller
    const rows = await this.sequelize.query<{ id: string }>(
      `
      SELECT j.id
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
    return rows.map(row => new BeneficiaireMigration(row.id))
  }

  async getBeneficiaireSiFeatureActivePourLeConseillerInitial(
    tag: FeatureFlip.Tag,
    idBeneficiaire: string
  ): Promise<BeneficiaireMigration | undefined> {
    const rows = await this.sequelize.query<{ id: string }>(
      `
      SELECT j.id
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

    return new BeneficiaireMigration(rows[0].id)
  }

  async getConseillerSiFeatureActive(
    tag: FeatureFlip.Tag,
    idConseiller: string
  ): Promise<ConseillerMigration | undefined> {
    const rows = await this.sequelize.query<{ id: string }>(
      `
      SELECT c.id
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

    return new ConseillerMigration(rows[0].id)
  }
}
