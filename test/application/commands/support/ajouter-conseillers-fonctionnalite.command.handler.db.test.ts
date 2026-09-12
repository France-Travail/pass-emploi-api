import { DateTime } from 'luxon'
import { before } from 'mocha'
import { AjouterConseillersFonctionnaliteCommandHandler } from '../../../../src/application/commands/support/ajouter-conseillers-fonctionnalite.command.handler.db'
import { NonTrouveError } from '../../../../src/building-blocks/types/domain-error'
import { FonctionnaliteConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite-conseiller.sql-model'
import { FonctionnaliteSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { expect } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

describe('AjouterConseillersFonctionnaliteCommandHandler', () => {
  const dateActivation = DateTime.fromISO('2026-11-20T00:00:00.000Z')

  let databaseForTesting: DatabaseForTesting
  let handler: AjouterConseillersFonctionnaliteCommandHandler

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    await FonctionnaliteSqlModel.bulkCreate([
      { id: 'PLAN_D_ACTION' },
      { id: 'PHASE_A' }
    ])
    handler = new AjouterConseillersFonctionnaliteCommandHandler()
  })

  describe('handle', () => {
    it('ajoute une ligne unique par email conseiller', async () => {
      // When
      const result = await handler.handle({
        idFonctionnalite: 'PLAN_D_ACTION',
        emailConseillers: ['c1@email.com', 'c2@email.com', 'c1@email.com']
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const rows = await FonctionnaliteConseillerSqlModel.findAll({
        where: { idFonctionnalite: 'PLAN_D_ACTION' },
        order: [['emailConseiller', 'ASC']]
      })
      expect(rows.map(row => row.emailConseiller)).to.deep.equal([
        'c1@email.com',
        'c2@email.com'
      ])
      expect(rows[0].dateActivation).to.equal(null)
    })

    it("enregistre la date d'activation quand elle est fournie", async () => {
      // When
      const result = await handler.handle({
        idFonctionnalite: 'PLAN_D_ACTION',
        emailConseillers: ['c1@email.com'],
        dateActivation
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const row = await FonctionnaliteConseillerSqlModel.findOne({
        where: { idFonctionnalite: 'PLAN_D_ACTION' }
      })
      expect(row!.dateActivation!.toISOString()).to.equal(
        dateActivation.toUTC().toISO()
      )
    })

    it("remplace la date d'activation d'un conseiller déjà affecté", async () => {
      // Given
      await FonctionnaliteConseillerSqlModel.create({
        idFonctionnalite: 'PLAN_D_ACTION',
        emailConseiller: 'c1@email.com',
        dateActivation: null
      })

      // When
      const result = await handler.handle({
        idFonctionnalite: 'PLAN_D_ACTION',
        emailConseillers: ['c1@email.com'],
        dateActivation
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      expect(await FonctionnaliteConseillerSqlModel.count()).to.equal(1)
      const row = await FonctionnaliteConseillerSqlModel.findOne()
      expect(row!.dateActivation!.toISOString()).to.equal(
        dateActivation.toUTC().toISO()
      )
    })

    it("n'affecte pas les autres fonctionnalités", async () => {
      // Given
      await FonctionnaliteConseillerSqlModel.create({
        idFonctionnalite: 'PHASE_A',
        emailConseiller: 'c1@email.com',
        dateActivation: null
      })

      // When
      await handler.handle({
        idFonctionnalite: 'PLAN_D_ACTION',
        emailConseillers: ['c1@email.com'],
        dateActivation
      })

      // Then
      const autre = await FonctionnaliteConseillerSqlModel.findOne({
        where: { idFonctionnalite: 'PHASE_A' }
      })
      expect(autre!.dateActivation).to.equal(null)
    })

    it("échoue quand la fonctionnalité n'existe pas", async () => {
      // When
      const result = await handler.handle({
        idFonctionnalite: 'FONCTIONNALITE_INCONNUE',
        emailConseillers: ['c1@email.com']
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Fonctionnalité', 'FONCTIONNALITE_INCONNUE')
      })
      expect(await FonctionnaliteConseillerSqlModel.count()).to.equal(0)
    })
  })
})
