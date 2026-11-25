import { HttpStatus, INestApplication } from '@nestjs/common'
import { GetTypesQualificationsQueryHandler } from 'src/application/queries/action/get-types-qualifications.query.handler'
import {
  ActionPredefinieQueryModel,
  TypeQualificationQueryModel
} from 'src/application/queries/query-models/actions.query-model'
import { Action } from 'src/domain/action/action'
import * as request from 'supertest'
import { GetActionsPredefiniesQueryHandler } from '../../../src/application/queries/action/get-actions-predefinies.query.handler'
import { GetAgencesQueryHandler } from '../../../src/application/queries/get-agences.query.handler.db'
import { GetCatalogueDemarchesQueryHandler } from '../../../src/application/queries/get-catalogue-demarches.query.handler'
import { GetCommunesEtDepartementsQueryHandler } from '../../../src/application/queries/get-communes-et-departements.query.handler.db'
import { GetMetiersRomeQueryHandler } from '../../../src/application/queries/get-metiers-rome.query.handler.db'
import { GetMotifsSuppressionJeuneQueryHandler } from '../../../src/application/queries/get-motifs-suppression-jeune.query.handler'
import { CommuneOuDepartementType } from '../../../src/application/queries/query-models/communes-et-departements.query-model'
import { failure, success } from '../../../src/building-blocks/types/result'
import {
  unHeaderAuthorization,
  unUtilisateurDecode
} from '../../fixtures/authentification.fixture'
import { StubbedClass, stubClass } from '../../utils'
import { ensureUserAuthenticationFailsIfInvalid } from '../../utils/ensure-user-authentication-fails-if-invalid'
import { getApplicationWithStubbedDependencies } from '../../utils/module-for-testing'
import { Profil } from '../../../src/domain/profil'
import { GetStructuresAccompagnementQueryHandler } from '../../../src/application/queries/get-structures-accompagnement.query.handler'
import {
  StructureAccompagnementQueryModel,
  TypeStructureAccompagnement
} from '../../../src/application/queries/query-models/structures-accompagnement.query-model'
import { DroitsInsuffisants } from '../../../src/building-blocks/types/domain-error'

let getCommunesEtDepartementsQueryHandler: StubbedClass<GetCommunesEtDepartementsQueryHandler>
let getAgencesQueryHandler: StubbedClass<GetAgencesQueryHandler>
let getMotifsSuppressionQueryHandler: StubbedClass<GetMotifsSuppressionJeuneQueryHandler>
let getTypesQualificationsQueryHandler: StubbedClass<GetTypesQualificationsQueryHandler>
let getActionsPredefiniesQueryHandler: StubbedClass<GetActionsPredefiniesQueryHandler>
let getMetiersRomeQueryHandler: StubbedClass<GetMetiersRomeQueryHandler>
let getCatalogueDemarchesQueryHandler: StubbedClass<GetCatalogueDemarchesQueryHandler>
let getStructuresAccompagnementQueryHandler: StubbedClass<GetStructuresAccompagnementQueryHandler>

