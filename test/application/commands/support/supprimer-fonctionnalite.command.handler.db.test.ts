import { before } from 'mocha'
import { SupprimerFonctionnaliteCommandHandler } from '../../../../src/application/commands/support/supprimer-fonctionnalite.command.handler.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import { Deploiement } from '../../../../src/domain/deploiement'
import { DeploiementSqlModel } from '../../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { PopulationSqlModel } from '../../../../src/infrastructure/sequelize/models/population.sql-model'
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
    await FonctionnaliteSqlModel.create({ id: 'PLAN_D_ACTION' })
    handler = new SupprimerFonctionnaliteCommandHandler()
  })

  describe('handle', () => {
    it('supprime la fonctionnalité', async () => {
      // When
      const result = await handler.handle({ id: 'PLAN_D_ACTION' })

      // Then
      expect(result._isSuccess).to.equal(true)
      expect(await FonctionnaliteSqlModel.count()).to.equal(0)
    })

    it('refuse tant qu’un déploiement la vise', async () => {
      // Given
      await PopulationSqlModel.create({ id: 'PILOTE', description: null })
      await DeploiementSqlModel.create({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation: new Date()
      })

      // When
      const result = await handler.handle({ id: 'PLAN_D_ACTION' })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new MauvaiseCommandeError(
          "La fonctionnalité PLAN_D_ACTION est visée par 1 déploiement(s), les supprimer d'abord"
        )
      })
      expect(await FonctionnaliteSqlModel.count()).to.equal(1)
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
