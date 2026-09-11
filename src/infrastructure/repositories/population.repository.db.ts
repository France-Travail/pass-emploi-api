import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import { Population } from '../../domain/population'
import { PopulationSqlModel } from '../sequelize/models/population.sql-model'
import { SequelizeInjectionToken } from '../sequelize/providers'

// Le conseiller `aliasConseiller` est dans la population `idPopulation` (paramètre `:idPopulation` ou colonne `d.id_population`).
export function sqlConseillerDansPopulation(
  aliasConseiller: string,
  idPopulation: string
): string {
  return `(
    EXISTS (
      SELECT 1 FROM population_conseiller pc
      WHERE pc.id_population = ${idPopulation}
        AND pc.email_conseiller = ${aliasConseiller}.email
    )
    OR EXISTS (
      SELECT 1 FROM population_profil pp
      WHERE pp.id_population = ${idPopulation}
        AND pp.structure = ${aliasConseiller}.structure
        AND (pp.dispositif IS NULL OR pp.dispositif = ${aliasConseiller}.dispositif)
    )
  )`
}

@Injectable()
export class PopulationSqlRepository implements Population.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async existe(idPopulation: string): Promise<boolean> {
    const population = await PopulationSqlModel.findByPk(idPopulation)
    return population !== null
  }

  async getIdsDesBeneficiaires(idPopulation: string): Promise<string[]> {
    const rows = await this.sequelize.query<{ id: string }>(
      `
        SELECT j.id
        FROM jeune j
        JOIN conseiller c ON c.id = COALESCE(j.id_conseiller_initial, j.id_conseiller)
        WHERE ${sqlConseillerDansPopulation('c', ':idPopulation')}
      `,
      { replacements: { idPopulation }, type: QueryTypes.SELECT }
    )
    return rows.map(row => row.id)
  }
}
