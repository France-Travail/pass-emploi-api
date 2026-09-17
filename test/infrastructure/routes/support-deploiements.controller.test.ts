import { HttpStatus, INestApplication } from '@nestjs/common'
import { DateTime } from 'luxon'
import * as request from 'supertest'
import { AjouterConseillersPopulationCommandHandler } from '../../../src/application/commands/support/ajouter-conseillers-population.command.handler.db'
import { AjouterProfilPopulationCommandHandler } from '../../../src/application/commands/support/ajouter-profil-population.command.handler.db'
import { CreerDeploiementCommandHandler } from '../../../src/application/commands/support/creer-deploiement.command.handler.db'
import { CreerFonctionnaliteCommandHandler } from '../../../src/application/commands/support/creer-fonctionnalite.command.handler.db'
import { CreerPopulationCommandHandler } from '../../../src/application/commands/support/creer-population.command.handler.db'
import { SupprimerConseillersPopulationCommandHandler } from '../../../src/application/commands/support/supprimer-conseillers-population.command.handler.db'
import { ModifierDateDeploiementCommandHandler } from '../../../src/application/commands/support/modifier-date-deploiement.command.handler.db'
import { SupprimerDeploiementCommandHandler } from '../../../src/application/commands/support/supprimer-deploiement.command.handler.db'
import { SupprimerFonctionnaliteCommandHandler } from '../../../src/application/commands/support/supprimer-fonctionnalite.command.handler.db'
import { SupprimerPopulationCommandHandler } from '../../../src/application/commands/support/supprimer-population.command.handler.db'
import { SupprimerProfilPopulationCommandHandler } from '../../../src/application/commands/support/supprimer-profil-population.command.handler.db'
import { CreerCommunicationCommandHandler } from '../../../src/application/commands/support/creer-communication.command.handler.db'
import { ModifierCommunicationCommandHandler } from '../../../src/application/commands/support/modifier-communication.command.handler.db'
import { SupprimerCommunicationCommandHandler } from '../../../src/application/commands/support/supprimer-communication.command.handler.db'
import { GetFonctionnalitesSupportQueryHandler } from '../../../src/application/queries/get-fonctionnalites-support.query.handler.db'
import { GetPopulationSupportQueryHandler } from '../../../src/application/queries/get-population-support.query.handler.db'
import { GetPopulationsSupportQueryHandler } from '../../../src/application/queries/get-populations-support.query.handler.db'
import { PopulationSupportQueryModel } from '../../../src/application/queries/query-models/population-support.query-model'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  success
} from '../../../src/building-blocks/types/result'
import { Authentification } from '../../../src/domain/authentification'
import { Communication } from '../../../src/domain/communication'
import { Deploiement } from '../../../src/domain/deploiement'
import { Profil } from '../../../src/domain/profil'
import { expect, StubbedClass } from '../../utils'
import { getApplicationWithStubbedDependencies } from '../../utils/module-for-testing'

