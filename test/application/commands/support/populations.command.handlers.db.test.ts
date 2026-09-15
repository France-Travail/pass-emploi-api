import { before } from 'mocha'
import { AjouterConseillersPopulationCommandHandler } from '../../../../src/application/commands/support/ajouter-conseillers-population.command.handler.db'
import { AjouterProfilPopulationCommandHandler } from '../../../../src/application/commands/support/ajouter-profil-population.command.handler.db'
import { CreerPopulationCommandHandler } from '../../../../src/application/commands/support/creer-population.command.handler.db'
import { SupprimerConseillersPopulationCommandHandler } from '../../../../src/application/commands/support/supprimer-conseillers-population.command.handler.db'
import { SupprimerPopulationCommandHandler } from '../../../../src/application/commands/support/supprimer-population.command.handler.db'
import { SupprimerProfilPopulationCommandHandler } from '../../../../src/application/commands/support/supprimer-profil-population.command.handler.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import { Deploiement } from '../../../../src/domain/deploiement'
import { Profil } from '../../../../src/domain/profil'
import { PopulationSqlRepository } from '../../../../src/infrastructure/repositories/population.repository.db'
import { DeploiementSqlModel } from '../../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { PopulationConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../../src/infrastructure/sequelize/models/population.sql-model'
import { expect } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

