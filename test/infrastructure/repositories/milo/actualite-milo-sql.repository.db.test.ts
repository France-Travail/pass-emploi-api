import { DateTime } from 'luxon'
import { ActualiteMilo } from 'src/domain/milo/actualite.milo'
import { ActualiteMiloSqlRepository } from 'src/infrastructure/repositories/milo/actualite-milo-sql.repository.db'
import { ActualiteMiloSqlModel } from 'src/infrastructure/sequelize/models/actualite-milo.sql-model'
import { StructureMiloSqlModel } from 'src/infrastructure/sequelize/models/structure-milo.sql-model'
import { uneActualiteMilo } from '../../../fixtures/actualite-milo.fixture'
import { expect } from '../../../utils'
import { getDatabase } from '../../../utils/database-for-testing'

describe('ActualiteMiloSqlRepository', () => {
  let actualiteMiloSqlRepository: ActualiteMiloSqlRepository
  const idStructureMilo = 'structure-milo-1'

  beforeEach(async () => {
    await getDatabase().cleanPG()
    actualiteMiloSqlRepository = new ActualiteMiloSqlRepository()

    // Créer la structure MILO requise (FK)
    await StructureMiloSqlModel.create({
      id: idStructureMilo,
      nomOfficiel: 'Structure Test',
      timezone: 'Europe/Paris'
    })
  })

  describe('save', () => {
    it('crée une nouvelle actualité', async () => {
      // Given
      const actualite = uneActualiteMilo()

      // When
      await actualiteMiloSqlRepository.save(actualite)

      // Then
      const actualiteTrouvee = await ActualiteMiloSqlModel.findByPk(
        actualite.id
      )
      expect(actualiteTrouvee).to.exist()
      expect(actualiteTrouvee!.id).to.equal(actualite.id)
      expect(actualiteTrouvee!.idStructureMilo).to.equal(idStructureMilo)
      expect(actualiteTrouvee!.idConseiller).to.equal(actualite.idConseiller)
      expect(actualiteTrouvee!.prenomNomConseiller).to.equal(
        actualite.prenomNomConseiller
      )
      expect(actualiteTrouvee!.titre).to.equal(actualite.titre)
      expect(actualiteTrouvee!.contenu).to.equal(actualite.contenu)
      expect(actualiteTrouvee!.titreLien).to.equal(actualite.titreLien)
      expect(actualiteTrouvee!.lien).to.equal(actualite.lien)
    })

    it('crée une actualité sans lien optionnel', async () => {
      // Given
      const actualite = uneActualiteMilo({
        idStructureMilo,
        titreLien: undefined,
        lien: undefined
      })

      // When
      await actualiteMiloSqlRepository.save(actualite)

      // Then
      const actualiteTrouvee = await ActualiteMiloSqlModel.findByPk(
        actualite.id
      )
      expect(actualiteTrouvee!.titreLien).to.be.null()
      expect(actualiteTrouvee!.lien).to.be.null()
    })

    it('garde le titre fourni quand le lien et le titre existent', async () => {
      // Given
      const actualite = uneActualiteMilo({
        idStructureMilo,
        titreLien: 'Mon titre personnalisé',
        lien: 'https://example.com'
      })

      // When
      await actualiteMiloSqlRepository.save(actualite)

      // Then
      const actualiteTrouvee = await ActualiteMiloSqlModel.findByPk(
        actualite.id
      )
      expect(actualiteTrouvee!.titreLien).to.equal('Mon titre personnalisé')
      expect(actualiteTrouvee!.lien).to.equal('https://example.com')
    })

    it('met à jour une actualité existante (upsert)', async () => {
      // Given
      const actualite = uneActualiteMilo({ idStructureMilo })
      await actualiteMiloSqlRepository.save(actualite)

      const actualiteModifiee: ActualiteMilo = {
        ...actualite,
        titre: 'Titre modifié',
        contenu: 'Contenu modifié',
        dateModification: DateTime.fromISO('2024-02-01T10:00:00.000Z')
      }

      // When
      await actualiteMiloSqlRepository.save(actualiteModifiee)

      // Then
      const actualiteTrouvee = await ActualiteMiloSqlModel.findByPk(
        actualite.id
      )
      expect(actualiteTrouvee!.titre).to.equal('Titre modifié')
      expect(actualiteTrouvee!.contenu).to.equal('Contenu modifié')
    })

    it('sauvegarde dateSuppression quand définie', async () => {
      // Given
      const dateSuppression = DateTime.fromISO('2024-03-01T10:00:00.000Z')
      const actualite = uneActualiteMilo({
        idStructureMilo,
        dateSuppression
      })

      // When
      await actualiteMiloSqlRepository.save(actualite)

      // Then
      const actualiteTrouvee = await ActualiteMiloSqlModel.findByPk(
        actualite.id
      )
      expect(actualiteTrouvee!.dateSuppression).to.exist()
    })

    it('sauvegarde null pour dateSuppression quand non définie', async () => {
      // Given
      const actualite = uneActualiteMilo({
        idStructureMilo,
        dateSuppression: undefined
      })

      // When
      await actualiteMiloSqlRepository.save(actualite)

      // Then
      const actualiteTrouvee = await ActualiteMiloSqlModel.findByPk(
        actualite.id
      )
      expect(actualiteTrouvee!.dateSuppression).to.be.null()
    })
  })

  describe('getByStructureMilo', () => {
    it('retourne les actualités triées par date de création croissante', async () => {
      // Given
      const actualite1 = uneActualiteMilo({
        idStructureMilo: idStructureMilo,
        titre: 'Actualité 1',
        dateCreation: DateTime.fromISO('2024-01-03T10:00:00.000Z')
      })
      const actualite2 = uneActualiteMilo({
        id: 'f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c6d',
        idStructureMilo: idStructureMilo,
        titre: 'Actualité 2',
        dateCreation: DateTime.fromISO('2024-01-01T10:00:00.000Z')
      })
      const actualite3 = uneActualiteMilo({
        id: 'f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c4d',
        idStructureMilo: idStructureMilo,
        titre: 'Actualité 3',
        dateCreation: DateTime.fromISO('2024-01-02T10:00:00.000Z')
      })

      await actualiteMiloSqlRepository.save(actualite1)
      await actualiteMiloSqlRepository.save(actualite2)
      await actualiteMiloSqlRepository.save(actualite3)

      // When
      const actualites =
        await actualiteMiloSqlRepository.getByStructureMilo(idStructureMilo)

      // Then
      expect(actualites).to.have.lengthOf(3)
      expect(actualites[0].id).to.equal('f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c6d')
      expect(actualites[1].id).to.equal('f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c4d')
      expect(actualites[2].id).to.equal('f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c5d')
    })

    it('retourne uniquement les actualités de la structure demandée', async () => {
      // Given
      const autreStructure = 'structure-milo-2'
      await StructureMiloSqlModel.create({
        id: autreStructure,
        nomOfficiel: 'Autre Structure',
        timezone: 'Europe/Paris'
      })

      const actualite1 = uneActualiteMilo({
        idStructureMilo,
        titre: 'Actualité Structure 1'
      })
      const actualite2 = uneActualiteMilo({
        id: 'f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c9d',
        idStructureMilo: autreStructure,
        titre: 'Actualité Structure 2'
      })

      await actualiteMiloSqlRepository.save(actualite1)
      await actualiteMiloSqlRepository.save(actualite2)

      // When
      const actualites =
        await actualiteMiloSqlRepository.getByStructureMilo(idStructureMilo)

      // Then
      expect(actualites).to.have.lengthOf(1)
      expect(actualites[0].id).to.equal('f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c5d')
      expect(actualites[0].titre).to.equal('Actualité Structure 1')
    })

    it('retourne un tableau vide si aucune actualité pour la structure', async () => {
      // When
      const actualites =
        await actualiteMiloSqlRepository.getByStructureMilo(idStructureMilo)

      // Then
      expect(actualites).to.have.lengthOf(0)
    })

    it('mappe correctement les champs optionnels', async () => {
      // Given
      const actualite = uneActualiteMilo({
        idStructureMilo,
        titreLien: 'Titre du lien',
        lien: 'https://example.com',
        dateSuppression: DateTime.fromISO('2024-03-01T10:00:00.000Z')
      })

      await actualiteMiloSqlRepository.save(actualite)

      // When
      const actualites =
        await actualiteMiloSqlRepository.getByStructureMilo(idStructureMilo)

      // Then
      expect(actualites[0].titreLien).to.equal('Titre du lien')
      expect(actualites[0].lien).to.equal('https://example.com')
      expect(actualites[0].dateSuppression).to.exist()
      expect(actualites[0].dateSuppression).to.deep.equal(
        DateTime.fromISO('2024-03-01T10:00:00.000Z')
      )
    })

    it('retourne undefined pour les champs optionnels non définis', async () => {
      // Given
      const actualite = uneActualiteMilo({
        idStructureMilo,
        titreLien: undefined,
        lien: undefined,
        dateSuppression: undefined
      })

      await actualiteMiloSqlRepository.save(actualite)

      // When
      const actualites =
        await actualiteMiloSqlRepository.getByStructureMilo(idStructureMilo)

      // Then
      expect(actualites[0].titreLien).to.be.undefined()
      expect(actualites[0].lien).to.be.undefined()
      expect(actualites[0].dateSuppression).to.be.undefined()
    })

    it('retourne les dates en objets DateTime', async () => {
      // Given
      const dateCreation = DateTime.fromISO('2024-01-01T10:00:00.000Z')
      const dateModification = DateTime.fromISO('2024-02-01T10:00:00.000Z')
      const actualite = uneActualiteMilo({
        idStructureMilo,
        dateCreation,
        dateModification
      })

      await actualiteMiloSqlRepository.save(actualite)

      // When
      const actualites =
        await actualiteMiloSqlRepository.getByStructureMilo(idStructureMilo)

      // Then
      expect(actualites[0].dateCreation.toISO()).to.equal(dateCreation.toISO())
      expect(actualites[0].dateModification!.toISO()).to.equal(
        dateModification.toISO()
      )
    })
  })
})