describe('SupportDeploiementsController', () => {
  let getFonctionnalitesSupportQueryHandler: StubbedClass<GetFonctionnalitesSupportQueryHandler>
  let creerFonctionnaliteCommandHandler: StubbedClass<CreerFonctionnaliteCommandHandler>
  let supprimerFonctionnaliteCommandHandler: StubbedClass<SupprimerFonctionnaliteCommandHandler>
  let getPopulationsSupportQueryHandler: StubbedClass<GetPopulationsSupportQueryHandler>
  let getPopulationSupportQueryHandler: StubbedClass<GetPopulationSupportQueryHandler>
  let creerPopulationCommandHandler: StubbedClass<CreerPopulationCommandHandler>
  let supprimerPopulationCommandHandler: StubbedClass<SupprimerPopulationCommandHandler>
  let ajouterConseillersPopulationCommandHandler: StubbedClass<AjouterConseillersPopulationCommandHandler>
  let supprimerConseillersPopulationCommandHandler: StubbedClass<SupprimerConseillersPopulationCommandHandler>
  let ajouterProfilPopulationCommandHandler: StubbedClass<AjouterProfilPopulationCommandHandler>
  let supprimerProfilPopulationCommandHandler: StubbedClass<SupprimerProfilPopulationCommandHandler>
  let creerDeploiementCommandHandler: StubbedClass<CreerDeploiementCommandHandler>
  let modifierDateDeploiementCommandHandler: StubbedClass<ModifierDateDeploiementCommandHandler>
  let supprimerDeploiementCommandHandler: StubbedClass<SupprimerDeploiementCommandHandler>
  let creerCommunicationCommandHandler: StubbedClass<CreerCommunicationCommandHandler>
  let modifierCommunicationCommandHandler: StubbedClass<ModifierCommunicationCommandHandler>
  let supprimerCommunicationCommandHandler: StubbedClass<SupprimerCommunicationCommandHandler>
  let app: INestApplication

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    getFonctionnalitesSupportQueryHandler = app.get(
      GetFonctionnalitesSupportQueryHandler
    )
    creerFonctionnaliteCommandHandler = app.get(
      CreerFonctionnaliteCommandHandler
    )
    supprimerFonctionnaliteCommandHandler = app.get(
      SupprimerFonctionnaliteCommandHandler
    )
    getPopulationsSupportQueryHandler = app.get(
      GetPopulationsSupportQueryHandler
    )
    getPopulationSupportQueryHandler = app.get(GetPopulationSupportQueryHandler)
    creerPopulationCommandHandler = app.get(CreerPopulationCommandHandler)
    supprimerPopulationCommandHandler = app.get(
      SupprimerPopulationCommandHandler
    )
    ajouterConseillersPopulationCommandHandler = app.get(
      AjouterConseillersPopulationCommandHandler
    )
    supprimerConseillersPopulationCommandHandler = app.get(
      SupprimerConseillersPopulationCommandHandler
    )
    ajouterProfilPopulationCommandHandler = app.get(
      AjouterProfilPopulationCommandHandler
    )
    supprimerProfilPopulationCommandHandler = app.get(
      SupprimerProfilPopulationCommandHandler
    )
    creerDeploiementCommandHandler = app.get(CreerDeploiementCommandHandler)
    modifierDateDeploiementCommandHandler = app.get(
      ModifierDateDeploiementCommandHandler
    )
    supprimerDeploiementCommandHandler = app.get(
      SupprimerDeploiementCommandHandler
    )
    creerCommunicationCommandHandler = app.get(CreerCommunicationCommandHandler)
    modifierCommunicationCommandHandler = app.get(
      ModifierCommunicationCommandHandler
    )
    supprimerCommunicationCommandHandler = app.get(
      SupprimerCommunicationCommandHandler
    )
  })

  describe('GET /support/fonctionnalites', () => {
    it('renvoie les ids du référentiel', async () => {
      // Given
      getFonctionnalitesSupportQueryHandler.execute.resolves(
        success({ fonctionnalites: ['DEMARCHES_IA', 'PLAN_D_ACTION'] })
      )

      // When - Then
      await request(app.getHttpServer())
        .get('/support/fonctionnalites')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.OK)
        .expect({ fonctionnalites: ['DEMARCHES_IA', 'PLAN_D_ACTION'] })
    })
  })

  describe('GET /support/populations', () => {
    it('renvoie toutes les populations', async () => {
      // Given
      const populations: PopulationSupportQueryModel[] = [
        {
          id: 'PILOTE_1J1S',
          description: 'Beta testeurs 1J1S',
          conseillers: ['conseiller@email.com'],
          profils: [],
          deploiements: [
            {
              id: 1,
              nature: Deploiement.Nature.FONCTIONNALITE,
              idFonctionnalite: 'PLAN_D_ACTION',
              dateActivation: '2026-10-13T00:00:00.000Z'
            }
          ],
          communications: []
        }
      ]
      getPopulationsSupportQueryHandler.execute.resolves(success(populations))

      // When - Then
      await request(app.getHttpServer())
        .get('/support/populations')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.OK)
        .expect(populations)
    })
  })

  describe('POST /support/fonctionnalites', () => {
    it('renvoie 204 quand le payload est valide', async () => {
      // Given
      creerFonctionnaliteCommandHandler.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .post('/support/fonctionnalites')
        .send({ id: 'PLAN_D_ACTION' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)
    })

    it("renvoie 400 quand l'id est absent", async () => {
      // When - Then
      await request(app.getHttpServer())
        .post('/support/fonctionnalites')
        .send({})
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })
  })

  describe('DELETE /support/fonctionnalites/:idFonctionnalite', () => {
    it('renvoie 204 quand la fonctionnalité existe', async () => {
      // Given
      supprimerFonctionnaliteCommandHandler.execute
        .withArgs(
          { id: 'PLAN_D_ACTION' },
          Authentification.unUtilisateurSupport()
        )
        .resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .delete('/support/fonctionnalites/PLAN_D_ACTION')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)
    })
  })

  describe('POST /support/populations', () => {
    it('renvoie 204 quand le payload est valide', async () => {
      // Given
      creerPopulationCommandHandler.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .post('/support/populations')
        .send({ id: 'PILOTE_1J1S', description: 'Beta testeurs 1J1S' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)

      expect(
        creerPopulationCommandHandler.execute
      ).to.have.been.calledWithExactly(
        { id: 'PILOTE_1J1S', description: 'Beta testeurs 1J1S' },
        Authentification.unUtilisateurSupport()
      )
    })

    it("renvoie 400 quand l'id est absent", async () => {
      // When - Then
      await request(app.getHttpServer())
        .post('/support/populations')
        .send({ description: 'sans id' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })
  })

  describe('GET /support/populations/:idPopulation', () => {
    it('renvoie la population', async () => {
      // Given
      const queryModel: PopulationSupportQueryModel = {
        id: 'PILOTE_1J1S',
        description: 'Beta testeurs 1J1S',
        conseillers: ['conseiller@email.com'],
        profils: [],
        deploiements: [],
        communications: []
      }
      getPopulationSupportQueryHandler.execute
        .withArgs(
          { idPopulation: 'PILOTE_1J1S' },
          Authentification.unUtilisateurSupport()
        )
        .resolves(success(queryModel))

      // When - Then
      await request(app.getHttpServer())
        .get('/support/populations/PILOTE_1J1S')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.OK)
        .expect(queryModel)
    })

    it("renvoie 404 quand la population n'existe pas", async () => {
      // Given
      getPopulationSupportQueryHandler.execute.resolves(
        failure(new NonTrouveError('Population', 'INCONNUE'))
      )

      // When - Then
      await request(app.getHttpServer())
        .get('/support/populations/INCONNUE')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NOT_FOUND)
    })
  })

  describe('DELETE /support/populations/:idPopulation', () => {
    it('renvoie 204 quand la population existe', async () => {
      // Given
      supprimerPopulationCommandHandler.execute
        .withArgs(
          { id: 'PILOTE_1J1S' },
          Authentification.unUtilisateurSupport()
        )
        .resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .delete('/support/populations/PILOTE_1J1S')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)
    })

    it('renvoie 400 quand un déploiement la vise encore', async () => {
      // Given
      supprimerPopulationCommandHandler.execute.resolves(
        failure(new MauvaiseCommandeError('visée par un déploiement'))
      )

      // When - Then
      await request(app.getHttpServer())
        .delete('/support/populations/PILOTE_1J1S')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })
  })

  describe('POST /support/populations/conseillers', () => {
    it('renvoie 204 quand le payload est valide', async () => {
      // Given
      ajouterConseillersPopulationCommandHandler.execute.resolves(
        emptySuccess()
      )

      // When - Then
      await request(app.getHttpServer())
        .post('/support/populations/conseillers')
        .send({
          idPopulation: 'PILOTE_1J1S',
          emailConseillers: ['conseiller@email.com']
        })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)

      expect(
        ajouterConseillersPopulationCommandHandler.execute
      ).to.have.been.calledWithExactly(
        {
          idPopulation: 'PILOTE_1J1S',
          emailConseillers: ['conseiller@email.com']
        },
        Authentification.unUtilisateurSupport()
      )
    })

    it("renvoie 400 quand un email n'en est pas un", async () => {
      // When - Then
      await request(app.getHttpServer())
        .post('/support/populations/conseillers')
        .send({ idPopulation: 'PILOTE_1J1S', emailConseillers: ['test'] })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie 400 quand la liste est vide', async () => {
      // When - Then
      await request(app.getHttpServer())
        .post('/support/populations/conseillers')
        .send({ idPopulation: 'PILOTE_1J1S', emailConseillers: [] })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })
  })

  describe('DELETE /support/populations/conseillers', () => {
    it('renvoie 204 avec une liste emails', async () => {
      // Given
      supprimerConseillersPopulationCommandHandler.execute.resolves(
        emptySuccess()
      )

      // When - Then
      await request(app.getHttpServer())
        .delete('/support/populations/conseillers')
        .send({
          idPopulation: 'PILOTE_1J1S',
          emailConseillers: ['conseiller@email.com']
        })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)

      expect(
        supprimerConseillersPopulationCommandHandler.execute
      ).to.have.been.calledWithExactly(
        {
          idPopulation: 'PILOTE_1J1S',
          emailConseillers: ['conseiller@email.com'],
          supprimerTous: undefined
        },
        Authentification.unUtilisateurSupport()
      )
    })

    it('renvoie 204 avec supprimerTous', async () => {
      // Given
      supprimerConseillersPopulationCommandHandler.execute.resolves(
        emptySuccess()
      )

      // When - Then
      await request(app.getHttpServer())
        .delete('/support/populations/conseillers')
        .send({ idPopulation: 'PILOTE_1J1S', supprimerTous: true })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)
    })

    it('renvoie 400 quand supprimerTous est autre que booléen', async () => {
      // When - Then
      await request(app.getHttpServer())
        .delete('/support/populations/conseillers')
        .send({ idPopulation: 'PILOTE_1J1S', supprimerTous: 'true' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie 400 sans emailConseillers ni supprimerTous', async () => {
      // When - Then
      await request(app.getHttpServer())
        .delete('/support/populations/conseillers')
        .send({ idPopulation: 'PILOTE_1J1S' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie 400 avec une liste vide sans supprimerTous', async () => {
      // When - Then
      await request(app.getHttpServer())
        .delete('/support/populations/conseillers')
        .send({
          idPopulation: 'PILOTE_1J1S',
          emailConseillers: [],
          supprimerTous: false
        })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })
  })

  describe('POST /support/populations/profils', () => {
    it('renvoie 204 avec structure et dispositif', async () => {
      // Given
      ajouterProfilPopulationCommandHandler.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .post('/support/populations/profils')
        .send({
          idPopulation: 'FT_CEJ',
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)

      expect(
        ajouterProfilPopulationCommandHandler.execute
      ).to.have.been.calledWithExactly(
        {
          idPopulation: 'FT_CEJ',
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        },
        Authentification.unUtilisateurSupport()
      )
    })

    it('renvoie 204 sans dispositif', async () => {
      // Given
      ajouterProfilPopulationCommandHandler.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .post('/support/populations/profils')
        .send({ idPopulation: 'MILO_TOUS', structure: Profil.Structure.MILO })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)
    })

    it('renvoie 400 quand la structure est inconnue', async () => {
      // When - Then
      await request(app.getHttpServer())
        .post('/support/populations/profils')
        .send({ idPopulation: 'MILO_TOUS', structure: 'PAS_BON' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })
  })

  describe('DELETE /support/populations/profils', () => {
    it('renvoie 204 quand le payload est valide', async () => {
      // Given
      supprimerProfilPopulationCommandHandler.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .delete('/support/populations/profils')
        .send({ idPopulation: 'MILO_TOUS', structure: Profil.Structure.MILO })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)

      expect(
        supprimerProfilPopulationCommandHandler.execute
      ).to.have.been.calledWithExactly(
        {
          idPopulation: 'MILO_TOUS',
          structure: Profil.Structure.MILO,
          dispositif: undefined
        },
        Authentification.unUtilisateurSupport()
      )
    })
  })

  describe('POST /support/deploiements', () => {
    it("renvoie 201 et l'id pour une fonctionnalité", async () => {
      // Given
      creerDeploiementCommandHandler.execute.resolves(success({ id: 7 }))

      // When - Then
      await request(app.getHttpServer())
        .post('/support/deploiements')
        .send({
          nature: Deploiement.Nature.FONCTIONNALITE,
          idPopulation: 'PILOTE_1J1S',
          idFonctionnalite: 'PLAN_D_ACTION',
          dateActivation: '2026-10-13T00:00:00.000Z'
        })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.CREATED)
        .expect({ id: 7 })

      expect(
        creerDeploiementCommandHandler.execute
      ).to.have.been.calledWithExactly(
        {
          nature: Deploiement.Nature.FONCTIONNALITE,
          idPopulation: 'PILOTE_1J1S',
          idFonctionnalite: 'PLAN_D_ACTION',
          dateActivation: DateTime.fromISO('2026-10-13T00:00:00.000Z')
        },
        Authentification.unUtilisateurSupport()
      )
    })

    it('renvoie 201 pour une migration sans fonctionnalité', async () => {
      // Given
      creerDeploiementCommandHandler.execute.resolves(success({ id: 8 }))

      // When - Then
      await request(app.getHttpServer())
        .post('/support/deploiements')
        .send({
          nature: Deploiement.Nature.MIGRATION,
          idPopulation: 'PHASE_A_MIGRATION',
          dateActivation: '2026-10-01T00:00:00.000Z'
        })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.CREATED)
        .expect({ id: 8 })
    })

    it('renvoie 400 quand la nature est inconnue', async () => {
      // When - Then
      await request(app.getHttpServer())
        .post('/support/deploiements')
        .send({
          nature: 'AUTRE',
          idPopulation: 'PILOTE_1J1S',
          dateActivation: '2026-10-13T00:00:00.000Z'
        })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it("renvoie 400 quand la date d'activation n'est pas une date", async () => {
      // When - Then
      await request(app.getHttpServer())
        .post('/support/deploiements')
        .send({
          nature: Deploiement.Nature.MIGRATION,
          idPopulation: 'PILOTE_1J1S',
          dateActivation: 'demain'
        })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie 400 quand la commande est incohérente', async () => {
      // Given
      creerDeploiementCommandHandler.execute.resolves(
        failure(new MauvaiseCommandeError('idFonctionnalite requis'))
      )

      // When - Then
      await request(app.getHttpServer())
        .post('/support/deploiements')
        .send({
          nature: Deploiement.Nature.FONCTIONNALITE,
          idPopulation: 'PILOTE_1J1S',
          dateActivation: '2026-10-13T00:00:00.000Z'
        })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })
  })

  describe('PUT /support/deploiements/:idDeploiement', () => {
    it('renvoie 204 et transmet la nouvelle date', async () => {
      // Given
      modifierDateDeploiementCommandHandler.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .put('/support/deploiements/7')
        .send({ dateActivation: '2026-11-02T00:00:00.000Z' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)

      expect(
        modifierDateDeploiementCommandHandler.execute
      ).to.have.been.calledWithExactly(
        { id: 7, dateActivation: DateTime.fromISO('2026-11-02T00:00:00.000Z') },
        Authentification.unUtilisateurSupport()
      )
    })

    it("renvoie 400 quand la date n'est pas une date", async () => {
      // When - Then
      await request(app.getHttpServer())
        .put('/support/deploiements/7')
        .send({ dateActivation: 'demain' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it("renvoie 404 quand le déploiement n'existe pas", async () => {
      // Given
      modifierDateDeploiementCommandHandler.execute.resolves(
        failure(new NonTrouveError('Déploiement', '99'))
      )

      // When - Then
      await request(app.getHttpServer())
        .put('/support/deploiements/99')
        .send({ dateActivation: '2026-11-02T00:00:00.000Z' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NOT_FOUND)
    })
  })

  describe('DELETE /support/deploiements/:idDeploiement', () => {
    it('renvoie 204 quand le déploiement existe', async () => {
      // Given
      supprimerDeploiementCommandHandler.execute
        .withArgs({ id: 7 }, Authentification.unUtilisateurSupport())
        .resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .delete('/support/deploiements/7')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)
    })

    it("renvoie 400 quand l'id n'est pas un entier", async () => {
      // When - Then
      await request(app.getHttpServer())
        .delete('/support/deploiements/sept')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it("renvoie 404 quand le déploiement n'existe pas", async () => {
      // Given
      supprimerDeploiementCommandHandler.execute.resolves(
        failure(new NonTrouveError('Déploiement', '99'))
      )

      // When - Then
      await request(app.getHttpServer())
        .delete('/support/deploiements/99')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NOT_FOUND)
    })
  })

  describe('POST /support/communications', () => {
    const payload = {
      idPopulation: 'PHASE_C',
      destinataire: 'CONSEILLER',
      type: 'IN_APP',
      dateDebut: '2026-09-30T00:00:00.000Z',
      dateFin: '2026-10-15T00:00:00.000Z',
      titre: 'Votre application évolue',
      contenu: 'Le 15 octobre 2026…'
    }

    it("renvoie 201 et l'id", async () => {
      // Given
      creerCommunicationCommandHandler.execute.resolves(success({ id: 3 }))

      // When - Then
      await request(app.getHttpServer())
        .post('/support/communications')
        .send(payload)
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.CREATED)
        .expect({ id: 3 })

      expect(
        creerCommunicationCommandHandler.execute
      ).to.have.been.calledWithExactly(
        {
          idPopulation: 'PHASE_C',
          destinataire: Communication.Destinataire.CONSEILLER,
          type: Communication.Type.IN_APP,
          dateDebut: DateTime.fromISO('2026-09-30T00:00:00.000Z'),
          dateFin: DateTime.fromISO('2026-10-15T00:00:00.000Z'),
          titre: 'Votre application évolue',
          contenu: 'Le 15 octobre 2026…',
          ctaLabel: undefined,
          ctaUrlAndroid: undefined,
          ctaUrlIos: undefined
        },
        Authentification.unUtilisateurSupport()
      )
    })

    it('renvoie 400 quand le destinataire est inconnu', async () => {
      // When - Then
      await request(app.getHttpServer())
        .post('/support/communications')
        .send({ ...payload, destinataire: 'TOUT_LE_MONDE' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie 400 quand les dates sont incohérentes', async () => {
      // Given
      creerCommunicationCommandHandler.execute.resolves(
        failure(new MauvaiseCommandeError('dates'))
      )

      // When - Then
      await request(app.getHttpServer())
        .post('/support/communications')
        .send(payload)
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it("renvoie 404 quand la population n'existe pas", async () => {
      // Given
      creerCommunicationCommandHandler.execute.resolves(
        failure(new NonTrouveError('Population', 'PHASE_C'))
      )

      // When - Then
      await request(app.getHttpServer())
        .post('/support/communications')
        .send(payload)
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NOT_FOUND)
    })
  })

  describe('PUT /support/communications/:idCommunication', () => {
    const payload = {
      idPopulation: 'PHASE_C',
      destinataire: 'CONSEILLER',
      type: 'IN_APP',
      dateDebut: '2026-09-30T00:00:00.000Z',
      dateFin: '2026-10-15T00:00:00.000Z',
      titre: 'Titre corrigé',
      contenu: 'Contenu corrigé'
    }

    it('renvoie 204', async () => {
      // Given
      modifierCommunicationCommandHandler.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .put('/support/communications/3')
        .send(payload)
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)

      expect(
        modifierCommunicationCommandHandler.execute
      ).to.have.been.calledWithExactly(
        {
          id: 3,
          idPopulation: 'PHASE_C',
          destinataire: Communication.Destinataire.CONSEILLER,
          type: Communication.Type.IN_APP,
          dateDebut: DateTime.fromISO('2026-09-30T00:00:00.000Z'),
          dateFin: DateTime.fromISO('2026-10-15T00:00:00.000Z'),
          titre: 'Titre corrigé',
          contenu: 'Contenu corrigé',
          ctaLabel: undefined,
          ctaUrlAndroid: undefined,
          ctaUrlIos: undefined
        },
        Authentification.unUtilisateurSupport()
      )
    })

    it('renvoie 400 quand les dates sont incohérentes', async () => {
      // Given
      modifierCommunicationCommandHandler.execute.resolves(
        failure(new MauvaiseCommandeError('dates'))
      )

      // When - Then
      await request(app.getHttpServer())
        .put('/support/communications/3')
        .send(payload)
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it("renvoie 404 quand la communication n'existe pas", async () => {
      // Given
      modifierCommunicationCommandHandler.execute.resolves(
        failure(new NonTrouveError('Communication', '3'))
      )

      // When - Then
      await request(app.getHttpServer())
        .put('/support/communications/3')
        .send(payload)
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NOT_FOUND)
    })

    it("renvoie 404 quand la nouvelle population n'existe pas", async () => {
      // Given
      modifierCommunicationCommandHandler.execute.resolves(
        failure(new NonTrouveError('Population', 'INCONNUE'))
      )

      // When - Then
      await request(app.getHttpServer())
        .put('/support/communications/3')
        .send({ ...payload, idPopulation: 'INCONNUE' })
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NOT_FOUND)
    })
  })

  describe('DELETE /support/communications/:idCommunication', () => {
    it('renvoie 204', async () => {
      // Given
      supprimerCommunicationCommandHandler.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .delete('/support/communications/3')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NO_CONTENT)

      expect(
        supprimerCommunicationCommandHandler.execute
      ).to.have.been.calledWithExactly(
        { id: 3 },
        Authentification.unUtilisateurSupport()
      )
    })

    it("renvoie 404 quand la communication n'existe pas", async () => {
      // Given
      supprimerCommunicationCommandHandler.execute.resolves(
        failure(new NonTrouveError('Communication', '3'))
      )

      // When - Then
      await request(app.getHttpServer())
        .delete('/support/communications/3')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.NOT_FOUND)
    })
  })
})
