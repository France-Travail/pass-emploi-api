import { URLSearchParams } from 'url'
import { expect } from 'chai'
import { failure, success } from '../../../../src/building-blocks/types/result'
import { ErreurHttp } from '../../../../src/building-blocks/types/domain-error'
import { ImmersionClient } from '../../../../src/infrastructure/clients/immersion-client'
import { StubbedClass, stubClass } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'
import { MetierRomeSqlModel } from '../../../../src/infrastructure/sequelize/models/metier-rome.sql-model'
import { unMetierRomeDto } from '../../../fixtures/sql-models/metier-rome.sql-model'
import { PartenaireImmersion } from '../../../../src/infrastructure/repositories/dto/immersion.dto'
import {
  OffreImmersionQueryModelV3,
  ResultatRechercheOffresImmersionQueryModelV3
} from '../../../../src/application/queries/query-models/offres-immersion.query-model'
import { FindAllOffresImmersionQueryGetterV3 } from '../../../../src/application/queries/query-getters/find-all-offres-immersionV3.query.getter.db'
import { Offre } from '../../../../src/domain/offre/offre'

const uneOffreDto = (
  siret: string,
  appellationCode: string
): PartenaireImmersion.DtoV3 => ({
  rome: 'D1102',
  romeLabel: 'romeLabel',
  naf: 'naf',
  nafLabel: 'nafLabel',
  siret,
  name: 'name',
  locationId: 'locationId',
  voluntaryToImmersion: true,
  position: { lat: 48.5, lon: 2.1 },
  address: {
    streetNumberAndAddress: 'street',
    postcode: '75001',
    city: 'city',
    departmentCode: '75'
  },
  appellations: [{ appellationCode, appellationLabel: 'label' }],
  remoteWorkMode: Offre.Immersion.ImmersionModeDistanciel.FULL_REMOTE,
  fitForDisabledWorkers:
    Offre.Immersion.ImmersionAccessibleTravailleurHandicape.YES_FT_CERTIFIED
})

const uneReponseAvecPagination = (
  offres: PartenaireImmersion.DtoV3[],
  totalPages = 1
): PartenaireImmersion.SearchResponseV3 => ({
  data: offres,
  pagination: {
    totalRecords: offres.length,
    currentPage: 1,
    totalPages,
    numberPerPage: 10
  }
})

const uneOffreQueryModel = (
  siret: string,
  appellationCode: string
): OffreImmersionQueryModelV3 => ({
  siret,
  metier: 'label',
  nomEtablissement: 'name',
  secteurActivite: 'nafLabel',
  ville: 'city',
  locationId: 'locationId',
  appellationCode,
  accessibleTravailleurHandicape:
    Offre.Immersion.ImmersionAccessibleTravailleurHandicape.YES_FT_CERTIFIED
})

const unResultat = (
  offres: OffreImmersionQueryModelV3[],
  nombrePages: number,
  nombreTotal: number
): ResultatRechercheOffresImmersionQueryModelV3 => ({
  offres,
  nombrePages,
  nombreTotal
})

const baseQuery = {
  rome: 'D1102',
  lat: 48.502103949334845,
  lon: 2.13082255225161,
  distance: 30,
  currentPage: 1,
  numberPerPage: 10
}

