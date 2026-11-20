import { HttpStatus, INestApplication } from '@nestjs/common'
import { GetStructuresAccompagnementQueryHandler } from 'src/application/queries/get-structures-accompagnement.query.handler'
import {
  StructureAccompagnementQueryModel,
  TypeStructureAccompagnement
} from 'src/application/queries/query-models/structures-accompagnement.query-model'
import { DroitsInsuffisants } from 'src/building-blocks/types/domain-error'
import { failure, success } from 'src/building-blocks/types/result'
import * as request from 'supertest'
import {
  unHeaderAuthorization,
  unUtilisateurDecode
} from 'test/fixtures/authentification.fixture'
import { StubbedClass } from 'test/utils'
import { ensureUserAuthenticationFailsIfInvalid } from 'test/utils/ensure-user-authentication-fails-if-invalid'
import { getApplicationWithStubbedDependencies } from 'test/utils/module-for-testing'

describe('StructuresAccompagnementController', () => {
  let getStructuresAccompagnementQueryHandler: StubbedClass<GetStructuresAccompagnementQueryHandler>
  let app: INestApplication

  const structure: StructureAccompagnementQueryModel = {
    nom: 'Agence France Travail TOULOUSE ST-MICHEL',
    adresse: {
      ligne: "2 AVENUE DE L'URSS",
      codePostal: '31400',
      ville: 'TOULOUSE'
    },
    telephone: '39-49',
    horaires: ['Lun–ven · 8h30 – 16h30']
  }

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    getStructuresAccompagnementQueryHandler = app.get(
      GetStructuresAccompagnementQueryHandler
    )
  })

  beforeEach(() => {
    getStructuresAccompagnementQueryHandler.execute.reset()
  })

  describe('GET /structures-accompagnement', () => {
    it('renvoie les structures', async () => {
      // Given
      getStructuresAccompagnementQueryHandler.execute
        .withArgs(
          {
            type: TypeStructureAccompagnement.FRANCE_TRAVAIL,
            codeInsee: '31555',
            codePostal: '31000'
          },
          unUtilisateurDecode()
        )
        .resolves(success([structure]))

      // When
      await request(app.getHttpServer())
        .get(
          '/structures-accompagnement?type=FRANCE_TRAVAIL&codeInsee=31555&codePostal=31000'
        )
        .set('authorization', unHeaderAuthorization())
        // Then
        .expect(HttpStatus.OK)
        .expect([structure])
    })

    it('accepte un code INSEE corse', async () => {
      // Given
      getStructuresAccompagnementQueryHandler.execute.resolves(success([]))

      // When
      await request(app.getHttpServer())
        .get(
          '/structures-accompagnement?type=MILO&codeInsee=2A004&codePostal=20000'
        )
        .set('authorization', unHeaderAuthorization())
        // Then
        .expect(HttpStatus.OK)
        .expect([])
    })

    it('renvoie 400 quand le type est inconnu', async () => {
      await request(app.getHttpServer())
        .get(
          '/structures-accompagnement?type=CAF&codeInsee=31555&codePostal=31000'
        )
        .set('authorization', unHeaderAuthorization())
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie 400 quand un paramètre manque', async () => {
      await request(app.getHttpServer())
        .get('/structures-accompagnement?type=MILO&codeInsee=31555')
        .set('authorization', unHeaderAuthorization())
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie 400 quand le code postal est mal formé', async () => {
      await request(app.getHttpServer())
        .get(
          '/structures-accompagnement?type=MILO&codeInsee=31555&codePostal=3100'
        )
        .set('authorization', unHeaderAuthorization())
        .expect(HttpStatus.BAD_REQUEST)
    })

    it("renvoie 403 quand l'utilisateur n'est pas invité", async () => {
      // Given
      getStructuresAccompagnementQueryHandler.execute.resolves(
        failure(new DroitsInsuffisants())
      )

      // When
      await request(app.getHttpServer())
        .get(
          '/structures-accompagnement?type=MILO&codeInsee=31555&codePostal=31000'
        )
        .set('authorization', unHeaderAuthorization())
        // Then
        .expect(HttpStatus.FORBIDDEN)
    })

    ensureUserAuthenticationFailsIfInvalid(
      'get',
      '/structures-accompagnement?type=MILO&codeInsee=31555&codePostal=31000'
    )
  })
})
