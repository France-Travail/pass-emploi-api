import { DateTime } from 'luxon'
import { GetActualitesMiloJeuneQueryHandler } from 'src/application/queries/milo/get-actualites-milo-jeune.query.handler.db'
import { JeuneAuthorizer } from 'src/application/authorizers/jeune-authorizer'
import { uneActualiteMilo } from '../../../fixtures/actualite-milo.fixture'
import { unUtilisateurJeune } from '../../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'
import { emptySuccess, success } from 'src/building-blocks/types/result'
import { JeuneSqlModel } from 'src/infrastructure/sequelize/models/jeune.sql-model'
import { StructureMiloSqlModel } from 'src/infrastructure/sequelize/models/structure-milo.sql-model'
import { ConseillerSqlModel } from 'src/infrastructure/sequelize/models/conseiller.sql-model'
import { getDatabase } from '../../../utils/database-for-testing'
import { Core } from 'src/domain/core'
import { ActualiteMiloSqlModel } from '../../../../src/infrastructure/sequelize/models/actualite-milo.sql-model'
import {
  unJeuneDto,
  unJeuneMiloDto
} from '../../../fixtures/sql-models/jeune.sql-model'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { ActualiteMiloSqlRepository } from '../../../../src/infrastructure/repositories/milo/actualite-milo-sql.repository.db'
import { JeuneMilo } from '../../../../src/domain/milo/jeune.milo'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { DateService } from '../../../../src/utils/date-service'
import { Profil } from '../../../../src/domain/profil'
import { uneDatetime } from '../../../fixtures/date.fixture'

