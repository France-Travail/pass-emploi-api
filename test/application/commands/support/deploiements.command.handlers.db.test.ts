import { DateTime } from 'luxon'
import { before } from 'mocha'
import { CreerDeploiementCommandHandler } from '../../../../src/application/commands/support/creer-deploiement.command.handler.db'
import { ModifierDateDeploiementCommandHandler } from '../../../../src/application/commands/support/modifier-date-deploiement.command.handler.db'
import { SupprimerDeploiementCommandHandler } from '../../../../src/application/commands/support/supprimer-deploiement.command.handler.db'
import { GetPopulationSupportQueryHandler } from '../../../../src/application/queries/get-population-support.query.handler.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import { isSuccess } from '../../../../src/building-blocks/types/result'
import { Deploiement } from '../../../../src/domain/deploiement'
import { PopulationSqlRepository } from '../../../../src/infrastructure/repositories/population.repository.db'
import { CommunicationSqlRepository } from '../../../../src/infrastructure/repositories/communication.repository.db'
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
  let getPopulation: GetPopulationSupportQueryHandler

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    await PopulationSqlModel.create({ id: 'PILOTE', description: null })
    await FonctionnaliteSqlModel.create({ id: 'PLAN_D_ACTION' })
    getPopulation = new GetPopulationSupportQueryHandler(
      new CommunicationSqlRepository(databaseForTesting.sequelize)
    )
  })

  describe('CreerDeploiementCommandHandler', () => {
    const handler = new CreerDeploiementCommandHandler(
      new PopulationSqlRepository(getDatabase().sequelize)
    )

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
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.deploiements).to.have.length(1)
      expect(population.data.deploiements[0].nature).to.equal(
        Deploiement.Nature.FONCTIONNALITE
      )
      expect(population.data.deploiements[0].idFonctionnalite).to.equal(
        'PLAN_D_ACTION'
      )
      expect(population.data.deploiements[0].dateActivation).to.equal(
        date.toUTC().toISO()
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
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.deploiements).to.have.length(1)
      expect(population.data.deploiements[0].nature).to.equal(
        Deploiement.Nature.MIGRATION
      )
      expect(population.data.deploiements[0].idFonctionnalite).to.equal(
        undefined
      )
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
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.deploiements).to.have.length(1)
      expect(population.data.deploiements[0].dateActivation).to.equal(
        date.plus({ days: 7 }).toUTC().toISO()
      )
    })

    it('déplace la date quand la population a déjà une migration', async () => {
      // Given
      const premier = await handler.handle({
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PILOTE',
        dateActivation: date
      })

      // When
      const second = await handler.handle({
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PILOTE',
        dateActivation: date.plus({ days: 7 })
      })

      // Then
      expect(second).to.deep.equal(premier)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.deploiements).to.have.length(1)
      expect(population.data.deploiements[0].dateActivation).to.equal(
        date.plus({ days: 7 }).toUTC().toISO()
      )
    })

    it('ne doublonne pas sur deux appels simultanés', async () => {
      // When
      const resultats = await Promise.all(
        [date, date.plus({ days: 1 }), date.plus({ days: 2 })].map(
          dateActivation =>
            handler.handle({
              nature: Deploiement.Nature.FONCTIONNALITE,
              idPopulation: 'PILOTE',
              idFonctionnalite: 'PLAN_D_ACTION',
              dateActivation
            })
        )
      )

      // Then
      expect(resultats.every(isSuccess)).to.equal(true)
      expect(await DeploiementSqlModel.count()).to.equal(1)
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

  describe('ModifierDateDeploiementCommandHandler', () => {
    const handler = new ModifierDateDeploiementCommandHandler()
    const creer = new CreerDeploiementCommandHandler(
      new PopulationSqlRepository(getDatabase().sequelize)
    )

    it('déplace la date sans toucher au reste', async () => {
      // Given
      const resultCreation = await creer.handle({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation: date
      })
      if (!isSuccess(resultCreation)) throw new Error('devrait réussir')
      const idDeploiement = resultCreation.data.id

      // When
      const result = await handler.handle({
        id: idDeploiement,
        dateActivation: date.plus({ days: 20 })
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.deploiements).to.have.length(1)
      expect(population.data.deploiements[0].dateActivation).to.equal(
        date.plus({ days: 20 }).toUTC().toISO()
      )
      expect(population.data.deploiements[0].idFonctionnalite).to.equal(
        'PLAN_D_ACTION'
      )
    })

    it('échoue sur un id inconnu', async () => {
      // When
      const result = await handler.handle({ id: 999, dateActivation: date })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Déploiement', '999')
      })
    })
  })

  describe('SupprimerDeploiementCommandHandler', () => {
    const handler = new SupprimerDeploiementCommandHandler()
    const creer = new CreerDeploiementCommandHandler(
      new PopulationSqlRepository(getDatabase().sequelize)
    )

    it('supprime le déploiement', async () => {
      // Given
      const resultCreation = await creer.handle({
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PILOTE',
        dateActivation: date
      })
      if (!isSuccess(resultCreation)) throw new Error('devrait réussir')
      const idDeploiement = resultCreation.data.id

      // When
      const result = await handler.handle({ id: idDeploiement })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.deploiements).to.deep.equal([])
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
