import { HttpStatus, INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { GetReferentielRomePocOrientationQueryHandler } from '../../../src/application/queries/get-referentiel-rome-poc-orientation.query.handler'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { expect, StubbedClass } from '../../utils'
import { getApplicationWithStubbedDependencies } from '../../utils/module-for-testing'

describe('PocOrientationController', () => {
  let getReferentielRomePocOrientationQueryHandler: StubbedClass<GetReferentielRomePocOrientationQueryHandler>
  let app: INestApplication

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    getReferentielRomePocOrientationQueryHandler = app.get(
      GetReferentielRomePocOrientationQueryHandler
    )
  })

  describe('GET /referentiels/rome/centres-interet', () => {
    it("renvoie les centres d'intérêt sans authentification", () => {
      // Given
      getReferentielRomePocOrientationQueryHandler.execute
        .withArgs({ ressource: 'CENTRES_INTERET' })
        .resolves(success([{ code: '6', libelle: "J'ai le souci du détail" }]))

      // When - Then
      return request(app.getHttpServer())
        .get('/referentiels/rome/centres-interet')
        .expect(HttpStatus.OK)
        .expect([{ code: '6', libelle: "J'ai le souci du détail" }])
    })
  })

  describe('GET /referentiels/rome/centres-interet/:code/metiers', () => {
    it("renvoie les métiers du centre d'intérêt", () => {
      // Given
      getReferentielRomePocOrientationQueryHandler.execute
        .withArgs({ ressource: 'METIERS_DU_CENTRE_INTERET', code: '6' })
        .resolves(success({ code: '6', metiers: [] }))

      // When - Then
      return request(app.getHttpServer())
        .get('/referentiels/rome/centres-interet/6/metiers')
        .expect(HttpStatus.OK)
        .expect({ code: '6', metiers: [] })
    })

    it("refuse un code qui n'est pas un code de centre d'intérêt", async () => {
      // When
      await request(app.getHttpServer())
        .get('/referentiels/rome/centres-interet/abc/metiers')
        // Then
        .expect(HttpStatus.BAD_REQUEST)
    })
  })

  describe('GET /referentiels/rome/metiers', () => {
    it('renvoie les métiers avec leur profil RIASEC', () => {
      // Given
      getReferentielRomePocOrientationQueryHandler.execute
        .withArgs({ ressource: 'METIERS' })
        .resolves(success([{ code: 'D1102', riasecMajeur: 'R' }]))

      // When - Then
      return request(app.getHttpServer())
        .get('/referentiels/rome/metiers')
        .expect(HttpStatus.OK)
        .expect([{ code: 'D1102', riasecMajeur: 'R' }])
    })
  })

  describe('GET /referentiels/rome/metiers/:code', () => {
    it('renvoie la fiche métier', () => {
      // Given
      getReferentielRomePocOrientationQueryHandler.execute
        .withArgs({ ressource: 'FICHE_METIER', code: 'D1102' })
        .resolves(success({ code: 'D1102', libelle: 'Boulanger / Boulangère' }))

      // When - Then
      return request(app.getHttpServer())
        .get('/referentiels/rome/metiers/D1102')
        .expect(HttpStatus.OK)
        .expect({ code: 'D1102', libelle: 'Boulanger / Boulangère' })
    })

    it("refuse un code qui n'est pas un code ROME", async () => {
      // When
      await request(app.getHttpServer())
        .get('/referentiels/rome/metiers/d1102x')
        // Then
        .expect(HttpStatus.BAD_REQUEST)

      expect(
        getReferentielRomePocOrientationQueryHandler.execute
      ).not.to.have.been.calledWith({
        ressource: 'FICHE_METIER',
        code: 'd1102x'
      })
    })

    it('répond 404 quand le POC est désactivé', () => {
      // Given
      getReferentielRomePocOrientationQueryHandler.execute
        .withArgs({ ressource: 'FICHE_METIER', code: 'J1501' })
        .resolves(failure(new NonTrouveError('POC orientation')))

      // When - Then
      return request(app.getHttpServer())
        .get('/referentiels/rome/metiers/J1501')
        .expect(HttpStatus.NOT_FOUND)
    })
  })
})
