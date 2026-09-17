import { RegionSqlModel } from 'src/infrastructure/sequelize/models/region.sql-model'
import { uneRegionDto } from 'test/fixtures/sql-models/region.sql-model'
import { expect } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('RegionSqlModel', () => {
  beforeEach(async () => {
    await getDatabase().cleanPG()
  })

  it('persiste un code et un libelle', async () => {
    // When
    await RegionSqlModel.create(
      uneRegionDto({ code: '11', libelle: 'Île-de-France' })
    )

    // Then
    const region = await RegionSqlModel.findByPk('11')
    expect(region!.libelle).to.equal('Île-de-France')
  })

  it('refuse deux regions de meme code', async () => {
    // Given
    await RegionSqlModel.create(uneRegionDto({ code: '11' }))

    // When
    const promesse = RegionSqlModel.create(uneRegionDto({ code: '11' }))

    // Then
    await expect(promesse).to.be.rejected()
  })
})