describe('FindAllOffresImmersionQueryGetter', () => {
  let databaseForTesting: DatabaseForTesting
  let immersionClient: StubbedClass<ImmersionClient>
  let findAllOffresImmersionQueryGetter: FindAllOffresImmersionQueryGetterV3

  before(() => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    immersionClient = stubClass(ImmersionClient)
    findAllOffresImmersionQueryGetter = new FindAllOffresImmersionQueryGetterV3(
      immersionClient,
      databaseForTesting.sequelize
    )
  })

  describe('handle', () => {
    describe('quand appellationCode est fourni directement', () => {
      it('fait 1 requête avec cet appellationCode et délègue la pagination à Immersion', async () => {
        // Given
        const query = {
          ...baseQuery,
          rome: undefined,
          appellationCode: '11573'
        }

        const params = new URLSearchParams()
        params.append('distanceKm', '30')
        params.append('longitude', baseQuery.lon.toString())
        params.append('latitude', baseQuery.lat.toString())
        params.append('appellationCodes[]', '11573')
        params.append('sortBy', 'date')
        params.append('sortOrder', 'desc')
        params.append('page', '1')
        params.append('perPage', '10')

        immersionClient.getOffresV3.resolves(
          success(
            uneReponseAvecPagination([uneOffreDto('siret-1', '11573')], 3)
          )
        )

        // When
        const result = await findAllOffresImmersionQueryGetter.handle(query)

        // Then
        expect(immersionClient.getOffresV3.callCount).to.equal(1)
        expect(immersionClient.getOffresV3.getCall(0).args).to.deep.equal([
          params
        ])
        expect(result).to.deep.equal(
          success(unResultat([uneOffreQueryModel('siret-1', '11573')], 3, 1))
        )
      })
    })

    describe('quand rome est fourni', () => {
      it('résout les appellationCodes depuis la DB et fait 1 requête avec tous', async () => {
        // Given
        await MetierRomeSqlModel.bulkCreate([
          unMetierRomeDto({ id: 1, code: 'D1102', appellationCode: '11573' }),
          unMetierRomeDto({ id: 2, code: 'D1102', appellationCode: '22456' })
        ])

        immersionClient.getOffresV3.resolves(
          success(
            uneReponseAvecPagination(
              [
                uneOffreDto('siret-1', 'appCode-1'),
                uneOffreDto('siret-2', 'appCode-2')
              ],
              1
            )
          )
        )

        // When
        const result = await findAllOffresImmersionQueryGetter.handle(baseQuery)

        // Then
        expect(immersionClient.getOffresV3.callCount).to.equal(1)
        expect(result).to.deep.equal(
          success(
            unResultat(
              [
                uneOffreQueryModel('siret-1', 'appCode-1'),
                uneOffreQueryModel('siret-2', 'appCode-2')
              ],
              1,
              2
            )
          )
        )
      })

      it('envoie bien tous les appellationCodes dans la requête, même plus de 20', async () => {
        // Given
        const metiers = Array.from({ length: 21 }, (_, i) =>
          unMetierRomeDto({
            id: i + 1,
            code: 'D1102',
            appellationCode: `code-${i}`
          })
        )
        await MetierRomeSqlModel.bulkCreate(metiers)

        immersionClient.getOffresV3.resolves(
          success(
            uneReponseAvecPagination([uneOffreDto('siret-1', 'code-0')], 1)
          )
        )

        // When
        await findAllOffresImmersionQueryGetter.handle(baseQuery)

        // Then
        expect(immersionClient.getOffresV3.callCount).to.equal(1)
        const appelParams: URLSearchParams =
          immersionClient.getOffresV3.getCall(0).args[0]
        expect(appelParams.getAll('appellationCodes[]')).to.have.length(21)
      })
    })

    describe("quand l'API renvoie une erreur", () => {
      it('renvoie une failure', async () => {
        // Given
        await MetierRomeSqlModel.bulkCreate([
          unMetierRomeDto({ id: 1, code: 'D1102', appellationCode: '11573' })
        ])

        immersionClient.getOffresV3.resolves(
          failure(new ErreurHttp("un message d'erreur", 404))
        )

        // When
        const result = await findAllOffresImmersionQueryGetter.handle(baseQuery)

        // Then
        expect(result).to.deep.equal(
          failure(new ErreurHttp("un message d'erreur", 404))
        )
      })

      it("renvoie une erreur quand l'appel rejette", async () => {
        // Given
        await MetierRomeSqlModel.bulkCreate([
          unMetierRomeDto({ id: 1, code: 'D1102', appellationCode: '11573' })
        ])

        const error = new Error('Erreur inconnue')
        immersionClient.getOffresV3.rejects(error)

        // When
        const call = findAllOffresImmersionQueryGetter.handle(baseQuery)

        // Then
        await expect(call).to.be.rejectedWith(error)
      })
    })
  })
})