describe('ReferentielsController', () => {
  getCommunesEtDepartementsQueryHandler = stubClass(
    GetCommunesEtDepartementsQueryHandler
  )
  getAgencesQueryHandler = stubClass(GetAgencesQueryHandler)
  getMotifsSuppressionQueryHandler = stubClass(
    GetMotifsSuppressionJeuneQueryHandler
  )
  getTypesQualificationsQueryHandler = stubClass(
    GetTypesQualificationsQueryHandler
  )
  getMetiersRomeQueryHandler = stubClass(GetMetiersRomeQueryHandler)
  getActionsPredefiniesQueryHandler = stubClass(
    GetActionsPredefiniesQueryHandler
  )
  getCatalogueDemarchesQueryHandler = stubClass(
    GetCatalogueDemarchesQueryHandler
  )

  let app: INestApplication

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    getCommunesEtDepartementsQueryHandler = app.get(
      GetCommunesEtDepartementsQueryHandler
    )
    getAgencesQueryHandler = app.get(GetAgencesQueryHandler)

    getMotifsSuppressionQueryHandler = app.get(
      GetMotifsSuppressionJeuneQueryHandler
    )
    getTypesQualificationsQueryHandler = app.get(
      GetTypesQualificationsQueryHandler
    )
    getMetiersRomeQueryHandler = app.get(GetMetiersRomeQueryHandler)
    getActionsPredefiniesQueryHandler = app.get(
      GetActionsPredefiniesQueryHandler
    )
    getCatalogueDemarchesQueryHandler = app.get(
      GetCatalogueDemarchesQueryHandler
    )
    getStructuresAccompagnementQueryHandler = app.get(
      GetStructuresAccompagnementQueryHandler
    )
  })

  describe('GET /referentiels/communes-et-departements?recherche=abcde', () => {
    it('renvoie les communes et departements demandés', () => {
      // Given
      getCommunesEtDepartementsQueryHandler.execute
        .withArgs({ recherche: 'abcde', villesOnly: false })
        .resolves([
          {
            libelle: 'abcde',
            code: '5',
            codePostal: '78907',
            type: CommuneOuDepartementType.COMMUNE,
            score: 0.3
          },
          {
            libelle: 'abcd',
            code: '4',
            type: CommuneOuDepartementType.DEPARTEMENT,
            score: 0.2
          }
        ])

      // When - Then
      return request(app.getHttpServer())
        .get('/referentiels/communes-et-departements?recherche=abcde')
        .set('Authorization', 'Bearer ceci-est-un-jwt')
        .expect(HttpStatus.OK)
        .expect([
          {
            code: '5',
            codePostal: '78907',
            libelle: 'abcde',
            score: 0.3,
            type: 'COMMUNE'
          },
          {
            code: '4',
            libelle: 'abcd',
            score: 0.2,
            type: 'DEPARTEMENT'
          }
        ])
    })

    it('renvoie les communes seulement', () => {
      // Given
      getCommunesEtDepartementsQueryHandler.execute
        .withArgs({
          recherche: 'abcde',
          villesOnly: true
        })
        .resolves([
          {
            libelle: 'abcde',
            code: '5',
            codePostal: '78907',
            type: CommuneOuDepartementType.COMMUNE,
            score: 0.3
          }
        ])

      // When - Then
      return request(app.getHttpServer())
        .get(
          '/referentiels/communes-et-departements?recherche=abcde&villesOnly=true'
        )
        .set('Authorization', 'Bearer ceci-est-un-jwt')
        .expect(HttpStatus.OK)
        .expect([
          {
            code: '5',
            codePostal: '78907',
            libelle: 'abcde',
            score: 0.3,
            type: 'COMMUNE'
          }
        ])
    })
  })

  describe('GET /referentiels/metiers?recherche=boulanger', () => {
    it('renvoie les codes rome', () => {
      // Given
      getMetiersRomeQueryHandler.execute
        .withArgs({ recherche: 'boulanger' })
        .resolves([
          {
            libelle: 'Boulanger',
            code: 'D1104',
            score: 0.3
          }
        ])

      // When - Then
      return request(app.getHttpServer())
        .get('/referentiels/metiers?recherche=boulanger')
        .set('Authorization', 'Bearer ceci-est-un-jwt')
        .expect(HttpStatus.OK)
        .expect([
          {
            code: 'D1104',
            libelle: 'Boulanger',
            score: 0.3
          }
        ])
    })
  })

  describe('GET /referentiels/agences', () => {
    describe('avec le query param POLE_EMPLOI', () => {
      it('renvoie les agences Pôle emploi', () => {
        // Given
        getAgencesQueryHandler.execute
          .withArgs({ structure: Profil.Structure.FRANCE_TRAVAIL })
          .resolves([
            {
              id: 'jean michel id',
              nom: 'Agence Batman',
              codeDepartement: 'aa'
            },
            {
              id: 'el yolo de la muerte',
              nom: 'Agence des chauves',
              codeDepartement: 'aa'
            }
          ])

        // When - Then
        return request(app.getHttpServer())
          .get('/referentiels/agences?structure=FRANCE_TRAVAIL')
          .set('Authorization', 'Bearer ceci-est-un-jwt')
          .expect(HttpStatus.OK)
          .expect([
            {
              id: 'jean michel id',
              nom: 'Agence Batman',
              codeDepartement: 'aa'
            },
            {
              id: 'el yolo de la muerte',
              nom: 'Agence des chauves',
              codeDepartement: 'aa'
            }
          ])
      })
    })

    describe('avec le query param POLE_EMPLOI MILO', () => {
      it('renvoie les agences milo', () => {
        // Given
        getAgencesQueryHandler.execute
          .withArgs({ structure: Profil.Structure.MILO })
          .resolves([
            {
              id: 'jean michel id',
              nom: 'Agence Batman',
              codeDepartement: 'aa'
            },
            {
              id: 'el yolo de la muerte',
              nom: 'Agence des chauves',
              codeDepartement: 'aa'
            }
          ])

        // When - Then
        return request(app.getHttpServer())
          .get('/referentiels/agences?structure=MILO')
          .set('Authorization', 'Bearer ceci-est-un-jwt')
          .expect(HttpStatus.OK)
          .expect([
            {
              id: 'jean michel id',
              nom: 'Agence Batman',
              codeDepartement: 'aa'
            },
            {
              id: 'el yolo de la muerte',
              nom: 'Agence des chauves',
              codeDepartement: 'aa'
            }
          ])
      })
    })

    describe('sans structure en query param', () => {
      it('renvoie une 400 ', () => {
        // When - Then
        return request(app.getHttpServer())
          .get('/referentiels/agences')
          .set('Authorization', 'Bearer ceci-est-un-jwt')
          .expect(HttpStatus.BAD_REQUEST)
      })
    })

    describe('avec une structure bidon', () => {
      it('renvoie une 400 ', () => {
        // When - Then
        return request(app.getHttpServer())
          .get('/referentiels/agences?structure=PLOP')
          .set('Authorization', 'Bearer ceci-est-un-jwt')
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
  })

  describe('GET /referentiels/catalogue-demarches', () => {
    describe('quand PE est UP', () => {
      it('renvoie le catalogue de démarches', () => {
        // Given
        getCatalogueDemarchesQueryHandler.execute.resolves([])

        // When - Then
        return request(app.getHttpServer())
          .get('/referentiels/pole-emploi/catalogue-demarches')
          .set('Authorization', 'Bearer ceci-est-un-jwt')
          .expect(HttpStatus.OK)
      })
    })

    ensureUserAuthenticationFailsIfInvalid(
      'get',
      '/referentiels/pole-emploi/catalogue-demarches'
    )
  })

  describe('GET /referentiels/motifs-suppression-jeune', () => {
    it("renvoie les motifs de suppression d'un compte jeune", () => {
      // Given
      getMotifsSuppressionQueryHandler.execute.resolves(success([]))

      // When - Then
      return request(app.getHttpServer())
        .get('/referentiels/motifs-suppression-jeune')
        .set('authorization', unHeaderAuthorization())
        .expect(HttpStatus.OK)
    })
  })

  describe('GET /qualifications-actions/types', () => {
    it('renvoie les types de qualifications des actions', () => {
      // Given
      const types: TypeQualificationQueryModel[] = [
        { code: Action.Qualification.Code.SANTE, label: 'aa', heures: 0 }
      ]

      getTypesQualificationsQueryHandler.execute.resolves(types)

      // When - Then
      return request(app.getHttpServer())
        .get('/referentiels/qualifications-actions/types')
        .set('authorization', unHeaderAuthorization())
        .expect([
          { code: Action.Qualification.Code.SANTE, label: 'aa', heures: 0 }
        ])
        .expect(HttpStatus.OK)
    })

    ensureUserAuthenticationFailsIfInvalid(
      'get',
      '/referentiels/qualifications-actions/types'
    )
  })

  describe('GET /actions-predefinies', () => {
    it('renvoie le référentiel des actions prédéfinies', () => {
      // Given
      const actionsPredefinies: ActionPredefinieQueryModel[] = [
        {
          id: 'action-predefinie-1',
          titre: 'Identifier ses atouts et ses compétences'
        }
      ]

      getActionsPredefiniesQueryHandler.execute.resolves(actionsPredefinies)

      // When - Then
      return request(app.getHttpServer())
        .get('/referentiels/actions-predefinies')
        .set('authorization', unHeaderAuthorization())
        .expect([
          {
            id: 'action-predefinie-1',
            titre: 'Identifier ses atouts et ses compétences'
          }
        ])
        .expect(HttpStatus.OK)
    })

    ensureUserAuthenticationFailsIfInvalid(
      'get',
      '/referentiels/actions-predefinies'
    )
  })

  describe('GET /referentiels/structures-accompagnement', () => {
    const structure: StructureAccompagnementQueryModel = {
      nom: 'Agence France Travail TOULOUSE ST-MICHEL',
      adresse: {
        ligne: "2 AVENUE DE L'URSS",
        codePostal: '31400',
        ville: 'TOULOUSE'
      },
      telephone: '39-49',
      horaires: ['Lun–ven · 8h30 – 12h30, 12h30 – 16h30 sur RDV'],
      horairesAlt:
        'Lundi à vendredi ouvert de 8h30 à 12h30 en accès libre et de 12h30 à 16h30 sur rendez-vous.'
    }

    beforeEach(() => {
      getStructuresAccompagnementQueryHandler.execute.reset()
    })

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
          '/referentiels/structures-accompagnement?type=FRANCE_TRAVAIL&codeInsee=31555&codePostal=31000'
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
          '/referentiels/structures-accompagnement?type=MILO&codeInsee=2A004&codePostal=20000'
        )
        .set('authorization', unHeaderAuthorization())
        // Then
        .expect(HttpStatus.OK)
        .expect([])
    })

    it('renvoie 400 quand le type est inconnu', async () => {
      await request(app.getHttpServer())
        .get(
          '/referentiels/structures-accompagnement?type=CAF&codeInsee=31555&codePostal=31000'
        )
        .set('authorization', unHeaderAuthorization())
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie 400 quand un paramètre manque', async () => {
      await request(app.getHttpServer())
        .get(
          '/referentiels/structures-accompagnement?type=MILO&codeInsee=31555'
        )
        .set('authorization', unHeaderAuthorization())
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie 400 quand le code postal est mal formé', async () => {
      await request(app.getHttpServer())
        .get(
          '/referentiels/structures-accompagnement?type=MILO&codeInsee=31555&codePostal=3100'
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
          '/referentiels/structures-accompagnement?type=MILO&codeInsee=31555&codePostal=31000'
        )
        .set('authorization', unHeaderAuthorization())
        // Then
        .expect(HttpStatus.FORBIDDEN)
    })

    ensureUserAuthenticationFailsIfInvalid(
      'get',
      '/referentiels/structures-accompagnement?type=MILO&codeInsee=31555&codePostal=31000'
    )
  })
})
