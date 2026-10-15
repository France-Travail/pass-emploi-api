import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { QueryTypes, Sequelize } from 'sequelize'
import { Deploiement } from '../../domain/deploiement'
import { Fonctionnalite } from '../../domain/fonctionnalite'
import { SequelizeInjectionToken } from '../sequelize/providers'

export function sqlDeploiementActif(
  aliasDep: string,
  maintenant: string
): string {
  return `${aliasDep}.date_activation <= ${maintenant}`
}

@Injectable()
export class FonctionnaliteSqlRepository implements Fonctionnalite.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async getIdsFonctionnalitesActives(
    idsPopulations: string[],
    maintenant: DateTime
  ): Promise<string[]> {
    if (!idsPopulations.length) return []

    const rows = await this.sequelize.query<{ id_fonctionnalite: string }>(
      `
        SELECT DISTINCT id_fonctionnalite
        FROM deploiement
        WHERE nature = :nature
          AND id_population IN (:idsPopulations)
          AND ${sqlDeploiementActif('deploiement', ':maintenant')}
        ORDER BY id_fonctionnalite
      `,
      {
        replacements: {
          nature: Deploiement.Nature.FONCTIONNALITE,
          idsPopulations,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )
    return rows.map(row => row.id_fonctionnalite)
  }
}
