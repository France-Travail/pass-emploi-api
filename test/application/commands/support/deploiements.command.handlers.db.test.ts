import { DateTime } from 'luxon'
import { before } from 'mocha'
import { CreerDeploiementCommandHandler } from '../../../../src/application/commands/support/creer-deploiement.command.handler.db'
import { SupprimerDeploiementCommandHandler } from '../../../../src/application/commands/support/supprimer-deploiement.command.handler.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import { isSuccess } from '../../../../src/building-blocks/types/result'
import { Deploiement } from '../../../../src/domain/deploiement'
import { DeploiementSqlModel } from '../../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { PopulationSqlModel } from '../../../../src/infrastructure/sequelize/models/population.sql-model'
import { expect } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

describe('Déploiements : handlers support', () => {
  const date = DateTime.fromISO('2026-10-13T00:00:00.000Z')

  let databaseForTesting: DatabaseForTesting

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    await PopulationSqlModel.create({ id: 'PILOTE', description: null })
    await FonctionnaliteSqlModel.create({ id: 'PLAN_D_ACTION' })
  })

  describe('CreerDeploiementCommandHandler', () => {
    const handler = new CreerDeploiementCommandHandler()

    it('crée un déploiement de fonctionnalité', async () => {
      // When
      const result = await handler.handle({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation: date
      })

      // Then
      expect(isSuccess(result)).to.equal(true)
      const deploiement = await DeploiementSqlModel.findOne()
      expect(deploiement!.idPopulation).to.equal('PILOTE')
      expect(deploiement!.idFonctionnalite).to.equal('PLAN_D_ACTION')
      expect(deploiement!.dateActivation.toISOString()).to.equal(
        date.toJSDate().toISOString()
      )
    })

    it('crée un déploiement de migration', async () => {
      // When
      const result = await handler.handle({
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PILOTE',
        dateActivation: date
      })

      // Then
      expect(isSuccess(result)).to.equal(true)
      const deploiement = await DeploiementSqlModel.findOne()
      expect(deploiement!.nature).to.equal(Deploiement.Nature.MIGRATION)
      expect(deploiement!.idFonctionnalite).to.equal(null)
    })

    it('déplace la date quand le couple population et fonctionnalité existe déjà', async () => {
      // Given
      const premier = await handler.handle({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation: date
      })

      // When
      const second = await handler.handle({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation: date.plus({ days: 7 })
      })

      // Then
      expect(second).to.deep.equal(premier)
      expect(await DeploiementSqlModel.count()).to.equal(1)
      const deploiement = await DeploiementSqlModel.findOne()
      expect(deploiement!.dateActivation.toISOString()).to.equal(
        date.plus({ days: 7 }).toJSDate().toISOString()
      )
    })

    it('refuse une fonctionnalité sans idFonctionnalite', async () => {
      // When
      const result = await handler.handle({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        dateActivation: date
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new MauvaiseCommandeError(
          'Un déploiement de nature FONCTIONNALITE exige idFonctionnalite'
        )
      })
    })

    it('refuse une migration avec idFonctionnalite', async () => {
      // When
      const result = await handler.handle({
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation: date
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new MauvaiseCommandeError(
          'Un déploiement de nature MIGRATION ne porte pas de fonctionnalité'
        )
      })
    })

    it('échoue sur une population ou une fonctionnalité inconnue', async () => {
      // When
      const population = await handler.handle({
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'INCONNUE',
        dateActivation: date
      })
      const fonctionnalite = await handler.handle({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'INCONNUE',
        dateActivation: date
      })

      // Then
      expect(population).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Population', 'INCONNUE')
      })
      expect(fonctionnalite).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Fonctionnalité', 'INCONNUE')
      })
    })
  })

  describe('SupprimerDeploiementCommandHandler', () => {
    const handler = new SupprimerDeploiementCommandHandler()

    it('supprime le déploiement', async () => {
      // Given
      const deploiement = await DeploiementSqlModel.create({
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PILOTE',
        idFonctionnalite: null,
        dateActivation: date.toJSDate()
      })

      // When
      const result = await handler.handle({ id: deploiement.id })

      // Then
      expect(result._isSuccess).to.equal(true)
      expect(await DeploiementSqlModel.count()).to.equal(0)
    })

    it('échoue sur un id inconnu', async () => {
      // When
      const result = await handler.handle({ id: 999 })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Déploiement', '999')
      })
    })
  })
})
