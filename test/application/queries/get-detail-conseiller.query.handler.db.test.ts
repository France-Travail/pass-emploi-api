import { SinonSandbox } from 'sinon'
import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import {
  GetDetailConseillerQuery,
  GetDetailConseillerQueryHandler
} from '../../../src/application/queries/get-detail-conseiller.query.handler.db'
import { Conseiller } from '../../../src/domain/milo/conseiller'
import { Core } from '../../../src/domain/core'
import { AgenceSqlModel } from '../../../src/infrastructure/sequelize/models/agence.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { detailConseillerQueryModel } from '../../fixtures/query-models/conseiller.query-model.fixtures'
import { uneAgenceDto } from '../../fixtures/sql-models/agence.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'
import { failure, success } from '../../../src/building-blocks/types/result'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import { uneStructureMiloDto } from '../../fixtures/sql-models/structureMilo.sql-model'
import { StructureMiloSqlModel } from '../../../src/infrastructure/sequelize/models/structure-milo.sql-model'
import { testConfig } from '../../utils/module-for-testing'
import { FeatureFlip } from '../../../src/domain/feature-flip'
import { DateTime } from 'luxon'

const token = 'un-token'

describe('GetDetailConseillerQueryHandler', () => {
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let conseillerMiloService: StubbedClass<Conseiller.Milo.Service>
  let getDetailConseillerQueryHandler: GetDetailConseillerQueryHandler
  let featureFlipService: StubbedClass<FeatureFlip.Service>
  let sandbox: SinonSandbox

  before(() => {
    sandbox = createSandbox()
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    conseillerMiloService = stubClass(Conseiller.Milo.Service)
    featureFlipService = stubClass(FeatureFlip.Service)

    getDetailConseillerQueryHandler = new GetDetailConseillerQueryHandler(
      conseillerAuthorizer,
      conseillerMiloService,
      featureFlipService,
      testConfig()
    )
  })

  beforeEach(async () => {
    await getDatabase().cleanPG()
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    describe('Conseiller non Milo', () => {
      const structure = Core.Structure.POLE_EMPLOI

      it("retourne le conseiller quand il existe avec l'agence + dateDeMigration", async () => {
        // Given
        const idConseiller = '1'
        const agenceSql = uneAgenceDto()
        await AgenceSqlModel.create(agenceSql)
        await ConseillerSqlModel.creer(
          unConseillerDto({
            id: idConseiller,
            prenom: 'toto',
            nom: 'tata',
            idAgence: agenceSql.id
          })
        )

        featureFlipService.recupererDateDeMigrationConseiller
          .withArgs(idConseiller)
          .resolves(DateTime.fromISO('2024-09-01T00:00:00.000+02:00'))

        // When
        const actual = await getDetailConseillerQueryHandler.handle({
          idConseiller,
          structure,
          accessToken: token
        })

        // Then
        expect(actual).to.deep.equal(
          success(
            detailConseillerQueryModel({
              id: idConseiller,
              firstName: 'toto',
              lastName: 'tata',
              email: 'nils.tavernier@passemploi.com',
              agence: { id: agenceSql.id, nom: agenceSql.nomAgence },
              notificationsSonores: false,
              dateSignatureCGU: undefined,
              dateVisionnageActus: undefined,
              dateDeMigration: '2024-09-01T00:00:00.000+02:00'
            })
          )
        )
        expect(
          conseillerMiloService.recupererEtMettreAJourStructure
        ).not.to.have.been.called()
      })

      it('retourne un conseiller avec des jeunes à récupérer', async () => {
        const idConseiller = '1'
        await ConseillerSqlModel.creer(
          unConseillerDto({ id: idConseiller, prenom: 'toto', nom: 'tata' })
        )
        await JeuneSqlModel.creer(
          unJeuneDto({ idConseillerInitial: idConseiller })
        )
        featureFlipService.recupererDateDeMigrationConseiller
          .withArgs(idConseiller)
          .resolves(undefined)

        const actual = await getDetailConseillerQueryHandler.handle({
          idConseiller,
          structure,
          accessToken: token
        })

        expect(actual).to.deep.equal(
          success(
            detailConseillerQueryModel({
              id: idConseiller,
              firstName: 'toto',
              lastName: 'tata',
              email: 'nils.tavernier@passemploi.com',
              agence: undefined,
              notificationsSonores: false,
              aDesBeneficiairesARecuperer: true,
              dateSignatureCGU: undefined,
              dateVisionnageActus: undefined
            })
          )
        )
      })

      it("retourne une failure quand le conseiller n'existe pas", async () => {
        const actual = await getDetailConseillerQueryHandler.handle({
          idConseiller: 'id-inexistant',
          structure,
          accessToken: token
        })

        expect(actual).to.deep.equal(
          failure(new NonTrouveError('Conseiller', 'id-inexistant'))
        )
      })
    })
    describe('Conseiller Milo', () => {
      const structure = Core.Structure.MILO

      it('retourne le conseiller quand il existe avec la structure', async () => {
        // Given
        const idConseiller = '1'
        const structureMiloSql = uneStructureMiloDto()
        await StructureMiloSqlModel.create(structureMiloSql)
        await ConseillerSqlModel.creer(
          unConseillerDto({
            id: idConseiller,
            prenom: 'toto',
            nom: 'tata',
            idStructureMilo: structureMiloSql.id
          })
        )
        conseillerMiloService.recupererEtMettreAJourStructure.resolves()
        featureFlipService.recupererDateDeMigrationConseiller
          .withArgs(idConseiller)
          .resolves(undefined)

        // When
        const actual = await getDetailConseillerQueryHandler.handle({
          idConseiller,
          structure,
          accessToken: token
        })

        // Then
        expect(actual).to.deep.equal(
          success(
            detailConseillerQueryModel({
              id: idConseiller,
              firstName: 'toto',
              lastName: 'tata',
              email: 'nils.tavernier@passemploi.com',
              structureMilo: {
                id: structureMiloSql.id,
                nom: structureMiloSql.nomOfficiel
              },
              dateSignatureCGU: undefined,
              notificationsSonores: false,
              agence: undefined,
              dateVisionnageActus: undefined
            })
          )
        )
        expect(
          conseillerMiloService.recupererEtMettreAJourStructure
        ).to.have.been.calledOnceWithExactly(idConseiller, token)
      })
    })
  })

  describe('authorize', () => {
    it('valide le conseiller', async () => {
      // Given
      const utilisateur = unUtilisateurConseiller()

      const query: GetDetailConseillerQuery = {
        idConseiller: utilisateur.id,
        structure: Core.Structure.MILO,
        accessToken: token
      }

      // When
      await getDetailConseillerQueryHandler.authorize(query, utilisateur)

      // Then
      expect(
        conseillerAuthorizer.autoriserLeConseiller
      ).to.have.been.calledWithExactly(utilisateur.id, utilisateur)
    })
  })
})