describe('GetActualitesMiloJeuneQueryHandler', () => {
  let getActualitesMiloJeuneQueryHandler: GetActualitesMiloJeuneQueryHandler
  let actualiteMiloRepository: ActualiteMiloSqlRepository
  let jeuneMiloRepository: StubbedType<JeuneMilo.Repository>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let sandbox: sinon.SinonSandbox

  const idJeune = 'jeune-milo-1'
  const idStructureMilo = 'structure-milo-1'
  const idStructureMiloAutre = 'structure-milo-2'
  const utilisateur = unUtilisateurJeune({ id: idJeune })
  const maintenant = uneDatetime()

  beforeEach(async () => {
    await getDatabase().cleanPG()
    const dateService: StubbedClass<DateService> = stubClass(DateService)
    dateService.now.returns(maintenant)
    dateService.nowJs.returns(maintenant.toJSDate())
    sandbox = createSandbox()

    actualiteMiloRepository = new ActualiteMiloSqlRepository(dateService)
    sandbox = createSandbox()

    jeuneMiloRepository = stubInterface(sandbox)
    jeuneAuthorizer = stubClass(JeuneAuthorizer)

    getActualitesMiloJeuneQueryHandler = new GetActualitesMiloJeuneQueryHandler(
      actualiteMiloRepository,
      jeuneMiloRepository,
      jeuneAuthorizer
    )

    await ConseillerSqlModel.create(
      unConseillerDto({
        id: '1',
        structure: Core.Structure.MILO
      })
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
      const jeuneMiloDto = unJeuneMiloDto(
        unJeuneDto({
          id: idJeune,
          structure: Core.Structure.MILO
        }),
        idStructureMilo
      )

      await JeuneSqlModel.creer(jeuneMiloDto)

      jeuneMiloRepository.get
        .withArgs(jeuneMiloDto.id)
        .resolves(success(jeuneMiloDto))

      const actualite1 = uneActualiteMilo({
        id: 'f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c5d',
        titre: 'Actualité 1',
        contenu: 'Contenu 1',
        dateCreation: DateTime.fromISO('2024-01-03T10:00:00.000Z')
      })

      await ActualiteMiloSqlModel.upsert(actualite1)

      const actualite2 = uneActualiteMilo({
        id: 'f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c6f',
        titre: 'Actualité 2',
        contenu: 'Contenu 2',
        titreLien: 'Lien 2',
        lien: 'https://example.com/2',
        dateCreation: DateTime.fromISO('2024-01-01T10:00:00.000Z')
      })

      await ActualiteMiloSqlModel.upsert(actualite2)

      // When
      const result = await getActualitesMiloJeuneQueryHandler.handle({
        idJeune
      })

      // Then
      expect(result.actualites).to.have.lengthOf(2)

      expect(result.actualites[0].titre).to.equal('Actualité 2')
      expect(result.actualites[0].titreLien).to.equal('Lien 2')
      expect(result.actualites[0].lien).to.equal('https://example.com/2')

      expect(result.actualites[1].titre).to.equal('Actualité 1')
      expect(result.actualites[1].contenu).to.equal('Contenu 1')
      expect(result.actualites[1].prenomNomConseiller).to.exist()
      expect(result.actualites[1].dateCreation).to.be.a('string')
    })

    it("retourne un tableau vide si le jeune n'existe pas", async () => {
      //given
      const jeuneMiloDto = unJeuneMiloDto(
        unJeuneDto({
          id: 'jeune-inexistant',
          structure: Core.Structure.MILO
        }),
        idStructureMiloAutre
      )
      jeuneMiloRepository.get.withArgs(jeuneMiloDto.id).resolves(jeuneMiloDto)

      // When
      const result = await getActualitesMiloJeuneQueryHandler.handle({
        idJeune: 'jeune-inexistant'
      })

      // Then
      expect(result.actualites).to.have.lengthOf(0)
    })

    it("retourne un tableau vide si le jeune n'a pas de structure MILO", async () => {
      // Given
      const jeuneDto = unJeuneDto({
        id: idJeune,
        structure: Core.Structure.MILO
      })

      jeuneMiloRepository.get.withArgs(jeuneDto.id).resolves(success(jeuneDto))

      await JeuneSqlModel.creer(jeuneDto)

      // When
      const result = await getActualitesMiloJeuneQueryHandler.handle({
        idJeune
      })

      // Then
      expect(result.actualites).to.have.lengthOf(0)
    })

    it("retourne un tableau vide si la structure MILO du jeune n'a pas d'actualités", async () => {
      // Given
      const jeuneMiloDto = unJeuneMiloDto(
        unJeuneDto({
          id: idJeune,
          structure: Core.Structure.MILO
        }),
        idStructureMilo
      )

      jeuneMiloRepository.get
        .withArgs(jeuneMiloDto.id)
        .resolves(success(jeuneMiloDto))

      await JeuneSqlModel.creer(jeuneMiloDto)

      // Pas d'actualités créées = tableau vide attendu

      // When
      const result = await getActualitesMiloJeuneQueryHandler.handle({
        idJeune
      })

      // Then
      expect(result.actualites).to.have.lengthOf(0)
    })

    it('ne retourne pas le champ id dans les actualités', async () => {
      // Given
      const jeuneMiloDto = unJeuneMiloDto(
        unJeuneDto({
          id: idJeune,
          structure: Core.Structure.MILO
        }),
        idStructureMilo
      )

      jeuneMiloRepository.get
        .withArgs(jeuneMiloDto.id)
        .resolves(success(jeuneMiloDto))

      await JeuneSqlModel.creer(jeuneMiloDto)

      const actualite = uneActualiteMilo({
        idStructureMilo,
        titre: 'Test Actualité'
      })

      await ActualiteMiloSqlModel.upsert(actualite)

      // When
      const result = await getActualitesMiloJeuneQueryHandler.handle({
        idJeune
      })

      // Then
      expect(result.actualites).to.have.lengthOf(1)
      expect(result.actualites[0]).not.to.have.property('id')
      expect(result.actualites[0]).not.to.have.property('proprietaire')
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(getActualitesMiloJeuneQueryHandler.profilsAutorises).to.deep.equal(
        [
          Profil.Jeune.MILO,
          Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
          Profil.Jeune.FT_DEMANDEUR_EMPLOI,
          Profil.Jeune.CONSEIL_DEPT
        ]
      )
    })
  })
})
