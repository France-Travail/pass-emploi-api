import { DateTime } from 'luxon'
import { GetActualitesMiloConseillerQueryHandler } from 'src/application/queries/milo/get-actualites-milo-conseiller.query.handler.db'
import { ConseillerAuthorizer } from 'src/application/authorizers/conseiller-authorizer'
import { uneActualiteMilo } from '../../../fixtures/actualite-milo.fixture'
import { unUtilisateurConseiller } from '../../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'
import { emptySuccess } from 'src/building-blocks/types/result'
import { Core } from 'src/domain/core'
import { ActualiteMiloSqlRepository } from '../../../../src/infrastructure/repositories/milo/actualite-milo-sql.repository.db'
import { ConseillerMiloSqlRepository } from '../../../../src/infrastructure/repositories/milo/conseiller.milo.repository.db'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import {
  unConseillerDto,
  unConseillerMiloDto
} from '../../../fixtures/sql-models/conseiller.sql-model'
import { ActualiteMiloSqlModel } from '../../../../src/infrastructure/sequelize/models/actualite-milo.sql-model'
import { getDatabase } from '../../../utils/database-for-testing'
import { StructureMiloSqlModel } from '../../../../src/infrastructure/sequelize/models/structure-milo.sql-model'
import { Evenement, EvenementService } from '../../../../src/domain/evenement'
import { createSandbox } from 'sinon'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateService } from '../../../../src/utils/date-service'
import { Recherche } from '../../../../src/domain/offre/recherche/recherche'
import Suggestion = Recherche.Suggestion
import { uneDatetime } from '../../../fixtures/date.fixture'

describe('GetActualitesMiloConseillerQueryHandler', () => {
  let getActualitesMiloConseillerQueryHandler: GetActualitesMiloConseillerQueryHandler
  let actualiteMiloRepository: ActualiteMiloSqlRepository
  let conseillerMiloRepository: ConseillerMiloSqlRepository
  let evenementService: EvenementService
  let evenementRepository: StubbedType<Evenement.Repository>
  let suggestionRepository: StubbedType<Suggestion.Repository>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>

  const idConseiller = 'conseiller-1'
  const structureMilo = {
    id: 'id-structure-milo',
    nomOfficiel: 'Structure Milo',
    timezone: 'America/Cayenne'
  }
  const utilisateur = unUtilisateurConseiller({
    id: idConseiller,
    structure: Core.Structure.MILO
  })
  const maintenant = uneDatetime()

  beforeEach(async () => {
    await getDatabase().cleanPG()

    const dateService: StubbedClass<DateService> = stubClass(DateService)
    dateService.now.returns(maintenant)
    const sandbox = createSandbox()
    evenementRepository = stubInterface(sandbox)
    suggestionRepository = stubInterface(sandbox)
    evenementService = new EvenementService(
      evenementRepository,
      dateService,
      suggestionRepository
    )
    actualiteMiloRepository = new ActualiteMiloSqlRepository(dateService)
    conseillerMiloRepository = new ConseillerMiloSqlRepository()
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)

    getActualitesMiloConseillerQueryHandler =
      new GetActualitesMiloConseillerQueryHandler(
        actualiteMiloRepository,
        conseillerMiloRepository,
        evenementService,
        conseillerAuthorizer
      )
  })

  describe('authorize', () => {
    it('autorise le conseiller MILO', async () => {
      // Given
      conseillerAuthorizer.autoriserLeConseiller.resolves(emptySuccess())

      // When
      const result = await getActualitesMiloConseillerQueryHandler.authorize(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        conseillerAuthorizer.autoriserLeConseiller
      ).to.have.been.calledOnceWithExactly(idConseiller, utilisateur, true)
    })
  })

  describe('handle', () => {
    it('retourne les actualités de la structure avec le flag proprietaire', async () => {
      // Given
      const conseillerMiloDto = unConseillerMiloDto(
        unConseillerDto({
          id: idConseiller,
          structure: Core.Structure.MILO
        }),
        structureMilo.id
      )
      await StructureMiloSqlModel.create(structureMilo)
      await ConseillerSqlModel.create(conseillerMiloDto)

      const actualite1 = uneActualiteMilo({
        id: 'f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c5d',
        idConseiller: idConseiller,
        idStructureMilo: structureMilo.id,
        titre: 'Actualité du conseiller',
        contenu: 'Contenu 1',
        dateCreation: DateTime.fromISO('2024-01-01T10:00:00.000Z')
      })

      await ActualiteMiloSqlModel.upsert(actualite1)

      const actualite2 = uneActualiteMilo({
        id: 'f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c4d',
        idConseiller: 'autre-conseiller',
        idStructureMilo: structureMilo.id,
        titre: "Actualité d'un autre",
        contenu: 'Contenu 2',
        titreLien: 'En savoir plus',
        lien: 'https://example.com',
        dateCreation: DateTime.fromISO('2024-01-02T10:00:00.000Z')
      })

      await ActualiteMiloSqlModel.upsert(actualite2)

      // When
      const result = await getActualitesMiloConseillerQueryHandler.handle(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result.actualites).to.have.lengthOf(2)

      // Actualité du conseiller
      expect(result.actualites[0].id).to.equal(
        'f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c5d'
      )
      expect(result.actualites[0].titre).to.equal('Actualité du conseiller')
      expect(result.actualites[0].contenu).to.equal('Contenu 1')
      expect(result.actualites[0].prenomNomConseiller).to.exist()
      expect(result.actualites[0].dateCreation).to.be.a('string')
      expect(result.actualites[0].proprietaire).to.be.true()

      // Actualité d'un autre conseiller
      expect(result.actualites[1].id).to.equal(
        'f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c4d'
      )
      expect(result.actualites[1].titre).to.equal("Actualité d'un autre")
      expect(result.actualites[1].titreLien).to.equal('En savoir plus')
      expect(result.actualites[1].lien).to.equal('https://example.com')
      expect(result.actualites[1].proprietaire).to.be.false()
    })

    it("retourne un tableau vide si le conseiller n'existe pas", async () => {
      // Given

      // When
      const result = await getActualitesMiloConseillerQueryHandler.handle(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result.actualites).to.have.lengthOf(0)
    })

    it("retourne un tableau vide si la structure n'a pas d'actualités", async () => {
      // Given
      const conseillerMiloDto = unConseillerMiloDto(
        unConseillerDto({
          id: idConseiller,
          structure: Core.Structure.MILO
        }),
        structureMilo.id
      )
      await StructureMiloSqlModel.create(structureMilo)
      await ConseillerSqlModel.create(conseillerMiloDto)

      // When
      const result = await getActualitesMiloConseillerQueryHandler.handle(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result.actualites).to.have.lengthOf(0)
    })

    it('gère les champs optionnels undefined', async () => {
      // Given
      const conseillerMiloDto = unConseillerMiloDto(
        unConseillerDto({
          id: idConseiller,
          structure: Core.Structure.MILO
        }),
        structureMilo.id
      )
      await StructureMiloSqlModel.create(structureMilo)
      await ConseillerSqlModel.create(conseillerMiloDto)

      const actualite = uneActualiteMilo({
        idConseiller: idConseiller,
        idStructureMilo: structureMilo.id,
        titreLien: undefined,
        lien: undefined,
        dateSuppression: undefined
      })

      await ActualiteMiloSqlModel.upsert(actualite)

      // When
      const result = await getActualitesMiloConseillerQueryHandler.handle(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result.actualites[0].titreLien).to.be.undefined()
      expect(result.actualites[0].lien).to.be.undefined()
      expect(result.actualites[0].dateSuppression).to.be.undefined()
    })
  })
})
