import { HttpStatus, INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import {
  NotifierNouvellesImmersionsCommand,
  NotifierNouvellesImmersionsCommandHandler
} from '../../../src/application/commands/notifier-nouvelles-immersions.command.handler'
import {
  DetailOffreImmersionQueryModelV3,
  ResultatRechercheOffresImmersionQueryModelV3
} from '../../../src/application/queries/query-models/offres-immersion.query-model'
import { ErreurHttp } from '../../../src/building-blocks/types/domain-error'

import {
  emptySuccess,
  failure,
  success
} from '../../../src/building-blocks/types/result'
import { unHeaderAuthorization } from '../../fixtures/authentification.fixture'
import { StubbedClass, expect } from '../../utils'
import { ensureUserAuthenticationFailsIfInvalid } from '../../utils/ensure-user-authentication-fails-if-invalid'
import { getApplicationWithStubbedDependencies } from '../../utils/module-for-testing'
import { GetOffresImmersionQueryHandlerV3 } from '../../../src/application/queries/get-offres-immersionV3.query.handler'
import {
  GetDetailOffreImmersionQueryHandlerV3,
  GetDetailOffreImmersionQueryV3
} from '../../../src/application/queries/get-detail-offre-immersionV3.query.handler'
import { EnvoyerFormulaireContactImmersionCommandHandlerV3 } from '../../../src/application/commands/envoyer-formulaire-contact-immersionV3.command.handler.db'
import { Offre } from '../../../src/domain/offre/offre'
import MethodeDeContact = Offre.Immersion.MethodeDeContact

describe('OffresImmersionController', () => {
  let getOffresImmersionQueryHandler: StubbedClass<GetOffresImmersionQueryHandlerV3>
  let getDetailOffreImmersionQueryHandler: StubbedClass<GetDetailOffreImmersionQueryHandlerV3>
  let notifierNouvellesImmersionsCommandHandler: StubbedClass<NotifierNouvellesImmersionsCommandHandler>
  let envoyerFormulaireContactImmersionCommandHandler: StubbedClass<EnvoyerFormulaireContactImmersionCommandHandlerV3>
  let app: INestApplication

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    getOffresImmersionQueryHandler = app.get(GetOffresImmersionQueryHandlerV3)
    getDetailOffreImmersionQueryHandler = app.get(
      GetDetailOffreImmersionQueryHandlerV3
    )
    notifierNouvellesImmersionsCommandHandler = app.get(
      NotifierNouvellesImmersionsCommandHandler
    )
    envoyerFormulaireContactImmersionCommandHandler = app.get(
      EnvoyerFormulaireContactImmersionCommandHandlerV3
    )
  })

  describe('GET /offres-immersion/v3', () => {
    describe('quand tout va bien', () => {
      it("fait appel à l'API Immersion avec les bons paramètres", async () => {
        // Given
        const getOffresImmersionQuery = {
          rome: 'D1102',
          lat: 48.502103949334845,
          lon: 2.13082255225161,
          page: 1,
          limit: 10
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
          nombrePages: 3,
          nombreTotal: 30
        }

        getOffresImmersionQueryHandler.execute.resolves(success(resultat))

        // When
        const result = await request(app.getHttpServer())
          .get('/offres-immersion/v3')
          .set('authorization', unHeaderAuthorization())
          .query(getOffresImmersionQuery)
          // Then
          .expect(HttpStatus.OK)

        expect(result.body).to.deep.equal(resultat)
      })
    })
    describe('quand la requête est mauvaise', () => {
      it("renvoie un message d'erreur", async () => {
        // Given
        const getOffresImmersionQuery = {
          rome: 'D1102',
          lat: 48.502103949334845,
          lon: 2.13082255225161,
          page: 1,
          limit: 10
        }

        getOffresImmersionQueryHandler.execute.resolves(
          failure(new ErreurHttp('Les champs sont pas bons', 400))
        )

        // When
        await request(app.getHttpServer())
          .get('/offres-immersion/v3')
          .set('authorization', unHeaderAuthorization())
          .query(getOffresImmersionQuery)
          // Then
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
    ensureUserAuthenticationFailsIfInvalid('get', '/offres-immersion/v3')
  })
  describe('GET /offres-immersion/v3/:siret/:appellationCode/:locationId', () => {
    const query: GetDetailOffreImmersionQueryV3 = {
      siret: 'un-siret',
      appellationCode: 'un-appellation-code',
      locationId: 'un-location-id'
    }
    const path = `/offres-immersion/v3/${query.siret}/${query.appellationCode}/${query.locationId}`

    describe('quand tout va bien', () => {
      it('renvoie la bonne offre recherchée', async () => {
        // Given
        const detailOffreImmersionQueryModel: DetailOffreImmersionQueryModelV3 =
          {
            adresse: 'addresse',
            siret: 'siret',
            metier: 'rome',
            nomEtablissement: 'name',
            secteurActivite: 'naf',
            ville: 'Paris',
            locationId: 'un-location-id',
            appellationCode: 'code',
            contact: MethodeDeContact.EMAIL,
            modeDistanciel: Offre.Immersion.ImmersionModeDistanciel.FULL_REMOTE
          }
        getDetailOffreImmersionQueryHandler.execute
          .withArgs(query)
          .resolves(success(detailOffreImmersionQueryModel))

        // When
        const result = await request(app.getHttpServer())
          .get(path)
          .set('authorization', unHeaderAuthorization())
          // Then
          .expect(HttpStatus.OK)

        expect(result.body).to.deep.equal(detailOffreImmersionQueryModel)
      })
    })
    describe('quand la requête est mauvaise', () => {
      it('renvoit une erreur de type BAD_REQUEST', async () => {
        // Given
        getDetailOffreImmersionQueryHandler.execute
          .withArgs(query)
          .resolves(failure(new ErreurHttp("un message d'erreur", 400)))

        // When
        await request(app.getHttpServer())
          .get(path)
          .set('authorization', unHeaderAuthorization())
          // Then
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
    describe("quand l'offre est introuvable", () => {
      it('renvoit une erreur de type NOT_FOUND', async () => {
        // Given
        getDetailOffreImmersionQueryHandler.execute
          .withArgs(query)
          .resolves(failure(new ErreurHttp("un message d'erreur", 404)))

        // When
        await request(app.getHttpServer())
          .get(path)
          .set('authorization', unHeaderAuthorization())
          // Then
          .expect(HttpStatus.NOT_FOUND)
      })
    })
    ensureUserAuthenticationFailsIfInvalid(
      'get',
      '/offres-immersion/v3/siret/code/location'
    )
  })
  describe('POST /offres-immersion', () => {
    // Given
    const uneNouvelleImmersion: NotifierNouvellesImmersionsCommand = {
      immersions: [
        {
          rome: 'unRome',
          location: {
            lon: 1.2,
            lat: 3.4
          },
          siret: '22334343'
        }
      ]
    }
    describe('quand le payload est bon', () => {
      it('appelle la commande et répond 202', async () => {
        // When
        await request(app.getHttpServer())
          .post('/offres-immersion')
          .send(uneNouvelleImmersion)
          .set({ 'X-API-KEY': 'api-key-immersion' })
          // Then
          .expect(HttpStatus.ACCEPTED)

        expect(
          notifierNouvellesImmersionsCommandHandler.execute
        ).to.have.been.calledWithExactly(uneNouvelleImmersion)
      })
    })
    describe('quand le payload est pas bon', () => {
      it('répond 400', async () => {
        // When
        await request(app.getHttpServer())
          .post('/offres-immersion')
          .send({ immersions: [{ plop: 'john' }] })
          .set({ 'X-API-KEY': 'api-key-immersion' })
          // Then
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
    describe("quand l'api key est pas bonne", () => {
      it('répond 401', async () => {
        // When
        await request(app.getHttpServer())
          .post('/offres-immersion')
          .send(uneNouvelleImmersion)
          .set({ 'X-API-KEY': 'ceci-est-une-mauvaise-api-key' })
          // Then
          .expect(HttpStatus.UNAUTHORIZED)
      })
    })
  })

  describe('POST /jeunes/:idJeune/offres-immersion/v3/contact', () => {
    it('renvoie un code de succes quand la commande est en succes', async () => {
      // Given
      const payload = {
        idJeune: '1',
        appellationCode: '11573',
        siret: '10226726508419',
        locationId: 'un-location-id',
        prenom: 'prenom',
        nom: 'nom',
        numeroTelephone: '0606060606',
        email: 'test@test.com',
        contactMode: 'EMAIL',
        datePreferences: 'lundi matin'
      }

      envoyerFormulaireContactImmersionCommandHandler.execute
        .withArgs(payload)
        .resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .post('/jeunes/1/offres-immersion/v3/contact')
        .set('authorization', unHeaderAuthorization())
        .send(payload)
        .expect(HttpStatus.CREATED)
    })
    it('accepte et transmet experienceAdditionalInformation et resumeLink', async () => {
      // Given
      const payload = {
        appellationCode: '11573',
        labelRome: 'Boulangerie - viennoiserie',
        siret: '10226726508419',
        locationId: 'un-location-id',
        prenom: 'prenom',
        nom: 'nom',
        email: 'test@test.com',
        contactMode: 'EMAIL',
        datePreferences: 'lundi matin',
        experienceAdditionalInformation: "J'ai déjà travaillé dans ce secteur",
        resumeLink: 'https://mon-cv.fr/cv.pdf',
        numeroTelephone: '0606060606'
      }

      envoyerFormulaireContactImmersionCommandHandler.execute.resolves(
        emptySuccess()
      )

      // When - Then
      await request(app.getHttpServer())
        .post('/jeunes/1/offres-immersion/v3/contact')
        .set('authorization', unHeaderAuthorization())
        .send(payload)
        .expect(HttpStatus.CREATED)
    })
    it('renvoie 400 quand experienceAdditionalInformation est une string vide', async () => {
      // Given
      const payload = {
        appellationCode: '11573',
        labelRome: 'Boulangerie - viennoiserie',
        siret: '10226726508419',
        locationId: 'un-location-id',
        prenom: 'prenom',
        nom: 'nom',
        email: 'test@test.com',
        contactMode: 'EMAIL',
        experienceAdditionalInformation: ''
      }

      // When - Then
      await request(app.getHttpServer())
        .post('/jeunes/1/offres-immersion/v3/contact')
        .set('authorization', unHeaderAuthorization())
        .send(payload)
        .expect(HttpStatus.BAD_REQUEST)
    })
    it('renvoie 400 quand resumeLink est une string vide', async () => {
      // Given
      const payload = {
        appellationCode: '11573',
        labelRome: 'Boulangerie - viennoiserie',
        siret: '10226726508419',
        locationId: 'un-location-id',
        prenom: 'prenom',
        nom: 'nom',
        email: 'test@test.com',
        contactMode: 'EMAIL',
        resumeLink: ''
      }

      // When - Then
      await request(app.getHttpServer())
        .post('/jeunes/1/offres-immersion/v3/contact')
        .set('authorization', unHeaderAuthorization())
        .send(payload)
        .expect(HttpStatus.BAD_REQUEST)
    })
    it("renvoie le bon code d'erreur quand la commande est en failure", async () => {
      // Given
      const payload = {
        idJeune: '1',
        appellationCode: '11573',
        labelRome: 'Boulangerie - viennoiserie',
        siret: '10226726508419',
        locationId: 'un-location-id',
        prenom: 'prenom',
        nom: 'nom',
        email: 'test@test.com',
        contactMode: 'EMAIL',
        datePreferences: 'lundi matin',
        numeroTelephone: '0606060606'
      }

      envoyerFormulaireContactImmersionCommandHandler.execute.resolves(
        failure(new ErreurHttp('erreur', 401))
      )

      // When - Then
      await request(app.getHttpServer())
        .post('/jeunes/1/offres-immersion/v3/contact')
        .set('authorization', unHeaderAuthorization())
        .send(payload)
        .expect(HttpStatus.UNAUTHORIZED)
    })
    ensureUserAuthenticationFailsIfInvalid(
      'post',
      '/jeunes/1/offres-immersion/v3/contact'
    )
  })
})
