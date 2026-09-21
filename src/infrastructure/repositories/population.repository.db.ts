import { Inject, Injectable } from '@nestjs/common'
import { QueryTypes, Sequelize } from 'sequelize'
import { Population } from '../../domain/population'
import { PopulationSqlModel } from '../sequelize/models/population.sql-model'
import { SequelizeInjectionToken } from '../sequelize/providers'
import {
  sqlConseillerDansPopulation,
  sqlJeuneDansPopulation,
  sqlJoinConseillerDeReference
} from './sql-helpers'

@Injectable()
export class PopulationSqlRepository implements Population.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async existe(idPopulation: string): Promise<boolean> {
    const population = await PopulationSqlModel.findByPk(idPopulation)
    return population !== null
  }

  async getIdsDesJeunesParProfilOuConseillerCite(
    idPopulation: string
  ): Promise<string[]> {
    const rows = await this.sequelize.query<{ id: string }>(
      `
        SELECT j.id
        FROM jeune j
        ${sqlJoinConseillerDeReference('j', 'c')}
        WHERE ${sqlJeuneDansPopulation('j', 'c', ':idPopulation')}
      `,
      { replacements: { idPopulation }, type: QueryTypes.SELECT }
    )
    return rows.map(row => row.id)
  }

  async getIdsDesConseillersParProfilOuConseillerCite(
    idPopulation: string
  ): Promise<string[]> {
    const rows = await this.sequelize.query<{ id: string }>(
      `
        SELECT c.id
        FROM conseiller c
        WHERE ${sqlConseillerDansPopulation('c', ':idPopulation')}
      `,
      { replacements: { idPopulation }, type: QueryTypes.SELECT }
    )
    return rows.map(row => row.id)
  }
}
