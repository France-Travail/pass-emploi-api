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
})
