import { AxiosResponse } from '@nestjs/terminus/dist/health-indicator/http/axios.interfaces'
import { expect } from 'chai'
import { failure, success } from '../../../src/building-blocks/types/result'
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { ImmersionClient } from '../../../src/infrastructure/clients/immersion-client'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune
} from '../../fixtures/authentification.fixture'
import { uneOffreImmersionDtov3 } from '../../fixtures/offre-immersion.dto.fixture'
import { StubbedClass, stubClass } from '../../utils'
import { ErreurHttp } from '../../../src/building-blocks/types/domain-error'
import { GetDetailOffreImmersionQueryHandlerV3 } from '../../../src/application/queries/get-detail-offre-immersionV3.query.handler'

describe('GetDetailOffreImmersionQueryHandler', () => {
  let getDetailOffreImmersionQueryHandler: GetDetailOffreImmersionQueryHandlerV3
  let immersionClient: StubbedClass<ImmersionClient>
  let evenementService: StubbedClass<EvenementService>

  beforeEach(() => {
    immersionClient = stubClass(ImmersionClient)
    evenementService = stubClass(EvenementService)
    getDetailOffreImmersionQueryHandler =
      new GetDetailOffreImmersionQueryHandlerV3(
        immersionClient,
        evenementService
      )
  })

  describe('handle', () => {
    describe('quand la requête est correcte', () => {
      it("renvoie le détail d'une offre", async () => {
        // Given
        const response: AxiosResponse = {
          config: undefined,
          headers: undefined,
          request: undefined,
          status: 200,
          statusText: '',
          data: uneOffreImmersionDtov3()
        }

        immersionClient.getDetailOffreV3.resolves(success(response.data))

        // When
        const detailOffre = await getDetailOffreImmersionQueryHandler.handle({
          siret: '123456',
          appellationCode: 'D1102',
          locationId: 'locationId'
        })

        // Then
        expect(detailOffre).to.deep.equal(
          success({
            metier: 'Boulanger-Traiteur',
            nomEtablissement: 'name',
            secteurActivite: 'naf',
            ville: 'city',
            adresse: 'street post code city',
            siret: '123456',
            appellationCode: 'D1102',
            contact: 'PRESENTIEL',
            informationsComplementaires: 'informations complémentaires',
            siteWeb: 'https://exemple.fr',
            modeDistanciel: 'ON_SITE',
            accessibleTravailleurHandicape: 'yes-declared-only',
            locationId: 'locationId'
          })
        )
      })
    })
    describe('quand la requête est mauvaise', () => {
      it('return la failure', async () => {
        immersionClient.getDetailOffreV3.resolves(
          failure(new ErreurHttp("un message d'erreur", 400))
        )

        // When
        const offres = await getDetailOffreImmersionQueryHandler.handle({
          siret: 'siret',
          appellationCode: 'code',
          locationId: ''
        })

        // Then
        expect(offres).to.deep.equal(
          failure(new ErreurHttp("un message d'erreur", 400))
        )
      })
      it('renvoie une erreur quand une erreur inconnue survient', async () => {
        const error = new Error('Erreur inconnue')
        immersionClient.getDetailOffreV3.rejects(error)

        // When
        const offres = getDetailOffreImmersionQueryHandler.handle({
          siret: 'siret',
          appellationCode: 'code',
          locationId: ''
        })

        // Then
        await expect(offres).to.be.rejectedWith(error)
      })
    })
  })

  describe('monitor', () => {
    it("enregistre l'évènement pour un conseiller", async () => {
      // Given
      const utilisateur = unUtilisateurConseiller()
      // When
      await getDetailOffreImmersionQueryHandler.monitor(utilisateur)
      // Then
      expect(evenementService.creer).to.have.been.calledWithExactly(
        Evenement.Code.OFFRE_IMMERSION_AFFICHEE,
        utilisateur
      )
    })
    it("n'enregistre pas l'évènement pour un jeune", async () => {
      // Given
      const utilisateur = unUtilisateurJeune()
      // When
      await getDetailOffreImmersionQueryHandler.monitor(utilisateur)
      // Then
      expect(evenementService.creer).to.not.have.been.called()
    })
  })
})
