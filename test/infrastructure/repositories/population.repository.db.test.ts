import { PopulationSqlRepository } from '../../../src/infrastructure/repositories/population.repository.db'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { expect } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('PopulationSqlRepository', () => {
  let repo: PopulationSqlRepository

  beforeEach(async () => {
    await getDatabase().cleanPG()
    repo = new PopulationSqlRepository(getDatabase().sequelize)

    await PopulationSqlModel.create({ id: 'PILOTE', description: 'Pilote' })
  })

  describe('existe', () => {
    it('reconnaît une population', async () => {
      expect(await repo.existe('PILOTE')).to.equal(true)
      expect(await repo.existe('INCONNUE')).to.equal(false)
    })
  })
})
