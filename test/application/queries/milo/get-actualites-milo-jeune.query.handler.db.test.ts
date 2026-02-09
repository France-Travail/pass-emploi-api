import { DateTime } from 'luxon'
import { GetActualitesMiloJeuneQueryHandler } from 'src/application/queries/milo/get-actualites-milo-jeune.query.handler.db'
import { JeuneAuthorizer } from 'src/application/authorizers/jeune-authorizer'
import { ActualiteMilo } from 'src/domain/milo/actualite.milo'
import { uneActualiteMilo } from '../../../fixtures/actualite-milo.fixture'
import { unUtilisateurJeune } from '../../../fixtures/authentification.fixture'
import { unJeune } from '../../../fixtures/jeune.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'
import { emptySuccess } from 'src/building-blocks/types/result'
import { JeuneSqlModel } from 'src/infrastructure/sequelize/models/jeune.sql-model'
import { StructureMiloSqlModel } from 'src/infrastructure/sequelize/models/structure-milo.sql-model'
import { getDatabase } from '../../../utils/database-for-testing'
import { Core } from 'src/domain/core'

describe('GetActualitesMiloJeuneQueryHandler', () => {
  let getActualitesMiloJeuneQueryHandler: GetActualitesMiloJeuneQueryHandler
  let actualiteMiloRepository: StubbedClass<ActualiteMilo.Repository>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>

  const idJeune = 'jeune-1'
  const idStructureMilo = 'structure-milo-1'
  const utilisateur = unUtilisateurJeune({ id: idJeune })

  beforeEach(async () => {
    await getDatabase().cleanPG()

    actualiteMiloRepository = stubClass(ActualiteMilo.Repository)
    jeuneAuthorizer = stubClass(JeuneAuthorizer)

    getActualitesMiloJeuneQueryHandler = new GetActualitesMiloJeuneQueryHandler(
      actualiteMiloRepository,
      jeuneAuthorizer
    )

    // Créer la structure MILO
    await StructureMiloSqlModel.create({
      id: idStructureMilo,
      nomOfficiel: 'Structure Test',
      timezone: 'Europe/Paris'
    })
  })

  describe('authorize', () => {
    it('autorise le jeune', async () => {
      // Given
      jeuneAuthorizer.autoriserLeJeune.resolves(emptySuccess())

      // When
      const result = await getActualitesMiloJeuneQueryHandler.authorize(
        { idJeune },
        utilisateur
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        jeuneAuthorizer.autoriserLeJeune
      ).to.have.been.calledOnceWithExactly(idJeune, utilisateur)
    })
  })

  describe('handle', () => {
    it('retourne les actualités de la structure du jeune triées par date croissante', async () => {
      // Given
      await JeuneSqlModel.creer(
        unJeune({
          id: idJeune,
          structure: Core.Structure.MILO,
          idStructureMilo
        })
      )

      const actualite1 = uneActualiteMilo({
        id: 'actualite-1',
        titre: 'Actualité 1',
        contenu: 'Contenu 1',
        dateCreation: DateTime.fromISO('2024-01-03T10:00:00.000Z')
      })
      const actualite2 = uneActualiteMilo({
        id: 'actualite-2',
        titre: 'Actualité 2',
        contenu: 'Contenu 2',
        titreLien: 'Lien 2',
        lien: 'https://example.com/2',
        dateCreation: DateTime.fromISO('2024-01-01T10:00:00.000Z')
      })
      const actualite3 = uneActualiteMilo({
        id: 'actualite-3',
        titre: 'Actualité 3',
        contenu: 'Contenu 3',
        dateSuppression: DateTime.fromISO('2024-03-01T10:00:00.000Z'),
        dateCreation: DateTime.fromISO('2024-01-02T10:00:00.000Z')
      })

      actualiteMiloRepository.getByStructureMilo
        .withArgs(idStructureMilo)
        .resolves([actualite1, actualite2, actualite3])

      // When
      const result = await getActualitesMiloJeuneQueryHandler.handle({
        idJeune
      })

      // Then
      expect(result.actualites).to.have.lengthOf(3)

      expect(result.actualites[0].titre).to.equal('Actualité 1')
      expect(result.actualites[0].contenu).to.equal('Contenu 1')
      expect(result.actualites[0].nomPrenomConseiller).to.exist()
      expect(result.actualites[0].dateCreation).to.be.a('string')
      expect(result.actualites[0].titreLien).to.be.undefined()
      expect(result.actualites[0].lien).to.be.undefined()
      expect(result.actualites[0].dateSuppression).to.be.undefined()

      expect(result.actualites[1].titre).to.equal('Actualité 2')
      expect(result.actualites[1].titreLien).to.equal('Lien 2')
      expect(result.actualites[1].lien).to.equal('https://example.com/2')

      expect(result.actualites[2].titre).to.equal('Actualité 3')
      expect(result.actualites[2].dateSuppression).to.be.a('string')
    })

    it("retourne un tableau vide si le jeune n'existe pas", async () => {
      // When
      const result = await getActualitesMiloJeuneQueryHandler.handle({
        idJeune: 'jeune-inexistant'
      })

      // Then
      expect(result.actualites).to.have.lengthOf(0)
      expect(
        actualiteMiloRepository.getByStructureMilo
      ).not.to.have.been.called()
    })

    it("retourne un tableau vide si le jeune n'a pas de structure MILO", async () => {
      // Given
      await JeuneSqlModel.creer(
        unJeune({
          id: idJeune,
          structure: Core.Structure.POLE_EMPLOI
        })
      )

      // When
      const result = await getActualitesMiloJeuneQueryHandler.handle({
        idJeune
      })

      // Then
      expect(result.actualites).to.have.lengthOf(0)
      expect(
        actualiteMiloRepository.getByStructureMilo
      ).not.to.have.been.called()
    })

    it("retourne un tableau vide si la structure MILO du jeune n'a pas d'actualités", async () => {
      // Given
      await JeuneSqlModel.creer(
        unJeune({
          id: idJeune,
          structure: Core.Structure.MILO,
          idStructureMilo
        })
      )

      actualiteMiloRepository.getByStructureMilo
        .withArgs(idStructureMilo)
        .resolves([])

      // When
      const result = await getActualitesMiloJeuneQueryHandler.handle({
        idJeune
      })

      // Then
      expect(result.actualites).to.have.lengthOf(0)
    })

    it('ne retourne pas le champ id dans les actualités', async () => {
      // Given
      await JeuneSqlModel.creer(
        unJeune({
          id: idJeune,
          structure: Core.Structure.MILO,
          idStructureMilo
        })
      )

      const actualite = uneActualiteMilo({
        id: 'actualite-1',
        titre: 'Actualité'
      })

      actualiteMiloRepository.getByStructureMilo
        .withArgs(idStructureMilo)
        .resolves([actualite])

      // When
      const result = await getActualitesMiloJeuneQueryHandler.handle({
        idJeune
      })

      // Then
      expect(result.actualites[0]).not.to.have.property('id')
      expect(result.actualites[0]).not.to.have.property('proprietaire')
    })
  })
})