describe('Populations : handlers support', () => {
  const populationRepository = new PopulationSqlRepository(
    getDatabase().sequelize
  )
  let databaseForTesting: DatabaseForTesting

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    await PopulationSqlModel.create({ id: 'PILOTE', description: 'Pilote' })
  })

  describe('CreerPopulationCommandHandler', () => {
    const handler = new CreerPopulationCommandHandler()

    it('crée une population', async () => {
      // When
      const result = await handler.handle({
        id: 'FT_CEJ',
        description: 'Tous les CEJ FT'
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await PopulationSqlModel.findByPk('FT_CEJ')
      expect(population!.description).to.equal('Tous les CEJ FT')
    })

    it('met à jour la description sans toucher aux cibles', async () => {
      // Given
      await PopulationConseillerSqlModel.create({
        idPopulation: 'PILOTE',
        emailConseiller: 'a@ft.fr'
      })

      // When
      await handler.handle({ id: 'PILOTE', description: 'Pilote 1J1S' })

      // Then
      const population = await PopulationSqlModel.findByPk('PILOTE')
      expect(population!.description).to.equal('Pilote 1J1S')
      expect(await PopulationConseillerSqlModel.count()).to.equal(1)
    })
  })

  describe('SupprimerPopulationCommandHandler', () => {
    const handler = new SupprimerPopulationCommandHandler(populationRepository)

    it('supprime la population et ses cibles', async () => {
      // Given
      await PopulationConseillerSqlModel.create({
        idPopulation: 'PILOTE',
        emailConseiller: 'a@ft.fr'
      })
      await PopulationProfilSqlModel.create({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.MILO,
        dispositif: null
      })

      // When
      const result = await handler.handle({ id: 'PILOTE' })

      // Then
      expect(result._isSuccess).to.equal(true)
      expect(await PopulationSqlModel.count()).to.equal(0)
      expect(await PopulationConseillerSqlModel.count()).to.equal(0)
      expect(await PopulationProfilSqlModel.count()).to.equal(0)
    })

    it('refuse tant qu’un déploiement la vise', async () => {
      // Given
      await FonctionnaliteSqlModel.create({ id: 'PLAN_D_ACTION' })
      await DeploiementSqlModel.create({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation: new Date()
      })

      // When
      const result = await handler.handle({ id: 'PILOTE' })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new MauvaiseCommandeError(
          "La population PILOTE est visée par 1 déploiement(s), les supprimer d'abord"
        )
      })
    })

    it("échoue quand la population n'existe pas", async () => {
      // When
      const result = await handler.handle({ id: 'INCONNUE' })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Population', 'INCONNUE')
      })
    })
  })

  describe('AjouterConseillersPopulationCommandHandler', () => {
    const handler = new AjouterConseillersPopulationCommandHandler(
      populationRepository
    )

    it('ajoute une ligne par email, sans doublon', async () => {
      // Given
      await PopulationConseillerSqlModel.create({
        idPopulation: 'PILOTE',
        emailConseiller: 'a@ft.fr'
      })

      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        emailConseillers: ['a@ft.fr', 'b@ft.fr', 'b@ft.fr']
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const rows = await PopulationConseillerSqlModel.findAll({
        order: [['emailConseiller', 'ASC']]
      })
      expect(rows.map(r => r.emailConseiller)).to.deep.equal([
        'a@ft.fr',
        'b@ft.fr'
      ])
    })

    it("échoue quand la population n'existe pas", async () => {
      // When
      const result = await handler.handle({
        idPopulation: 'INCONNUE',
        emailConseillers: ['a@ft.fr']
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Population', 'INCONNUE')
      })
    })
  })

  describe('SupprimerConseillersPopulationCommandHandler', () => {
    const handler = new SupprimerConseillersPopulationCommandHandler(
      populationRepository
    )

    beforeEach(async () => {
      await PopulationConseillerSqlModel.bulkCreate([
        { idPopulation: 'PILOTE', emailConseiller: 'a@ft.fr' },
        { idPopulation: 'PILOTE', emailConseiller: 'b@ft.fr' }
      ])
    })

    it('retire les emails demandés', async () => {
      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        emailConseillers: ['a@ft.fr']
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const rows = await PopulationConseillerSqlModel.findAll()
      expect(rows.map(r => r.emailConseiller)).to.deep.equal(['b@ft.fr'])
    })

    it('vide la population avec supprimerTous', async () => {
      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        supprimerTous: true
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      expect(await PopulationConseillerSqlModel.count()).to.equal(0)
    })
  })

  describe('AjouterProfilPopulationCommandHandler', () => {
    const handler = new AjouterProfilPopulationCommandHandler(
      populationRepository
    )

    it('ajoute un profil, sans doublon', async () => {
      // When
      await handler.handle({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.CEJ
      })
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.CEJ
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const rows = await PopulationProfilSqlModel.findAll()
      expect(rows).to.have.length(1)
      expect(rows[0].structure).to.equal(Profil.Structure.FRANCE_TRAVAIL)
      expect(rows[0].dispositif).to.equal(Profil.Dispositif.CEJ)
    })

    it('ajoute un profil sans dispositif, qui couvre toute la structure', async () => {
      // When
      await handler.handle({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.MILO
      })
      await handler.handle({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.MILO
      })

      // Then
      const rows = await PopulationProfilSqlModel.findAll()
      expect(rows).to.have.length(1)
      expect(rows[0].dispositif).to.equal(null)
    })
  })

  describe('SupprimerProfilPopulationCommandHandler', () => {
    const handler = new SupprimerProfilPopulationCommandHandler()

    it('retire exactement le profil demandé', async () => {
      // Given
      await PopulationProfilSqlModel.bulkCreate([
        {
          idPopulation: 'PILOTE',
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        },
        {
          idPopulation: 'PILOTE',
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: null
        }
      ])

      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.FRANCE_TRAVAIL
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const rows = await PopulationProfilSqlModel.findAll()
      expect(rows).to.have.length(1)
      expect(rows[0].dispositif).to.equal(Profil.Dispositif.CEJ)
    })

    it("échoue quand le profil n'existe pas", async () => {
      // Given
      await PopulationProfilSqlModel.create({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.CEJ
      })

      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.AIJ
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Profil', 'PILOTE/FRANCE_TRAVAIL/AIJ')
      })
      expect(await PopulationProfilSqlModel.count()).to.equal(1)
    })
  })
})
