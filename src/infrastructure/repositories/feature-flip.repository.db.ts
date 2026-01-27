import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import { BeneficiaireMigration, FeatureFlip } from '../../domain/feature-flip'
import { SequelizeInjectionToken } from '../sequelize/providers'
import Tag = FeatureFlip.Tag

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

  async getTagSiFeatureActivePourLeConseillerDuJeune(
    tags: FeatureFlip.Tag[],
    idBeneficiaire: string
  ): Promise<FeatureFlip.Tag | undefined> {
    const rows = await this.sequelize.query<{ feature_tag: FeatureFlip.Tag }>(
      `
        SELECT ff.feature_tag
        FROM feature_flip ff
               JOIN jeune j ON j.id = :idJeune
               JOIN conseiller c ON c.id = COALESCE(j.id_conseiller_initial, j.id_conseiller)
        WHERE ff.feature_tag IN (:featureTags)
          AND ff.email_conseiller = c.email
          LIMIT 1
      `,
      {
        replacements: {
          idJeune: idBeneficiaire,
          featureTags: tags
        },
        type: QueryTypes.SELECT
      }
    )
    if (rows.length === 0) return undefined

    return rows[0].feature_tag
  }

  async getTagSiFeatureActivePourLeConseiller(
    tags: FeatureFlip.Tag[],
    idConseiller: string
  ): Promise<Tag | undefined> {
    const rows = await this.sequelize.query<{
      feature_tag: FeatureFlip.Tag
    }>(
      `
        SELECT ff.feature_tag
        FROM feature_flip ff
               JOIN conseiller c ON c.id = :idConseiller
        WHERE ff.feature_tag in (:featureTags)
          AND ff.email_conseiller = c.email
          LIMIT 1
      `,
      {
        replacements: {
          idConseiller,
          featureTags: tags
        },
        type: QueryTypes.SELECT
      }
    )
    if (rows.length === 0) return undefined

    return rows[0].feature_tag
  }
}
