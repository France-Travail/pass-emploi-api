import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { NotifierNouvellesImmersionsJobHandler } from '../../../src/application/jobs/notifier-nouvelles-immersions.job.handler'
import { ConfigurationApplication } from '../../../src/domain/jeune/configuration-application'
import { Notification } from '../../../src/domain/notification/notification'
import { Recherche } from '../../../src/domain/offre/recherche/recherche'
import { Planificateur } from '../../../src/domain/planificateur'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { DateService } from '../../../src/utils/date-service'
import { unJeune } from '../../fixtures/jeune.fixture'
import { uneRecherche } from '../../fixtures/recherche.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { DateTime } from 'luxon'

describe('NotifierNouvellesImmersionsJobHandler', () => {
  let notifierNouvellesImmersionsJobHandler: NotifierNouvellesImmersionsJobHandler
  const sandbox: SinonSandbox = createSandbox()
  const jeune = unJeune()
  const recherche = uneRecherche()
  let rechercheRepository: StubbedType<Recherche.Repository>
  let jeuneRepository: StubbedType<ConfigurationApplication.Repository>
  let notificationService: StubbedClass<Notification.Service>
  let suiviJobService: StubbedType<SuiviJob.Service>

  beforeEach(async () => {
    rechercheRepository = stubInterface(sandbox)
    jeuneRepository = stubInterface(sandbox)
    notificationService = stubClass(Notification.Service)
    suiviJobService = stubInterface(sandbox)
    notifierNouvellesImmersionsJobHandler =
      new NotifierNouvellesImmersionsJobHandler(
        suiviJobService,
        rechercheRepository,
        jeuneRepository,
        notificationService,
        new DateService()
      )
  })

  describe('handle', () => {
    describe('quand il y a une recherche qui correspond', () => {
      let job: Planificateur.Job<Planificateur.JobNotifierNouvellesImmersions>

      beforeEach(() => {
        // Given
        job = {
          dateExecution: DateTime.now().toJSDate(),
          type: Planificateur.JobType.NOTIFIER_NOUVELLES_IMMERSIONS,
          contenu: {
            immersions: [
              {
                rome: 'D1101',
                siret: '12345678901234',
                location: {
                  lat: 48.8566,
                  lon: 2.3522
                }
              }
            ]
          }
        }

        const criteres: Recherche.Immersion = {
          rome: job.contenu!.immersions[0].rome,
          lat: job.contenu!.immersions[0].location!.lat,
          lon: job.contenu!.immersions[0].location!.lon
        }

        rechercheRepository.trouverLesRecherchesImmersions
          .withArgs(criteres, 100, 0)
          .resolves([recherche])
      })

      describe('quand le jeune a un pushNotificationToken', () => {
        it('notifie le jeune', async () => {
          // Given
          jeuneRepository.get.withArgs(recherche.idJeune).resolves(jeune)

          // When
          await notifierNouvellesImmersionsJobHandler.handle(job)

          // Then
          expect(
            notificationService.notifierNouvellesOffres
          ).to.have.been.calledWithExactly(recherche, jeune)
        })
      })

      it('retourne un SuiviJob avec les stats', async () => {
        // Given
        jeuneRepository.get.withArgs(recherche.idJeune).resolves(jeune)

        // When
        const resultat = await notifierNouvellesImmersionsJobHandler.handle(job)

        // Then
        expect(resultat.jobType).to.equal(
          Planificateur.JobType.NOTIFIER_NOUVELLES_IMMERSIONS
        )
        expect(resultat.succes).to.be.true()
        expect(resultat.nbErreurs).to.equal(0)
        expect(resultat.resultat).to.deep.equal({
          nombreDeNouvellesOffres: 1,
          recherchesCorrespondantes: 1,
          erreurs: 0
        })
      })

      it("compte l'échec d'une notification sans mettre le job en échec", async () => {
        // Given
        jeuneRepository.get
          .withArgs(recherche.idJeune)
          .rejects(new Error('erreur'))

        // When
        const resultat = await notifierNouvellesImmersionsJobHandler.handle(job)

        // Then
        expect(resultat.succes).to.be.true()
        expect(resultat.nbErreurs).to.equal(1)
        expect(resultat.resultat).to.deep.equal({
          nombreDeNouvellesOffres: 1,
          recherchesCorrespondantes: 1,
          erreurs: 1
        })
      })
    })

    describe('quand il y a plusieurs pages qui correspondent', () => {
      let job: Planificateur.Job<Planificateur.JobNotifierNouvellesImmersions>
      let criteres: Recherche.Immersion

      beforeEach(() => {
        // Given
        job = {
          dateExecution: DateTime.now().toJSDate(),
          type: Planificateur.JobType.NOTIFIER_NOUVELLES_IMMERSIONS,
          contenu: {
            immersions: [
              {
                rome: 'D1101',
                siret: '12345678901234',
                location: {
                  lat: 48.8566,
                  lon: 2.3522
                }
              }
            ]
          }
        }

        criteres = {
          rome: job.contenu!.immersions[0].rome,
          lat: job.contenu!.immersions[0].location!.lat,
          lon: job.contenu!.immersions[0].location!.lon
        }

        rechercheRepository.trouverLesRecherchesImmersions
          .onFirstCall()
          .resolves(creer100(recherche))
          .onSecondCall()
          .resolves([recherche])
      })

      it('parcourt toutes les pages', async () => {
        // When
        await notifierNouvellesImmersionsJobHandler.handle(job)

        // Then
        expect(
          rechercheRepository.trouverLesRecherchesImmersions
        ).to.have.callCount(2)
        expect(
          rechercheRepository.trouverLesRecherchesImmersions
        ).to.been.calledWithExactly(criteres, 100, 0)
        expect(
          rechercheRepository.trouverLesRecherchesImmersions
        ).to.been.calledWithExactly(criteres, 100, 100)
      })
    })
  })
})

function creer100(recherche: Recherche): Recherche[] {
  const recherches: Recherche[] = []
  for (let i = 0; i < 100; i++) {
    recherches.push(recherche)
  }
  return recherches
}
