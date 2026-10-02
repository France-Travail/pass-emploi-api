import { before } from 'mocha'
import { AjouterAgenceFTPopulationCommandHandler } from '../../../../src/application/commands/support/ajouter-agence-ft-population.command.handler.db'
import { AjouterStructureMiloPopulationCommandHandler } from '../../../../src/application/commands/support/ajouter-structure-milo-population.command.handler.db'
import { SupprimerAgenceFTPopulationCommandHandler } from '../../../../src/application/commands/support/supprimer-agence-ft-population.command.handler.db'
import { SupprimerStructureMiloPopulationCommandHandler } from '../../../../src/application/commands/support/supprimer-structure-milo-population.command.handler.db'
import { AjouterConseillersPopulationCommandHandler } from '../../../../src/application/commands/support/ajouter-conseillers-population.command.handler.db'
import { AjouterProfilPopulationCommandHandler } from '../../../../src/application/commands/support/ajouter-profil-population.command.handler.db'
import { CreerPopulationCommandHandler } from '../../../../src/application/commands/support/creer-population.command.handler.db'
import { SupprimerConseillersPopulationCommandHandler } from '../../../../src/application/commands/support/supprimer-conseillers-population.command.handler.db'
import { SupprimerPopulationCommandHandler } from '../../../../src/application/commands/support/supprimer-population.command.handler.db'
import { SupprimerProfilPopulationCommandHandler } from '../../../../src/application/commands/support/supprimer-profil-population.command.handler.db'
import { GetPopulationSupportQueryHandler } from '../../../../src/application/queries/get-population-support.query.handler.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import {
  isFailure,
  isSuccess
} from '../../../../src/building-blocks/types/result'
import { Communication } from '../../../../src/domain/communication'
import { Deploiement } from '../../../../src/domain/deploiement'
import { Profil } from '../../../../src/domain/profil'
import { PopulationSqlRepository } from '../../../../src/infrastructure/repositories/population.repository.db'
import { CommunicationSqlRepository } from '../../../../src/infrastructure/repositories/communication.repository.db'
import { AgenceSqlModel } from '../../../../src/infrastructure/sequelize/models/agence.sql-model'
import { CommunicationSqlModel } from '../../../../src/infrastructure/sequelize/models/communication.sql-model'
import { PopulationAgenceFTSqlModel } from '../../../../src/infrastructure/sequelize/models/population-agence-ft.sql-model'
import { StructureMiloSqlModel } from '../../../../src/infrastructure/sequelize/models/structure-milo.sql-model'
import { uneAgenceDto } from '../../../fixtures/sql-models/agence.sql-model'
import { uneStructureMiloDto } from '../../../fixtures/sql-models/structureMilo.sql-model'
import { DeploiementSqlModel } from '../../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
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
  let getPopulation: GetPopulationSupportQueryHandler

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    await PopulationSqlModel.create({ id: 'PILOTE', description: 'Pilote' })
    getPopulation = new GetPopulationSupportQueryHandler(
      new CommunicationSqlRepository(databaseForTesting.sequelize)
    )
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
      const population = await getPopulation.handle({ idPopulation: 'FT_CEJ' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.description).to.equal('Tous les CEJ FT')
    })

    it('met à jour la description sans toucher aux cibles', async () => {
      // Given
      const ajouterConseillers = new AjouterConseillersPopulationCommandHandler(
        populationRepository
      )
      await ajouterConseillers.handle({
        idPopulation: 'PILOTE',
        emailConseillers: ['a@ft.fr']
      })

      // When
      await handler.handle({
        id: 'PILOTE',
        description: 'Pilote 1J1S'
      })

      // Then
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.description).to.equal('Pilote 1J1S')
      expect(population.data.conseillers).to.deep.equal(['a@ft.fr'])
    })
  })

  describe('SupprimerPopulationCommandHandler', () => {
    const handler = new SupprimerPopulationCommandHandler(populationRepository)

    it('supprime la population, ses cibles et ses communications', async () => {
      // Given
      const ajouterConseillers = new AjouterConseillersPopulationCommandHandler(
        populationRepository
      )
      const ajouterProfil = new AjouterProfilPopulationCommandHandler(
        populationRepository
      )
      await ajouterConseillers.handle({
        idPopulation: 'PILOTE',
        emailConseillers: ['a@ft.fr']
      })
      await ajouterProfil.handle({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.MILO
      })
      await CommunicationSqlModel.create({
        idPopulation: 'PILOTE',
        destinataire: Communication.Destinataire.CONSEILLER,
        type: Communication.Type.IN_APP,
        dateDebut: new Date('2026-09-30T00:00:00.000Z'),
        dateFin: new Date('2026-10-15T00:00:00.000Z'),
        titre: 'Titre',
        contenu: 'Contenu'
      })

      // When
      const result = await handler.handle({ id: 'PILOTE' })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      expect(isFailure(population)).to.equal(true)
      if (isFailure(population)) {
        expect(population.error).to.deep.equal(
          new NonTrouveError('Population', 'PILOTE')
        )
      }
      expect(await CommunicationSqlModel.count()).to.equal(0)
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
      await handler.handle({
        idPopulation: 'PILOTE',
        emailConseillers: ['a@ft.fr']
      })

      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        emailConseillers: ['a@ft.fr', 'b@ft.fr', 'b@ft.fr']
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.conseillers).to.deep.equal(['a@ft.fr', 'b@ft.fr'])
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
    const ajouterConseillers = new AjouterConseillersPopulationCommandHandler(
      populationRepository
    )

    beforeEach(async () => {
      await ajouterConseillers.handle({
        idPopulation: 'PILOTE',
        emailConseillers: ['a@ft.fr', 'b@ft.fr']
      })
    })

    it('retire les emails demandés', async () => {
      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        emailConseillers: ['a@ft.fr']
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.conseillers).to.deep.equal(['b@ft.fr'])
    })

    it('vide la population avec supprimerTous', async () => {
      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        supprimerTous: true
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.conseillers).to.deep.equal([])
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
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.profils).to.deep.equal([
        {
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        }
      ])
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
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.profils).to.deep.equal([
        { structure: Profil.Structure.MILO, dispositif: undefined }
      ])
    })
  })

  describe('AjouterStructureMiloPopulationCommandHandler', () => {
    const handler = new AjouterStructureMiloPopulationCommandHandler(
      populationRepository
    )

    beforeEach(async () => {
      await StructureMiloSqlModel.create(uneStructureMiloDto({ id: 'SM1' }))
    })

    it('ajoute une structure MiLo, sans doublon', async () => {
      // When
      await handler.handle({ idPopulation: 'PILOTE', idStructureMilo: 'SM1' })
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idStructureMilo: 'SM1'
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.structuresMilo).to.deep.equal(['SM1'])
    })

    it("échoue quand la structure MiLo n'existe pas", async () => {
      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idStructureMilo: 'INCONNUE'
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Structure MiLo', 'INCONNUE')
      })
    })

    it("échoue quand la population n'existe pas", async () => {
      // When
      const result = await handler.handle({
        idPopulation: 'INCONNUE',
        idStructureMilo: 'SM1'
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Population', 'INCONNUE')
      })
    })
  })

  describe('SupprimerStructureMiloPopulationCommandHandler', () => {
    const handler = new SupprimerStructureMiloPopulationCommandHandler()

    it('retire la structure demandée', async () => {
      // Given
      await StructureMiloSqlModel.create(uneStructureMiloDto({ id: 'SM1' }))
      const ajouter = new AjouterStructureMiloPopulationCommandHandler(
        populationRepository
      )
      await ajouter.handle({
        idPopulation: 'PILOTE',
        idStructureMilo: 'SM1'
      })

      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idStructureMilo: 'SM1'
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.structuresMilo).to.deep.equal([])
    })

    it("échoue quand la structure n'est pas dans la population", async () => {
      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idStructureMilo: 'SM2'
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError(
          'Structure MiLo de la population',
          'PILOTE/SM2'
        )
      })
    })
  })

  describe('AjouterAgenceFTPopulationCommandHandler', () => {
    const handler = new AjouterAgenceFTPopulationCommandHandler(
      populationRepository
    )

    beforeEach(async () => {
      await AgenceSqlModel.create(uneAgenceDto({ id: 'AG1' }))
    })

    it('ajoute une agence, sans doublon', async () => {
      // When
      await handler.handle({ idPopulation: 'PILOTE', idAgence: 'AG1' })
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idAgence: 'AG1'
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.agencesFT).to.deep.equal([
        { idAgence: 'AG1', dispositifs: undefined }
      ])
    })

    it('remplace la liste de dispositifs en rejouant, sur une seule ligne par agence', async () => {
      // When
      await handler.handle({ idPopulation: 'PILOTE', idAgence: 'AG1' })
      const apresAjout = await getPopulation.handle({ idPopulation: 'PILOTE' })
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idAgence: 'AG1',
        dispositifs: [Profil.Dispositif.CEJ, Profil.Dispositif.AIJ]
      })
      const apresRestriction = await getPopulation.handle({
        idPopulation: 'PILOTE'
      })
      await handler.handle({ idPopulation: 'PILOTE', idAgence: 'AG1' })
      const apresRetourATous = await getPopulation.handle({
        idPopulation: 'PILOTE'
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      if (!isSuccess(apresAjout)) throw new Error('devrait réussir')
      if (!isSuccess(apresRestriction)) throw new Error('devrait réussir')
      if (!isSuccess(apresRetourATous)) throw new Error('devrait réussir')
      expect(apresAjout.data.agencesFT).to.deep.equal([
        { idAgence: 'AG1', dispositifs: undefined }
      ])
      expect(apresRestriction.data.agencesFT).to.deep.equal([
        {
          idAgence: 'AG1',
          dispositifs: [Profil.Dispositif.CEJ, Profil.Dispositif.AIJ]
        }
      ])
      expect(apresRetourATous.data.agencesFT).to.deep.equal([
        { idAgence: 'AG1', dispositifs: undefined }
      ])
    })

    it("refuse une agence qui n'est pas France Travail", async () => {
      // Given
      await AgenceSqlModel.create(
        uneAgenceDto({ id: 'AG_MILO', structure: Profil.Structure.MILO })
      )

      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idAgence: 'AG_MILO'
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new MauvaiseCommandeError(
          "L'agence AG_MILO n'est pas une agence France Travail"
        )
      })
      expect(await PopulationAgenceFTSqlModel.count()).to.equal(0)
    })

    it("échoue quand l'agence n'existe pas", async () => {
      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idAgence: 'INCONNUE'
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Agence', 'INCONNUE')
      })
    })
  })

  describe('SupprimerAgenceFTPopulationCommandHandler', () => {
    const handler = new SupprimerAgenceFTPopulationCommandHandler()
    const ajouter = new AjouterAgenceFTPopulationCommandHandler(
      populationRepository
    )

    beforeEach(async () => {
      await AgenceSqlModel.create(uneAgenceDto({ id: 'AG1' }))
    })

    it("retire l'agence demandée", async () => {
      // Given
      await ajouter.handle({
        idPopulation: 'PILOTE',
        idAgence: 'AG1'
      })

      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idAgence: 'AG1'
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.agencesFT).to.deep.equal([])
    })

    it("retire l'agence avec ses dispositifs", async () => {
      // Given
      await ajouter.handle({
        idPopulation: 'PILOTE',
        idAgence: 'AG1',
        dispositifs: [Profil.Dispositif.CEJ, Profil.Dispositif.AIJ]
      })

      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idAgence: 'AG1'
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.agencesFT).to.deep.equal([])
    })

    it("échoue quand l'agence n'est pas dans la population", async () => {
      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        idAgence: 'AG2'
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Agence de la population', 'PILOTE/AG2')
      })
    })
  })

  describe('SupprimerProfilPopulationCommandHandler', () => {
    const handler = new SupprimerProfilPopulationCommandHandler()
    const ajouter = new AjouterProfilPopulationCommandHandler(
      populationRepository
    )

    it('retire exactement le profil demandé', async () => {
      // Given
      await ajouter.handle({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.CEJ
      })
      await ajouter.handle({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.FRANCE_TRAVAIL
      })

      // When
      const result = await handler.handle({
        idPopulation: 'PILOTE',
        structure: Profil.Structure.FRANCE_TRAVAIL
      })

      // Then
      expect(result._isSuccess).to.equal(true)
      const population = await getPopulation.handle({ idPopulation: 'PILOTE' })
      if (!isSuccess(population)) throw new Error('devrait réussir')
      expect(population.data.profils).to.deep.equal([
        {
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        }
      ])
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
