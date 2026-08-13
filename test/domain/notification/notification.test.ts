import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { uneAction } from 'test/fixtures/action.fixture'
import {
  desPreferencesJeune,
  uneConfiguration,
  unJeune,
  unJeuneSansPushNotificationToken
} from 'test/fixtures/jeune.fixture'
import { uneNotification } from 'test/fixtures/notification.fixture'
import { uneRecherche } from 'test/fixtures/recherche.fixture'
import { unRendezVous } from 'test/fixtures/rendez-vous.fixture'
import { uneSessionMiloAllegee } from 'test/fixtures/sessions.fixture'
import { Core } from '../../../src/domain/core'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { Notification } from '../../../src/domain/notification/notification'
import { DateService } from '../../../src/utils/date-service'
import { resoudreDateMilo } from '../../../src/utils/milo-date'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'

describe('Notification', () => {
  describe('Service', () => {
    let notificationService: Notification.Service
    let notificationRepository: StubbedType<Notification.Repository>
    let dateService: StubbedClass<DateService>

    beforeEach(() => {
      dateService = stubClass(DateService)
      const sandbox = createSandbox()
      notificationRepository = stubInterface(sandbox)
      notificationService = new Notification.Service(
        notificationRepository,
        dateService
      )
    })

    describe('notifierLesJeunesDuRdv', () => {
      it('notifie les jeunes avec pushNotificationToken du nouveau rdv', async () => {
        // Given
        const rdv = unRendezVous({
          jeunes: [unJeune(), unJeuneSansPushNotificationToken()],
          date: new Date('2021-11-11T08:03:30.000Z'),
          titre: 'rdv'
        })
        const typeNotification = Notification.Type.NEW_RENDEZVOUS
        const expectedNotification = uneNotification({
          token: rdv.jeunes[0].configuration?.pushNotificationToken,
          notification: {
            title: 'Nouveau rendez-vous',
            body: 'Votre conseiller a programmé un nouveau rendez-vous le 11/11 : rdv'
          },
          data: {
            type: typeNotification,
            id: rdv.id
          }
        })

        // When
        await notificationService.notifierLesJeunesDuRdv(rdv, typeNotification)

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          rdv.jeunes[0].id
        )
      })
      it('notifie les jeunes avec pushNotificationToken du rdv modifié', async () => {
        // Given
        const rdv = unRendezVous({
          jeunes: [unJeune(), unJeuneSansPushNotificationToken()],
          date: new Date('2021-11-11T08:03:30.000Z'),
          titre: 'rdv'
        })
        const typeNotification = Notification.Type.UPDATED_RENDEZVOUS
        const expectedNotification = uneNotification({
          token: rdv.jeunes[0].configuration?.pushNotificationToken,
          notification: {
            title: 'Rendez-vous modifié',
            body: 'Votre rendez-vous du 11/11 a été modifié : rdv'
          },
          data: {
            type: Notification.Type.NEW_RENDEZVOUS,
            id: rdv.id
          }
        })

        // When
        await notificationService.notifierLesJeunesDuRdv(rdv, typeNotification)

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          rdv.jeunes[0].id
        )
      })
      it('notifie les jeunes avec pushNotificationToken du rdv supprimé', async () => {
        // Given
        const rdv = unRendezVous({
          jeunes: [unJeune(), unJeuneSansPushNotificationToken()],
          date: new Date('2021-11-11T08:03:30.000Z'),
          titre: 'rdv'
        })
        const typeNotification = Notification.Type.DELETED_RENDEZVOUS
        const expectedNotification = uneNotification({
          token: rdv.jeunes[0].configuration?.pushNotificationToken,
          notification: {
            title: 'Rendez-vous supprimé',
            body: `Votre rendez-vous du 11/11 est supprimé : rdv`
          },
          data: {
            type: typeNotification
          }
        })

        // When
        await notificationService.notifierLesJeunesDuRdv(rdv, typeNotification)

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          rdv.jeunes[0].id
        )
      })
      it('notifie les jeunes avec pushNotificationToken du rdv annulé', async () => {
        // Given
        const rdv = unRendezVous({
          jeunes: [unJeune(), unJeuneSansPushNotificationToken()],
          date: new Date('2021-11-11T08:03:30.000Z'),
          titre: 'rdv'
        })
        const typeNotification = Notification.Type.CANCELED_RENDEZVOUS
        const expectedNotification = uneNotification({
          token: rdv.jeunes[0].configuration?.pushNotificationToken,
          notification: {
            title: 'Rendez-vous annulé',
            body: `Votre rendez-vous du 11/11 est annulé : rdv`
          },
          data: {
            type: typeNotification,
            id: rdv.id
          }
        })

        // When
        await notificationService.notifierLesJeunesDuRdv(rdv, typeNotification)

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          rdv.jeunes[0].id
        )
      })
      it('ne notifie pas les jeunes avec preferences de notification désactivés pour les rdv', async () => {
        // Given
        const rdv = unRendezVous({
          jeunes: [
            unJeune(),
            unJeuneSansPushNotificationToken(),
            unJeune({
              preferences: desPreferencesJeune({ rendezVousSessions: false })
            })
          ],
          date: new Date('2021-11-11T08:03:30.000Z'),
          titre: 'rdv'
        })
        const typeNotification = Notification.Type.NEW_RENDEZVOUS
        const expectedNotification = uneNotification({
          token: rdv.jeunes[0].configuration?.pushNotificationToken,
          notification: {
            title: 'Nouveau rendez-vous',
            body: 'Votre conseiller a programmé un nouveau rendez-vous le 11/11 : rdv'
          },
          data: {
            type: typeNotification,
            id: rdv.id
          }
        })

        // When
        await notificationService.notifierLesJeunesDuRdv(rdv, typeNotification)

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          rdv.jeunes[0].id
        )
      })
    })

    describe('notifierLesJeunesDuNouveauMessage', () => {
      it('notifie les jeunes avec pushNotificationToken', async () => {
        // Given
        const jeunes: Jeune[] = [unJeune(), unJeuneSansPushNotificationToken()]
        const expectedNotification = uneNotification({
          token: jeunes[0].configuration!.pushNotificationToken
        })

        // When
        await notificationService.notifierLesJeunesDuNouveauMessage(jeunes)

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification
        )
      })
      it('ne notifie pas les jeunes avec preferences de notification désactivés pour les messages', async () => {
        const jeunes: Jeune[] = [
          unJeune(),
          unJeuneSansPushNotificationToken(),
          unJeune({
            preferences: desPreferencesJeune({ messages: false })
          })
        ]
        const expectedNotification = uneNotification({
          token: jeunes[0].configuration!.pushNotificationToken
        })

        // When
        await notificationService.notifierLesJeunesDuNouveauMessage(jeunes)

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification
        )
      })
    })

    describe('notifierRappelCreationActionDemarche', () => {
      it('notifie les jeunes Milo en choix 4', async () => {
        // Given
        const jeune = {
          id: 'test',
          structure: Core.Structure.MILO,
          token: 'tok'
        }
        dateService.now.returns(DateTime.fromISO('2020-04-06T12:00:00.000Z'))
        const expectedNotification = uneNotification({
          token: 'tok',
          notification: {
            title: 'Le conseil du jeudi 😏',
            body: 'C’est le moment de renseigner vos actions de la semaine'
          },
          data: {
            type: Notification.Type.RAPPEL_CREATION_ACTION
          }
        })

        // When
        await notificationService.notifierRappelCreationActionDemarche(
          jeune.id,
          jeune.structure,
          jeune.token,
          0,
          undefined
        )

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          jeune.id
        )
      })
      it('notifie les jeunes FT en choix 3', async () => {
        // Given
        const jeune = {
          id: 'test',
          structure: Core.Structure.POLE_EMPLOI,
          token: 'tok'
        }
        dateService.now.returns(DateTime.fromISO('2020-04-27T12:00:00.000Z'))
        const expectedNotification = uneNotification({
          token: 'tok',
          notification: {
            title: 'Plus que qu’un jour avant le week-end !',
            body: 'Prenez 5 minutes pour renseigner vos démarches'
          },
          data: {
            type: Notification.Type.RAPPEL_CREATION_DEMARCHE
          }
        })

        // When
        await notificationService.notifierRappelCreationActionDemarche(
          jeune.id,
          jeune.structure,
          jeune.token,
          0,
          undefined
        )

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          jeune.id
        )
      })
      it('notifie les jeunes du comptage à 10h', async () => {
        // Given
        const jeune = {
          id: 'test',
          structure: Core.Structure.MILO,
          token: 'tok'
        }
        dateService.now.returns(DateTime.fromISO('2020-04-27T12:00:00.000Z'))
        const expectedNotification = uneNotification({
          token: 'tok',
          notification: {
            title: 'On est jeudi ! 🥳',
            body: 'Continuez à saisir vos actions de la semaine'
          },
          data: {
            type: Notification.Type.RAPPEL_CREATION_ACTION
          }
        })

        // When
        await notificationService.notifierRappelCreationActionDemarche(
          jeune.id,
          jeune.structure,
          jeune.token,
          2,
          true
        )

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          jeune.id
        )
      })
      it('ne notifie pas les jeunes PE du comptage à 10h', async () => {
        // Given
        const jeune = {
          id: 'test',
          structure: Core.Structure.POLE_EMPLOI,
          token: 'tok'
        }
        dateService.now.returns(DateTime.fromISO('2020-04-27T12:00:00.000Z'))

        // When
        await notificationService.notifierRappelCreationActionDemarche(
          jeune.id,
          jeune.structure,
          jeune.token,
          2,
          true
        )

        // Then
        expect(notificationRepository.send).not.to.have.been.called()
      })
      it('ne notifie pas les jeunes MILO du comptage à 10h', async () => {
        // Given
        const jeune = {
          id: 'test',
          structure: Core.Structure.MILO,
          token: 'tok'
        }
        dateService.now.returns(DateTime.fromISO('2020-04-27T12:00:00.000Z'))

        // When
        await notificationService.notifierRappelCreationActionDemarche(
          jeune.id,
          jeune.structure,
          jeune.token,
          2,
          false
        )

        // Then
        expect(notificationRepository.send).not.to.have.been.called()
      })
    })

    describe('notifierNouvelleAction', () => {
      it('notifie les jeunes avec pushNotificationToken', async () => {
        // Given
        const jeune: Jeune = unJeune()
        const action = uneAction()
        const expectedNotification = uneNotification({
          token: jeune.configuration?.pushNotificationToken,
          notification: {
            title: 'Nouvelle action',
            body: 'Vous avez une nouvelle action'
          },
          data: {
            type: Notification.Type.NEW_ACTION,
            id: action.id
          }
        })

        // When
        await notificationService.notifierNouvelleAction(jeune, action)

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          jeune.id
        )
      })

      it('ne notifie pas les jeunes avec preferences de notification désactivés pour les actions', async () => {
        // Given
        const jeune: Jeune = unJeune({
          preferences: desPreferencesJeune({ creationActionConseiller: false })
        })
        const action = uneAction()

        // When
        await notificationService.notifierNouvelleAction(jeune, action)

        // Then
        expect(notificationRepository.send).to.not.have.been.called()
      })
    })

    describe('notifierNouveauCommentaireAction', () => {
      describe('quand le jeune a un token', () => {
        it('notifie', async () => {
          // Given
          const idAction = '4718eca6-bbb5-47fb-91bc-78e87294fd0f'
          const configurationApplication = uneConfiguration()
          const expectedNotification = uneNotification({
            token: configurationApplication.pushNotificationToken,
            notification: {
              title: 'Action mise à jour',
              body: 'Un commentaire a été ajouté par votre conseiller'
            },
            data: {
              type: Notification.Type.DETAIL_ACTION,
              id: idAction
            }
          })

          // When
          await notificationService.notifierNouveauCommentaireAction(
            idAction,
            configurationApplication
          )

          // Then
          expect(
            notificationRepository.send
          ).to.have.been.calledOnceWithExactly(
            expectedNotification,
            configurationApplication.idJeune
          )
        })
      })

      describe("quand le jeune n'a pas de token", () => {
        it('ne notifie pas', async () => {
          // Given
          const idAction = '4718eca6-bbb5-47fb-91bc-78e87294fd0f'
          const configurationApplication = uneConfiguration({
            pushNotificationToken: undefined
          })

          // When
          await notificationService.notifierNouveauCommentaireAction(
            idAction,
            configurationApplication
          )

          // Then
          expect(notificationRepository.send).not.to.have.been.called()
        })
      })
    })

    describe('notifierNouvellesOffres', () => {
      it('notifie les jeunes avec pushNotificationToken', async () => {
        // Given
        const configuration = uneConfiguration({
          preferences: desPreferencesJeune()
        })
        const recherche = uneRecherche()
        const expectedNotification = uneNotification({
          token: configuration.pushNotificationToken,
          notification: {
            title: recherche.titre,
            body: 'De nouveaux résultats sont disponibles'
          },
          data: {
            type: Notification.Type.NOUVELLE_OFFRE,
            id: recherche.id
          }
        })

        // When
        await notificationService.notifierNouvellesOffres(
          recherche,
          configuration
        )

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          configuration.idJeune
        )
      })
      it('ne notifie pas les jeunes avec alertesOffres false', async () => {
        // Given
        const configuration = uneConfiguration({
          preferences: desPreferencesJeune({ alertesOffres: false })
        })
        const recherche = uneRecherche()

        // When
        await notificationService.notifierNouvellesOffres(
          recherche,
          configuration
        )

        // Then
        expect(notificationRepository.send).not.to.have.been.called()
      })
    })

    describe('notifierUnRendezVousPoleEmploi', () => {
      it('notifie un jeune', async () => {
        // Given
        const typeNotification = Notification.Type.NEW_RENDEZVOUS
        const token = 'poi-token'
        const message = 'Votre conseiller a programmé un nouveau rendez-vous'
        const idRendezVous = 'poi-id-rdv'

        // When
        notificationService.notifierUnRendezVousPoleEmploi(
          typeNotification,
          token,
          message,
          'test',
          idRendezVous
        )

        // Then
        const expectedNotification = uneNotification({
          token: token,
          notification: {
            title: 'Nouveau rendez-vous',
            body: 'Votre conseiller a programmé un nouveau rendez-vous'
          },
          data: {
            type: typeNotification,
            id: idRendezVous
          }
        })
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          'test'
        )
      })
    })

    describe('notifierInscriptionSession', () => {
      it('notifie les jeunes avec le jour de la session dans le fuseau du jeune, pas le jour UTC', async () => {
        // Given
        const jeune: Jeune = unJeune()
        const idSession = 'session-id'
        const expectedNotification = uneNotification({
          token: jeune.configuration?.pushNotificationToken,
          notification: {
            title: 'Nouvel atelier',
            body: 'Votre conseiller a programmé un nouvel atelier le 15/01 : étude des antilopes'
          },
          data: {
            type: Notification.Type.DETAIL_SESSION_MILO,
            id: idSession
          }
        })

        // When
        // session le 15/01 à 00h30 heure de Paris, soit le 14/01 23h30 en UTC
        await notificationService.notifierInscriptionSession(
          idSession,
          'étude des antilopes',
          resoudreDateMilo('2026-01-15 00:30:00', 'Europe/Paris').toUTC(),
          [jeune]
        )

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          jeune.id
        )
      })
    })

    describe('notifierAutoinscriptionSession', () => {
      it("notifie le jeune avec l'heure de la session dans le fuseau du jeune", async () => {
        // Given
        const jeune: Jeune = unJeune()
        const session = uneSessionMiloAllegee()

        // When
        // le début arrive en UTC (13h20Z) : affiché en heure de Paris, c'est 15h20
        await notificationService.notifierAutoinscriptionSession(
          { ...session, debut: session.debut.toUTC() },
          jeune
        )

        // Then
        const expectedNotification = uneNotification({
          token: jeune.configuration?.pushNotificationToken,
          notification: {
            title: 'Inscription confirmée',
            body: "Votre inscription à l'atelier Une session le 06/04/2020 à 15h20 a bien été prise en compte."
          },
          data: {
            type: Notification.Type.DETAIL_SESSION_MILO,
            id: 'id-session'
          }
        })
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          jeune.id
        )
      })
    })

    describe('notifierModificationSession', () => {
      it('notifie les jeunes avec pushNotificationToken', async () => {
        // Given
        const jeune: Jeune = unJeune()
        const idSession = 'session-id'
        const expectedNotification = uneNotification({
          token: jeune.configuration?.pushNotificationToken,
          notification: {
            title: 'Atelier modifié',
            body: 'Votre atelier du 14/07 a été modifié : foot de rue'
          },
          data: {
            type: Notification.Type.DETAIL_SESSION_MILO,
            id: idSession
          }
        })

        // When
        await notificationService.notifierModificationSession(
          idSession,
          'foot de rue',
          resoudreDateMilo('2026-07-14 18:30:00', 'Europe/Paris').toUTC(),
          [jeune]
        )

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          jeune.id
        )
      })
    })

    describe('notifierNouvelleActualite', () => {
      it('notifie les jeunes avec pushNotificationToken et préférence activée', async () => {
        // Given
        const jeune: Jeune = unJeune()
        const idActu = 'actu-id'
        const expectedNotification = uneNotification({
          token: jeune.configuration?.pushNotificationToken,
          notification: {
            title: 'Nouvelle actualité',
            body: 'Vous avez une nouvelle actualité'
          },
          data: {
            type: Notification.Type.NEW_ACTU,
            id: idActu
          }
        })

        // When
        await notificationService.notifierNouvelleActualite([jeune], idActu)

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          jeune.id,
          true
        )
      })

      it('notifie dans le centre uniquement si préférence désactivée', async () => {
        // Given
        const jeune: Jeune = unJeune({
          preferences: desPreferencesJeune({ actualitesMilo: false })
        })
        const idActu = 'actu-id'
        const expectedNotification = uneNotification({
          token: jeune.configuration?.pushNotificationToken,
          notification: {
            title: 'Nouvelle actualité',
            body: 'Vous avez une nouvelle actualité'
          },
          data: {
            type: Notification.Type.NEW_ACTU,
            id: idActu
          }
        })

        // When
        await notificationService.notifierNouvelleActualite([jeune], idActu)

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          jeune.id,
          false
        )
      })

      it('ne notifie pas les jeunes sans pushNotificationToken', async () => {
        // Given
        const jeune: Jeune = unJeune({
          configuration: {
            idJeune: 'ABCDE',
            pushNotificationToken: undefined,
            fuseauHoraire: 'Europe/Paris'
          }
        })
        const idActu = 'actu-id'

        // When
        await notificationService.notifierNouvelleActualite([jeune], idActu)

        // Then
        expect(notificationRepository.send).not.to.have.been.called()
      })
    })

    describe('notifierDesinscriptionSession', () => {
      it('notifie les jeunes avec pushNotificationToken', async () => {
        // Given
        const jeune: Jeune = unJeune()
        const idSession = 'session-id'
        const expectedNotification = uneNotification({
          token: jeune.configuration?.pushNotificationToken,
          notification: {
            title: 'Atelier supprimé',
            body: 'Votre atelier du 06/04 est supprimé : vacances à la plage'
          },
          data: {
            type: Notification.Type.DELETED_SESSION_MILO,
            id: idSession
          }
        })

        // When
        await notificationService.notifierDesinscriptionSession(
          idSession,
          'vacances à la plage',
          resoudreDateMilo('2020-04-06 13:20:00', 'Europe/Paris').toUTC(),
          [jeune]
        )

        // Then
        expect(notificationRepository.send).to.have.been.calledOnceWithExactly(
          expectedNotification,
          jeune.id
        )
      })
    })
  })
})
