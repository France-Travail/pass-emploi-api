import { HttpStatus, INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import {
  NotifierBeneficiairesCommand,
  NotifierBeneficiairesCommandHandler
} from '../../../src/application/commands/notifier-beneficiaires.command.handler'
import { ArchiverJeuneSupportCommandHandler } from '../../../src/application/commands/support/archiver-jeune-support.command.handler'
import { CreerJeunePESupportCommandHandler } from '../../../src/application/commands/support/creer-jeune-pe-support-command-handler.service'
import { SupprimerArchiveJeuneCommandHandler } from '../../../src/application/commands/support/supprimer-archive-jeune.command.handler'
import {
  CreerSuperviseursCommand,
  CreerSuperviseursCommandHandler
} from '../../../src/application/commands/support/creer-superviseurs.command.handler'
import {
  DeleteSuperviseursCommand,
  DeleteSuperviseursCommandHandler
} from '../../../src/application/commands/support/delete-superviseurs.command.handler'
import { FusionnerAgencesCommandHandler } from '../../../src/application/commands/support/fusionner-agences.command.handler'
import { UpdateAgenceConseillerCommandHandler } from '../../../src/application/commands/support/update-agence-conseiller.command.handler'
import { UpdateFeatureFlipCommandHandler } from '../../../src/application/commands/support/update-feature-flip.command.handler.db'
import {
  TransfererJeunesConseillerCommand,
  TransfererJeunesConseillerCommandHandler
} from '../../../src/application/commands/transferer-jeunes-conseiller.command.handler'
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
import { Core } from '../../../src/domain/core'
import { FeatureFlip } from '../../../src/domain/feature-flip'
import { Notification } from '../../../src/domain/notification/notification'
import { expect, StubbedClass } from '../../utils'
import { getApplicationWithStubbedDependencies } from '../../utils/module-for-testing'
import { OidcClient } from '../../../src/infrastructure/clients/oidc-client.db'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../../src/domain/planificateur'
import { createSandbox, SinonStub } from 'sinon'
import Bull from 'bull'
import { unConseillerDuJeune, unJeune } from '../../fixtures/jeune.fixture'

describe('SupportController', () => {
  let archiverJeuneSupportCommandHandler: StubbedClass<ArchiverJeuneSupportCommandHandler>
  let creerJeuneSupportCommandHandler: StubbedClass<CreerJeunePESupportCommandHandler>
  let supprimerArchiveJeuneCommandHandler: StubbedClass<SupprimerArchiveJeuneCommandHandler>
  let updateAgenceCommandHandler: StubbedClass<UpdateAgenceConseillerCommandHandler>
  let fusionnerAgencesCommandHandler: StubbedClass<FusionnerAgencesCommandHandler>
  let creerSuperviseursCommandHandler: StubbedClass<CreerSuperviseursCommandHandler>
  let deleteSuperviseursCommandHandler: StubbedClass<DeleteSuperviseursCommandHandler>
  let transfererJeunesConseillerCommandHandler: StubbedClass<TransfererJeunesConseillerCommandHandler>
  let creerNotificationCommandHandler: StubbedClass<NotifierBeneficiairesCommandHandler>
  let updateFeatureFlipCommandHandler: StubbedClass<UpdateFeatureFlipCommandHandler>
  let oidcClient: StubbedClass<OidcClient>
  let planificateurRepository: Planificateur.Repository
  let app: INestApplication
  const sandbox = createSandbox()

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    planificateurRepository = app.get(PlanificateurRepositoryToken)
    sandbox.stub(planificateurRepository, 'compterLesJobs')
    sandbox.stub(planificateurRepository, 'listerJobs')
    archiverJeuneSupportCommandHandler = app.get(
      ArchiverJeuneSupportCommandHandler
    )
    creerJeuneSupportCommandHandler = app.get(CreerJeunePESupportCommandHandler)
    supprimerArchiveJeuneCommandHandler = app.get(
      SupprimerArchiveJeuneCommandHandler
    )
    updateAgenceCommandHandler = app.get(UpdateAgenceConseillerCommandHandler)
    fusionnerAgencesCommandHandler = app.get(FusionnerAgencesCommandHandler)
    creerSuperviseursCommandHandler = app.get(CreerSuperviseursCommandHandler)
    deleteSuperviseursCommandHandler = app.get(DeleteSuperviseursCommandHandler)
    transfererJeunesConseillerCommandHandler = app.get(
      TransfererJeunesConseillerCommandHandler
    )
    updateFeatureFlipCommandHandler = app.get(UpdateFeatureFlipCommandHandler)
    creerNotificationCommandHandler = app.get(
      NotifierBeneficiairesCommandHandler
    )
    oidcClient = app.get(OidcClient)
  })

  after(() => {
    sandbox.restore()
  })

  describe('POST /support/logout/:idJeune', () => {
    it('retourne une 200', async () => {
      // When
      await request(app.getHttpServer())
        .post('/support/logout/test')
        .set({ 'X-API-KEY': 'api-key-support' })
        // Then
        .expect(HttpStatus.CREATED)

      expect(oidcClient.deleteAccount).to.have.been.calledOnceWithExactly(
        'test'
      )
    })
  })

  describe('POST /support/jeunes', () => {
    it('crée un jeune pour le conseiller cible via le support', async () => {
      // Given
      const idConseiller = 'id-conseiller'
      const jeune = unJeune({
        id: 'id-jeune',
        firstName: 'Prenom',
        lastName: 'Nom',
        conseiller: unConseillerDuJeune({ id: idConseiller })
      })
      creerJeuneSupportCommandHandler.execute.resolves(success(jeune))

      // When
      await request(app.getHttpServer())
        .post('/support/jeunes')
        .set({ 'X-API-KEY': 'api-key-support' })
        .send({
          idConseiller,
          firstName: 'Prenom',
          lastName: 'Nom',
          email: 'JEUNE@example.com',
          motif: 'Conseiller absent'
        })
        // Then
        .expect(HttpStatus.CREATED)
        .expect({
          id: jeune.id,
          firstName: jeune.firstName,
          lastName: jeune.lastName,
          idConseiller
        })

      expect(
        creerJeuneSupportCommandHandler.execute
      ).to.have.been.calledOnceWithExactly(
        {
          idConseiller,
          firstName: 'Prenom',
          lastName: 'Nom',
          email: 'JEUNE@example.com',
          motif: 'Conseiller absent'
        },
        Authentification.unUtilisateurSupport()
      )
    })

    it('retourne une erreur quand la commande échoue', async () => {
      // Given
      creerJeuneSupportCommandHandler.execute.resolves(
        failure(new NonTrouveError('Conseiller', 'id-conseiller'))
      )

      // When
      await request(app.getHttpServer())
        .post('/support/jeunes')
        .set({ 'X-API-KEY': 'api-key-support' })
        .send({
          idConseiller: 'id-conseiller',
          firstName: 'Prenom',
          lastName: 'Nom',
          email: 'jeune@example.com'
        })
        // Then
        .expect(HttpStatus.NOT_FOUND)
    })

    it("n'autorise pas la route sans API key support", async () => {
      // When
      await request(app.getHttpServer())
        .post('/support/jeunes')
        .send({
          idConseiller: 'id-conseiller',
          firstName: 'Prenom',
          lastName: 'Nom',
          email: 'jeune@example.com'
        })
        // Then
        .expect(HttpStatus.UNAUTHORIZED)
    })
  })

  describe('POST /support/archiver-jeune/:idJeune', () => {
    describe('quand la commande est en succes', () => {
      it('archive le jeune', async () => {
        // Given
        const idJeune = 'test'
        archiverJeuneSupportCommandHandler.execute.resolves(emptySuccess())

        // When
        await request(app.getHttpServer())
          .post('/support/archiver-jeune/test')
          .set({ 'X-API-KEY': 'api-key-support' })
          // Then
          .expect(HttpStatus.NO_CONTENT)

        expect(
          archiverJeuneSupportCommandHandler.execute
        ).to.have.been.calledOnceWithExactly(
          { idJeune },
          Authentification.unUtilisateurSupport()
        )
      })
    })
    describe('quand la commande est en echec', () => {
      it('throw une erreur', async () => {
        // Given
        const idJeune = 'test'
        archiverJeuneSupportCommandHandler.execute.resolves(
          failure(new NonTrouveError('Jeune', idJeune))
        )

        // When
        await request(app.getHttpServer())
          .post('/support/archiver-jeune/test')
          .set({ 'X-API-KEY': 'api-key-support' })
          // Then
          .expect(HttpStatus.NOT_FOUND)

        expect(
          archiverJeuneSupportCommandHandler.execute
        ).to.have.been.calledOnceWithExactly(
          { idJeune },
          Authentification.unUtilisateurSupport()
        )
      })
    })
    describe('auth', () => {
      it('fail avec mauvaise api key', async () => {
        // Given
        const idJeune = 'test'
        archiverJeuneSupportCommandHandler.execute.resolves(
          failure(new NonTrouveError('Jeune', idJeune))
        )

        // When
        await request(app.getHttpServer())
          .post('/support/archiver-jeune/test')
          .set({ 'X-API-KEY': 'api-key-inconnue' })
          // Then
          .expect(HttpStatus.UNAUTHORIZED)
      })
    })
  })

  describe('POST /support/changer-agence-conseiller', () => {
    const idConseiller = 'test'
    const idNouvelleAgence = 'b'
    describe('quand la commande est en succes', () => {
      it("change l'agence du conseiller", async () => {
        // Given
        updateAgenceCommandHandler.execute.resolves(
          success({
            idAncienneAgence: 'a',
            idNouvelleAgence: 'b',
            infosTransfertAnimationsCollectives: []
          })
        )

        // When
        await request(app.getHttpServer())
          .post('/support/changer-agence-conseiller')
          .set({ 'X-API-KEY': 'api-key-support' })
          .send({ idConseiller, idNouvelleAgence })
          // Then
          .expect(HttpStatus.CREATED)

        expect(
          updateAgenceCommandHandler.execute
        ).to.have.been.calledOnceWithExactly(
          { idConseiller, idNouvelleAgence },
          Authentification.unUtilisateurSupport()
        )
      })
    })
    describe('quand la commande est en echec', () => {
      it('throw une erreur', async () => {
        // Given
        updateAgenceCommandHandler.execute.resolves(
          failure(new NonTrouveError('Agence', 'b'))
        )

        // When
        await request(app.getHttpServer())
          .post('/support/changer-agence-conseiller')
          .set({ 'X-API-KEY': 'api-key-support' })
          .send({ idConseiller, idNouvelleAgence })
          // Then
          .expect(HttpStatus.NOT_FOUND)

        expect(
          updateAgenceCommandHandler.execute
        ).to.have.been.calledOnceWithExactly(
          { idConseiller, idNouvelleAgence },
          Authentification.unUtilisateurSupport()
        )
      })
    })
    describe('auth', () => {
      it('fail sans api key', async () => {
        // Given
        updateAgenceCommandHandler.execute.resolves(
          failure(new NonTrouveError('Agence', 'b'))
        )

        // When
        await request(app.getHttpServer())
          .post('/support/changer-agence-conseiller')
          .set({ 'X-API-KEY': 'api-key' })
          .send({ idConseiller, idNouvelleAgence })
          // Then
          .expect(HttpStatus.UNAUTHORIZED)
      })
    })
  })

  describe('POST /support/fusionner-agences', () => {
    const idAgenceSource = 'test'
    const idAgenceCible = 'b'
    describe('quand la commande est en succes', () => {
      it("change l'agence", async () => {
        // Given
        fusionnerAgencesCommandHandler.execute.resolves(
          success([
            {
              emailConseiller: 'test',
              idAncienneAgence: 'a',
              idNouvelleAgence: 'b',
              infosTransfertAnimationsCollectives: []
            }
          ])
        )

        // When
        await request(app.getHttpServer())
          .post('/support/fusionner-agences')
          .set({ 'X-API-KEY': 'api-key-support' })
          .send({ idAgenceSource, idAgenceCible })
          // Then
          .expect(HttpStatus.CREATED)

        expect(
          fusionnerAgencesCommandHandler.execute
        ).to.have.been.calledOnceWithExactly(
          { idAgenceSource, idAgenceCible },
          Authentification.unUtilisateurSupport()
        )
      })
    })
    describe('quand la commande est en echec', () => {
      it('throw une erreur', async () => {
        // Given
        fusionnerAgencesCommandHandler.execute.resolves(
          failure(new NonTrouveError('Agence', 'b'))
        )

        // When
        await request(app.getHttpServer())
          .post('/support/fusionner-agences')
          .set({ 'X-API-KEY': 'api-key-support' })
          .send({ idAgenceSource, idAgenceCible })
          // Then
          .expect(HttpStatus.NOT_FOUND)

        expect(
          fusionnerAgencesCommandHandler.execute
        ).to.have.been.calledOnceWithExactly(
          { idAgenceSource, idAgenceCible },
          Authentification.unUtilisateurSupport()
        )
      })
    })
    describe('auth', () => {
      it('fail sans api key', async () => {
        // Given
        fusionnerAgencesCommandHandler.execute.resolves(
          failure(new NonTrouveError('Agence', 'b'))
        )

        // When
        await request(app.getHttpServer())
          .post('/support/fusionner-agences')
          .set({ 'X-API-KEY': 'api-key' })
          .send({ idAgenceSource, idAgenceCible })
          // Then
          .expect(HttpStatus.UNAUTHORIZED)
      })
    })
  })

  describe('POST /support/transferer-jeunes', () => {
    describe('quand tous les paramètres sont renseignés', () => {
      it('retourne un succès', async () => {
        // Given
        const payload = {
          idConseillerSource: 'id-conseiller-source',
          idConseillerCible: 'id-conseiller-cible',
          idsJeunes: ['1']
        }

        const command: TransfererJeunesConseillerCommand = {
          ...payload,
          estTemporaire: false,
          provenanceUtilisateur: Authentification.Type.SUPPORT
        }
        transfererJeunesConseillerCommandHandler.execute
          .withArgs(command)
          .resolves(emptySuccess())

        // When
        await request(app.getHttpServer())
          .post('/support/transferer-jeunes')
          .set({ 'X-API-KEY': 'api-key-support' })
          .send(payload)
          // Then
          .expect(HttpStatus.NO_CONTENT)

        expect(
          transfererJeunesConseillerCommandHandler.execute
        ).to.have.been.calledOnceWithExactly(
          command,
          Authentification.unUtilisateurSupport()
        )
      })
    })
  })

  describe('POST /support/superviseurs', () => {
    describe('quand le payload est valide', () => {
      it('renvoie 201', async () => {
        // Given
        const command: CreerSuperviseursCommand = {
          emails: ['test@octo.com']
        }

        creerSuperviseursCommandHandler.execute
          .withArgs(command)
          .resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .post('/support/superviseurs')
          .send(command)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.CREATED)
      })
    })
    describe("quand le payload n'est pas valide", () => {
      it('renvoie 400 quand le champ email est pas bon', async () => {
        // Given
        const payload = {
          superviseurs: [{ email: 'test', structure: Core.Structure.MILO }]
        }

        // When - Then
        await request(app.getHttpServer())
          .post('/support/superviseurs')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
      it('renvoie 400 quand le superviseur est incomplet', async () => {
        // Given
        const payload = {
          superviseurs: [{ email: 'test@octo.com' }]
        }

        // When - Then
        await request(app.getHttpServer())
          .post('/support/superviseurs')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
  })

  describe('POST /support/notifier-beneficiaires', () => {
    describe('quand le payload est valide', () => {
      it("renvoie 201 et l'id du job créé", async () => {
        // Given
        const command: NotifierBeneficiairesCommand = {
          typeNotification: Notification.Type.OUTILS,
          titre: "Les offres d'immersion sont disponibles",
          description: 'Rendez-vous sur la page des offres.',
          structures: [
            Core.Structure.POLE_EMPLOI_AIJ,
            Core.Structure.POLE_EMPLOI_BRSA
          ],
          push: true,
          batchSize: 2000
        }

        creerNotificationCommandHandler.execute
          .withArgs(command)
          .resolves(success({ jobId: '2' }))

        // When - Then
        await request(app.getHttpServer())
          .post('/support/notifier-beneficiaires')
          .send(command)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.CREATED)
          .expect({ jobId: '2' })
      })
    })
    describe("quand le payload n'est pas valide", () => {
      it('renvoie 400 quand le push est une chaine de caractères', async () => {
        // Given
        const payload = {
          type: Notification.Type.OUTILS,
          titre: "Les offres d'immersion sont disponibles",
          description: 'Rendez-vous sur la page des offres.',
          dispositifs: ['PAS_BON'],
          push: 'true',
          batchSize: 2000
        }

        // When - Then
        await request(app.getHttpServer())
          .post('/support/notifier-beneficiaires')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
      it('renvoie 400 quand les dispositifs sont vides', async () => {
        // Given
        const payload = {
          texte: 'Nouvelle notification !',
          dispositifs: [],
          push: true,
          batchSize: 2000
        }

        // When - Then
        await request(app.getHttpServer())
          .post('/support/notifier-beneficiaires')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
      it('renvoie 400 quand le batch size est négatif', async () => {
        // Given
        const payload = {
          texte: 'Nouvelle notification !',
          structures: ['MILO', 'POLE_EMPLOI'],
          push: true,
          batchSize: -1
        }

        // When - Then
        await request(app.getHttpServer())
          .post('/support/notifier-beneficiaires')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
      it("renvoie 400 quand le phaseDeMigration n'existe pas", async () => {
        // Given
        const payload = {
          texte: 'Nouvelle notification !',
          structures: ['MILO', 'POLE_EMPLOI'],
          push: true,
          phaseDeMigration: 'test'
        }

        // When - Then
        await request(app.getHttpServer())
          .post('/support/notifier-beneficiaires')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
    describe('quand la commande a échoué', () => {
      it("renvoie 400 quand l'erreur est de type MauvaiseCommandeError", async () => {
        // Given
        const command: NotifierBeneficiairesCommand = {
          typeNotification: Notification.Type.OUTILS,
          titre: "Les offres d'immersion sont disponibles",
          description: 'Rendez-vous sur la page des offres.',
          structures: [
            Core.Structure.POLE_EMPLOI_AIJ,
            Core.Structure.POLE_EMPLOI_BRSA
          ],
          push: true,
          batchSize: 2000
        }

        creerNotificationCommandHandler.execute
          .withArgs(command)
          .resolves(
            failure(
              new MauvaiseCommandeError(
                'Un job de type NOTIFIER_BENEFICIAIRES est déjà planifié.'
              )
            )
          )

        // When - Then
        await request(app.getHttpServer())
          .post('/support/notifier-beneficiaires')
          .send(command)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
  })

  describe('DELETE /support/superviseurs', () => {
    describe('quand le payload est valide', () => {
      it('renvoie 201', async () => {
        // Given
        const command: DeleteSuperviseursCommand = {
          emails: ['test@octo.com']
        }

        deleteSuperviseursCommandHandler.execute
          .withArgs(command)
          .resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .delete('/support/superviseurs')
          .send(command)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.NO_CONTENT)
      })
    })
    describe("quand le payload n'est pas valide", () => {
      it('renvoie 400 quand le champ email est pas bon', async () => {
        // Given
        const payload = {
          superviseurs: [{ email: 'test', structure: Core.Structure.MILO }]
        }

        // When - Then
        await request(app.getHttpServer())
          .delete('/support/superviseurs')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
      it('renvoie 400 quand le superviseur est incomplet', async () => {
        // Given
        const payload = {
          superviseurs: [{ email: 'test@octo.com' }]
        }

        // When - Then
        await request(app.getHttpServer())
          .delete('/support/superviseurs')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
  })

  describe('POST /feature-flip', () => {
    describe('quand le payload est valide', () => {
      it('renvoie 204', async () => {
        // Given
        const payload = {
          tagFeature: FeatureFlip.Tag.MIGRATION_PHASE_B,
          emailsConseillersAjout: ['test']
        }
        const command = {
          tagFeature: FeatureFlip.Tag.MIGRATION_PHASE_B,
          emailsConseillersAjout: ['test'],
          supprimerExistants: undefined
        }
        updateFeatureFlipCommandHandler.execute
          .withArgs(command)
          .resolves(emptySuccess())
        // When - Then
        await request(app.getHttpServer())
          .post('/support/feature-flip')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
      it('renvoie 204 avec supprimerExistants à false', async () => {
        // Given
        const payload = {
          tagFeature: FeatureFlip.Tag.MIGRATION_PHASE_B,
          emailsConseillersAjout: ['test'],
          supprimerExistants: false
        }
        const command = {
          tagFeature: FeatureFlip.Tag.MIGRATION_PHASE_B,
          emailsConseillersAjout: ['test'],
          supprimerExistants: false
        }
        updateFeatureFlipCommandHandler.execute
          .withArgs(command)
          .resolves(emptySuccess())
        // When - Then
        await request(app.getHttpServer())
          .post('/support/feature-flip')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
      it('renvoie 400 qd supprimerExistants est autre que true', async () => {
        // Given
        const payload = {
          tagFeature: FeatureFlip.Tag.MIGRATION_PHASE_B,
          emailsConseillersAjout: ['test'],
          supprimerExistants: 'true'
        }
        // When - Then
        await request(app.getHttpServer())
          .post('/support/feature-flip')
          .send(payload)
          .set({ 'X-API-KEY': 'api-key-support' })
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
  })

  describe('DELETE /support/archives-jeune/:idArchive', () => {
    describe('quand la commande est en succès', () => {
      it('retourne un 200', async () => {
        // Given
        supprimerArchiveJeuneCommandHandler.execute.resolves(emptySuccess())

        // When
        await request(app.getHttpServer())
          .delete('/support/archives-jeune/42')
          .set({ 'X-API-KEY': 'api-key-support' })
          // Then
          .expect(HttpStatus.OK)

        expect(
          supprimerArchiveJeuneCommandHandler.execute
        ).to.have.been.calledOnceWithExactly(
          { idArchive: 42 },
          Authentification.unUtilisateurSupport()
        )
      })
    })

    describe("quand l'archive n'est pas trouvée", () => {
      it('retourne une 404', async () => {
        // Given
        supprimerArchiveJeuneCommandHandler.execute.resolves(
          failure(new NonTrouveError('ArchiveJeune', '42'))
        )

        // When
        await request(app.getHttpServer())
          .delete('/support/archives-jeune/42')
          .set({ 'X-API-KEY': 'api-key-support' })
          // Then
          .expect(HttpStatus.NOT_FOUND)
      })
    })

    describe('auth', () => {
      it('fail avec mauvaise api key', async () => {
        // When
        await request(app.getHttpServer())
          .delete('/support/archives-jeune/42')
          .set({ 'X-API-KEY': 'api-key-inconnue' })
          // Then
          .expect(HttpStatus.UNAUTHORIZED)
      })
    })
  })

  describe('GET /support/jobs/stats', () => {
    const stats: Planificateur.StatsJobs = {
      parStatut: {
        waiting: 1,
        active: 2,
        delayed: 3,
        completed: 4,
        failed: 5,
        paused: 0
      },
      parTypeStatutsVivants: [
        {
          type: Planificateur.JobType.NOTIFIER_BENEFICIAIRES,
          waiting: 1,
          active: 0,
          delayed: 3,
          failed: 5,
          total: 9
        }
      ]
    }

    it('retourne les stats des jobs', async () => {
      // Given
      ;(planificateurRepository.compterLesJobs as SinonStub).resolves(stats)

      // When - Then
      await request(app.getHttpServer())
        .get('/support/jobs/stats')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.OK)
        .expect(stats)
    })

    describe('auth', () => {
      it('fail avec mauvaise api key', async () => {
        // When - Then
        await request(app.getHttpServer())
          .get('/support/jobs/stats')
          .set({ 'X-API-KEY': 'api-key-inconnue' })
          .expect(HttpStatus.UNAUTHORIZED)
      })
    })
  })

  describe('GET /support/jobs', () => {
    const job = {
      id: '42',
      data: { type: Planificateur.JobType.NOTIFIER_BENEFICIAIRES },
      timestamp: 1000,
      processedOn: 2000,
      finishedOn: 3000,
      attemptsMade: 1,
      failedReason: 'boom'
    } as unknown as Bull.Job

    it('retourne la liste légère des jobs du statut demandé', async () => {
      // Given
      ;(planificateurRepository.listerJobs as SinonStub).resolves([job])

      // When - Then
      await request(app.getHttpServer())
        .get('/support/jobs?statut=failed')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.OK)
        .expect([
          {
            id: '42',
            type: Planificateur.JobType.NOTIFIER_BENEFICIAIRES,
            statut: 'failed',
            timestamp: 1000,
            processedOn: 2000,
            finishedOn: 3000,
            attemptsMade: 1,
            failedReason: 'boom'
          }
        ])

      expect(
        planificateurRepository.listerJobs as SinonStub
      ).to.have.been.calledOnceWithExactly({
        statut: 'failed',
        jobType: undefined,
        debut: undefined,
        fin: undefined
      })
    })

    it('renvoie 400 quand le statut est absent', async () => {
      // When - Then
      await request(app.getHttpServer())
        .get('/support/jobs')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie 400 quand le statut est invalide', async () => {
      // When - Then
      await request(app.getHttpServer())
        .get('/support/jobs?statut=nimporte-quoi')
        .set({ 'X-API-KEY': 'api-key-support' })
        .expect(HttpStatus.BAD_REQUEST)
    })

    describe('auth', () => {
      it('fail avec mauvaise api key', async () => {
        // When - Then
        await request(app.getHttpServer())
          .get('/support/jobs?statut=failed')
          .set({ 'X-API-KEY': 'api-key-inconnue' })
          .expect(HttpStatus.UNAUTHORIZED)
      })
    })
  })
})
