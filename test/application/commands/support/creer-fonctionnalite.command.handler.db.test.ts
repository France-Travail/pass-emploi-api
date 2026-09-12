import { before } from 'mocha'
import { CreerFonctionnaliteCommandHandler } from '../../../../src/application/commands/support/creer-fonctionnalite.command.handler.db'
import { FonctionnaliteSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { expect } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

describe('CreerFonctionnaliteCommandHandler', () => {
  let databaseForTesting: DatabaseForTesting
  let handler: CreerFonctionnaliteCommandHandler

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    handler = new CreerFonctionnaliteCommandHandler()
  })

  describe('handle', () => {
    it('crée la fonctionnalité', async () => {
      // When
      const result = await handler.handle({ id: 'PLAN_D_ACTION' })

      // Then
      expect(result._isSuccess).to.equal(true)
      const fonctionnalite =
        await FonctionnaliteSqlModel.findByPk('PLAN_D_ACTION')
      expect(fonctionnalite).not.to.equal(null)
    })

    it('ne fait rien quand la fonctionnalité existe déjà', async () => {
      // Given
      await FonctionnaliteSqlModel.create({ id: 'PLAN_D_ACTION' })

      // When
      const result = await handler.handle({ id: 'PLAN_D_ACTION' })

      // Then
      expect(result._isSuccess).to.equal(true)
      expect(await FonctionnaliteSqlModel.count()).to.equal(1)
    })
  })
})
