import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import { Population } from '../../domain/population'
import { PopulationSqlModel } from '../sequelize/models/population.sql-model'
import { SequelizeInjectionToken } from '../sequelize/providers'

@Injectable()
export class PopulationSqlRepository implements Population.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async existe(idPopulation: string): Promise<boolean> {
    const population = await PopulationSqlModel.findByPk(idPopulation)
    return population !== null
  }

  async getIdsPopulationsDuConseiller(idConseiller: string): Promise<string[]> {
    const rows = await this.sequelize.query<{ id_population: string }>(
      `
        SELECT id_population
        FROM appartenance_population_conseiller
        WHERE id_conseiller = :idConseiller
      `,
      { replacements: { idConseiller }, type: QueryTypes.SELECT }
    )
    return rows.map(row => row.id_population)
  }

  async getIdsPopulationsDuJeune(idJeune: string): Promise<string[]> {
    const rows = await this.sequelize.query<{ id_population: string }>(
      `
        SELECT id_population
        FROM appartenance_population_jeune
        WHERE id_jeune = :idJeune
      `,
      { replacements: { idJeune }, type: QueryTypes.SELECT }
    )
    return rows.map(row => row.id_population)
  }
}
