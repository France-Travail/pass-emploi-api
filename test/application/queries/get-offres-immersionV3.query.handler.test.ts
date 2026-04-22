import { SinonSandbox } from 'sinon'
import { Evenement, EvenementService } from 'src/domain/evenement'
import { ResultatRechercheOffresImmersionQueryModelV3 } from '../../../src/application/queries/query-models/offres-immersion.query-model'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { success } from '../../../src/building-blocks/types/result'
import {
  GetOffresImmersionQueryHandlerV3,
  GetOffresImmersionQueryV3
} from '../../../src/application/queries/get-offres-immersionV3.query.handler'
import { FindAllOffresImmersionQueryGetterV3 } from '../../../src/application/queries/query-getters/find-all-offres-immersionV3.query.getter.db'

describe('GetOffresImmersionQueryHandler', () => {
  let findAllOffresImmersionQueryGetter: StubbedClass<FindAllOffresImmersionQueryGetterV3>
  let getOffresImmersionQueryHandler: GetOffresImmersionQueryHandlerV3
  let sandbox: SinonSandbox
  let evenementService: StubbedClass<EvenementService>

  before(() => {
    sandbox = createSandbox()
    findAllOffresImmersionQueryGetter = stubClass(
      FindAllOffresImmersionQueryGetterV3
    )
    evenementService = stubClass(EvenementService)

    getOffresImmersionQueryHandler = new GetOffresImmersionQueryHandlerV3(
      findAllOffresImmersionQueryGetter,
      evenementService
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    describe('quand la distance est précisée', () => {
      it('retourne des offres', async () => {
        // Given
        const query: GetOffresImmersionQueryV3 = {
          rome: 'D1102',
          lat: 48.502103949334845,
          lon: 2.13082255225161,
          distance: 15,
          currentPage: 1,
          numberPerPage: 10
        }
        const resultat: ResultatRechercheOffresImmersionQueryModelV3 = {
          offres: [
            {
              siret: '12345',
              metier: 'Boulanger',
              nomEtablissement: 'Boulangerie',
              secteurActivite: 'Restauration',
              ville: 'Paris',
              locationId: 'loc-1',
              appellationCode: 'D1102'
            }
          ],
          nombrePagesResultat: 1
        }
        findAllOffresImmersionQueryGetter.handle
          .withArgs(query)
          .resolves(success(resultat))

        // When
        const result = await getOffresImmersionQueryHandler.handle(query)

        // Then
        expect(result).to.deep.equal(success(resultat))
      })
    })

    describe('quand la distance est absente', () => {
      it('retourne des offres avec la distance par défaut', async () => {
        // Given
        const query: GetOffresImmersionQueryV3 = {
          rome: 'D1102',
          lat: 48.502103949334845,
          lon: 2.13082255225161,
          currentPage: 1,
          numberPerPage: 10
        }
        const resultat: ResultatRechercheOffresImmersionQueryModelV3 = {
          offres: [
            {
              siret: '12345',
              metier: 'Boulanger',
              nomEtablissement: 'Boulangerie',
              secteurActivite: 'Restauration',
              ville: 'Paris',
              locationId: 'loc-1',
              appellationCode: 'D1102'
            }
          ],
          nombrePagesResultat: 1
        }
        findAllOffresImmersionQueryGetter.handle
          .withArgs(query)
          .resolves(success(resultat))

        // When
        const result = await getOffresImmersionQueryHandler.handle(query)

        // Then
        expect(result).to.deep.equal(success(resultat))
      })
    })

    describe("quand l'appellationCode est fourni directement", () => {
      it('retourne des offres', async () => {
        // Given
        const query: GetOffresImmersionQueryV3 = {
          appellationCode: '11573',
          lat: 48.502103949334845,
          lon: 2.13082255225161,
          currentPage: 1,
          numberPerPage: 10
        }
        const resultat: ResultatRechercheOffresImmersionQueryModelV3 = {
          offres: [
            {
              siret: '12345',
              metier: 'Boulanger',
              nomEtablissement: 'Boulangerie',
              secteurActivite: 'Restauration',
              ville: 'Paris',
              locationId: 'loc-1',
              appellationCode: '11573'
            }
          ],
          nombrePagesResultat: 1
        }
        findAllOffresImmersionQueryGetter.handle
          .withArgs(query)
          .resolves(success(resultat))

        // When
        const result = await getOffresImmersionQueryHandler.handle(query)

        // Then
        expect(result).to.deep.equal(success(resultat))
      })
    })
  })

  describe('monitor', () => {
    it("crée un événement de recherche d'offre", async () => {
      // When
      await getOffresImmersionQueryHandler.monitor(unUtilisateurJeune())

      // Then
      expect(evenementService.creer).to.have.been.calledWith(
        Evenement.Code.OFFRE_IMMERSION_RECHERCHEE,
        unUtilisateurJeune()
      )
    })
  })
})
