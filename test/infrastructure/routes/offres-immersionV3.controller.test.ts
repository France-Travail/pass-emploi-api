import { HttpStatus, INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import {
  NotifierNouvellesImmersionsCommand,
  NotifierNouvellesImmersionsCommandHandler
} from '../../../src/application/commands/notifier-nouvelles-immersions.command.handler'
import { GetOffresImmersionQuery } from '../../../src/application/queries/get-offres-immersion.query.handler'
import {
  DetailOffreImmersionQueryModelV3,
  OffreImmersionQueryModelV3
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

  describe('GET /v3/offres-immersion', () => {
    describe('quand tout va bien', () => {
      it("fait appel à l'API Immersion avec les bons paramètres", async () => {
        // Given
        const getOffresImmersionQuery: GetOffresImmersionQuery = {
          rome: 'D1102',
          lat: 48.502103949334845,
          lon: 2.13082255225161
        }

        const offresImmersionQueryModel: OffreImmersionQueryModelV3[] = [
          {
            siret: '12345',
            metier: 'Boulanger',
            nomEtablissement: 'Boulangerie',
            secteurActivite: 'Restauration',
            ville: 'Paris',
            estVolontaire: true,
            locationId: 'loc-1',
            appellationCode: 'D1102',
            codeRome: 'D1102'
          }
        ]

        getOffresImmersionQueryHandler.execute.resolves(
          success(offresImmersionQueryModel)
        )

        // When
        const result = await request(app.getHttpServer())
          .get('/v3/offres-immersion')
          .set('authorization', unHeaderAuthorization())
          .query(getOffresImmersionQuery)
          // Then
          .expect(HttpStatus.OK)

        expect(result.body).to.deep.equal(offresImmersionQueryModel)
      })
    })
    describe('quand la requête est mauvaise', () => {
      it("renvoie un message d'erreur", async () => {
        // Given
        const getOffresImmersionQuery: GetOffresImmersionQuery = {
          rome: 'D1102',
          lat: 48.502103949334845,
          lon: 2.13082255225161
        }

        getOffresImmersionQueryHandler.execute.resolves(
          failure(new ErreurHttp('Les champs sont pas bons', 400))
        )

        // When
        await request(app.getHttpServer())
          .get('/v3/offres-immersion')
          .set('authorization', unHeaderAuthorization())
          .query(getOffresImmersionQuery)
          // Then
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
    ensureUserAuthenticationFailsIfInvalid('get', '/v3/offres-immersion')
  })
  describe('GET /v3/offres-immersion/:siret/:appellationCode/:locationId', () => {
    const query: GetDetailOffreImmersionQueryV3 = {
      siret: 'un-siret',
      appellationCode: 'un-appellation-code',
      locationId: 'un-location-id'
    }
    const path = `/v3/offres-immersion/${query.siret}/${query.appellationCode}/${query.locationId}`

    describe('quand tout va bien', () => {
      it('renvoie la bonne offre recherchée', async () => {
        // Given
        const detailOffreImmersionQueryModel: DetailOffreImmersionQueryModelV3 =
          {
            adresse: 'addresse',
            estVolontaire: true,
            siret: 'siret',
            metier: 'rome',
            nomEtablissement: 'name',
            secteurActivite: 'naf',
            ville: 'Paris',
            locationId: 'un-location-id',
            appellationCode: 'code',
            codeRome: 'D1102'
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
      '/v3/offres-immersion/siret/code/location'
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
        labelRome: 'Boulangerie - viennoiserie',
        siret: '10226726508419',
        locationId: 'un-location-id',
        prenom: 'prenom',
        nom: 'nom',
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
        datePreferences: 'lundi matin'
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
