import { before } from 'mocha'
import { SupprimerFonctionnaliteCommandHandler } from '../../../../src/application/commands/support/supprimer-fonctionnalite.command.handler.db'
import { NonTrouveError } from '../../../../src/building-blocks/types/domain-error'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { FonctionnaliteConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite-conseiller.sql-model'
import { FonctionnaliteSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { expect } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

describe('SupprimerFonctionnaliteCommandHandler', () => {
  let databaseForTesting: DatabaseForTesting
  let handler: SupprimerFonctionnaliteCommandHandler

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    await ConseillerSqlModel.creer(
      unConseillerDto({ id: 'c-1', email: 'c1@email.com' })
    )
    await FonctionnaliteSqlModel.create({ id: 'PLAN_D_ACTION' })
    handler = new SupprimerFonctionnaliteCommandHandler()
  })

  describe('handle', () => {
    it('supprime la fonctionnalité et ses conseillers en cascade', async () => {
      // Given
      await FonctionnaliteConseillerSqlModel.create({
        idFonctionnalite: 'PLAN_D_ACTION',
        emailConseiller: 'c1@email.com',
        dateActivation: null
      })

      // When
      const result = await handler.handle({ id: 'PLAN_D_ACTION' })

      // Then
      expect(result._isSuccess).to.equal(true)
      expect(await FonctionnaliteSqlModel.count()).to.equal(0)
      expect(await FonctionnaliteConseillerSqlModel.count()).to.equal(0)
    })

    it("échoue quand la fonctionnalité n'existe pas", async () => {
      // When
      const result = await handler.handle({ id: 'FONCTIONNALITE_INCONNUE' })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Fonctionnalité', 'FONCTIONNALITE_INCONNUE')
      })
    })
  })
})
