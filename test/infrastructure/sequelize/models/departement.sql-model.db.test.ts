import { DepartementSqlModel } from 'src/infrastructure/sequelize/models/departement.sql-model'
import { RegionSqlModel } from 'src/infrastructure/sequelize/models/region.sql-model'
import { unDepartementDto } from 'test/fixtures/sql-models/departement.sql-model'
import { uneRegionDto } from 'test/fixtures/sql-models/region.sql-model'
import { expect } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('DepartementSqlModel', () => {
  beforeEach(async () => {
    await getDatabase().cleanPG()
    await RegionSqlModel.create(uneRegionDto({ code: '84' }))
  })

  it('rattache un departement a une region', async () => {
    // When
    await DepartementSqlModel.create(
      unDepartementDto({ code: '69', libelle: 'Rhône', codeRegion: '84' })
    )

    // Then
    const departement = await DepartementSqlModel.findByPk('69')
    expect(departement!.codeRegion).to.equal('84')
  })

  it('refuse un departement rattache a une region inexistante', async () => {
    // When
    const promesse = DepartementSqlModel.create(
      unDepartementDto({ code: '69', codeRegion: 'ZZ' })
    )

    // Then
    await expect(promesse).to.be.rejected()
  })
})
