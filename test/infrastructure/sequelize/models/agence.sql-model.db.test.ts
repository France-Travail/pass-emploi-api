import { ForeignKeyConstraintError } from 'sequelize'
import { AgenceSqlModel } from 'src/infrastructure/sequelize/models/agence.sql-model'
import { RegionSqlModel } from 'src/infrastructure/sequelize/models/region.sql-model'
import {
  uneAgenceDto,
  uneAgenceMiloDto
} from 'test/fixtures/sql-models/agence.sql-model'
import { uneRegionDto } from 'test/fixtures/sql-models/region.sql-model'
import { expect } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('AgenceSqlModel code_safir', () => {
  beforeEach(async () => {
    await getDatabase().cleanPG()
  })

  it('accepte un code safir sur une agence FT', async () => {
    // When
    await AgenceSqlModel.create(uneAgenceDto({ id: '900', codeSafir: '44155' }))

    // Then
    const agence = await AgenceSqlModel.findByPk('900')
    expect(agence!.codeSafir).to.equal('44155')
  })

  it('accepte plusieurs agences sans code safir', async () => {
    // When
    await AgenceSqlModel.create(uneAgenceMiloDto({ id: '901' }))
    await AgenceSqlModel.create(uneAgenceMiloDto({ id: '902' }))

    // Then
    const sansSafir = await AgenceSqlModel.count({
      where: { codeSafir: null }
    })
    expect(sansSafir).to.equal(2)
  })

  it('refuse deux agences FT avec le meme code safir', async () => {
    // Given
    await AgenceSqlModel.create(uneAgenceDto({ id: '903', codeSafir: '44155' }))

    // When
    const promesse = AgenceSqlModel.create(
      uneAgenceDto({ id: '904', codeSafir: '44155' })
    )

    // Then
    await expect(promesse).to.be.rejected()
  })
})

describe('AgenceSqlModel code_region', () => {
  beforeEach(async () => {
    await getDatabase().cleanPG()
    await RegionSqlModel.create(uneRegionDto({ code: '52' }))
  })

  it('accepte un code region present dans le referentiel', async () => {
    // When
    await AgenceSqlModel.create(uneAgenceDto({ id: '1', codeRegion: '52' }))

    // Then
    const agence = await AgenceSqlModel.findByPk('1')
    expect(agence!.codeRegion).to.equal('52')
  })

  it('accepte une agence sans code region', async () => {
    // When
    await AgenceSqlModel.create(uneAgenceDto({ id: '2', codeRegion: null }))

    // Then
    const agence = await AgenceSqlModel.findByPk('2')
    expect(agence!.codeRegion).to.equal(null)
  })

  it('refuse un code region absent du referentiel', async () => {
    // When
    const promise = AgenceSqlModel.create(
      uneAgenceDto({ id: '3', codeRegion: 'ZZ' })
    )

    // Then
    await expect(promise).to.be.rejectedWith(ForeignKeyConstraintError)
  })
})
