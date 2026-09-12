import { before } from 'mocha'
import { SupprimerConseillersFonctionnaliteCommandHandler } from '../../../../src/application/commands/support/supprimer-conseillers-fonctionnalite.command.handler.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import { FonctionnaliteConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite-conseiller.sql-model'
import { FonctionnaliteSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { expect } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

describe('SupprimerConseillersFonctionnaliteCommandHandler', () => {
  let databaseForTesting: DatabaseForTesting
  let handler: SupprimerConseillersFonctionnaliteCommandHandler

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    await FonctionnaliteSqlModel.bulkCreate([
      { id: 'PLAN_D_ACTION' },
      { id: 'PHASE_A' }
    ])
    await FonctionnaliteConseillerSqlModel.bulkCreate([
      {
        idFonctionnalite: 'PLAN_D_ACTION',
        emailConseiller: 'c1@email.com',
        dateActivation: null
      },
      {
        idFonctionnalite: 'PLAN_D_ACTION',
        emailConseiller: 'c2@email.com',
        dateActivation: null
      },
      {
        idFonctionnalite: 'PHASE_A',
        emailConseiller: 'c1@email.com',
        dateActivation: null
      }
    ])
    handler = new SupprimerConseillersFonctionnaliteCommandHandler()
  })

  describe('handle', () => {
    it('supprime uniquement les emails demandés pour la fonctionnalité donnée', async () => {
      // When
      const result = await handler.handle({
        idFonctionnalite: 'PLAN_D_ACTION',
        emailConseillers: ['c1@email.com']
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const restants = await FonctionnaliteConseillerSqlModel.findAll({
        order: [
          ['idFonctionnalite', 'ASC'],
          ['emailConseiller', 'ASC']
        ]
      })
      expect(
        restants.map(row => `${row.idFonctionnalite}:${row.emailConseiller}`)
      ).to.deep.equal([`PHASE_A:c1@email.com`, `PLAN_D_ACTION:c2@email.com`])
    })

    it('vide la fonctionnalité avec supprimerTousLesConseillers', async () => {
      // When
      const result = await handler.handle({
        idFonctionnalite: 'PLAN_D_ACTION',
        supprimerTousLesConseillers: true
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const restants = await FonctionnaliteConseillerSqlModel.findAll()
      expect(
        restants.map(row => `${row.idFonctionnalite}:${row.emailConseiller}`)
      ).to.deep.equal([`PHASE_A:c1@email.com`])
    })

    it('refuse de deviner sans liste ni drapeau', async () => {
      // When
      const result = await handler.handle({
        idFonctionnalite: 'PLAN_D_ACTION'
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new MauvaiseCommandeError(
          'Renseigner emailConseillers ou supprimerTousLesConseillers'
        )
      })
      expect(await FonctionnaliteConseillerSqlModel.count()).to.equal(3)
    })

    it("échoue quand la fonctionnalité n'existe pas", async () => {
      // When
      const result = await handler.handle({
        idFonctionnalite: 'FONCTIONNALITE_INCONNUE',
        supprimerTousLesConseillers: true
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Fonctionnalité', 'FONCTIONNALITE_INCONNUE')
      })
      expect(await FonctionnaliteConseillerSqlModel.count()).to.equal(3)
    })
  })
})
