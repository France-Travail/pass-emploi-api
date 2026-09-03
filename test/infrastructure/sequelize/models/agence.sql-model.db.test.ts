import { AgenceSqlModel } from 'src/infrastructure/sequelize/models/agence.sql-model'
import {
  uneAgenceDto,
  uneAgenceMiloDto
} from 'test/fixtures/sql-models/agence.sql-model'
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
