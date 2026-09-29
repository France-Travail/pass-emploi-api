import { Injectable } from '@nestjs/common'
import { Population } from '../../domain/population'
import { PopulationSqlModel } from '../sequelize/models/population.sql-model'

@Injectable()
export class PopulationSqlRepository implements Population.Repository {
  async existe(idPopulation: string): Promise<boolean> {
    const population = await PopulationSqlModel.findByPk(idPopulation)
    return population !== null
  }
}
