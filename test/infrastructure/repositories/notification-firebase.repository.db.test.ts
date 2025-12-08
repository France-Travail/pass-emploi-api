import { FirebaseClient } from 'src/infrastructure/clients/firebase-client'
import { MatomoClient } from 'src/infrastructure/clients/matomo-client'
import {
  NotificationFirebaseSqlRepository,
  NotificationRepository,
  TypeNotificationRepository
} from 'src/infrastructure/repositories/notification-firebase.repository.db'
import { DateService } from 'src/utils/date-service'
import { IdService } from 'src/utils/id-service'
import { StubbedClass, stubClass } from '../../utils'
import { uneDatetime } from '../../fixtures/date.fixture'
import { expect } from 'chai'
import { getDatabase } from '../../utils/database-for-testing'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { Notification } from '../../../src/domain/notification/notification'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { NotificationJeuneSqlModel } from '../../../src/infrastructure/sequelize/models/notification-jeune.sql-model'

describe('NotificationFirebaseSqlRepository', () => {
  let repository: NotificationFirebaseSqlRepository
  let firebaseClient: StubbedClass<FirebaseClient>
  let matomoClient: StubbedClass<MatomoClient>
  let idService: StubbedClass<IdService>
  let dateService: StubbedClass<DateService>
  const maintenant = uneDatetime()
  const unId = 'uuid-123'

  beforeEach(async () => {
    await getDatabase().cleanPG()
    firebaseClient = stubClass(FirebaseClient)
    matomoClient = stubClass(MatomoClient)
    idService = stubClass(IdService)
    dateService = stubClass(DateService)
    idService.uuid.returns(unId)
    dateService.now.returns(maintenant)

    repository = new NotificationFirebaseSqlRepository(
      firebaseClient,
      matomoClient,
      idService,
      dateService
    )

    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: 'con1'
      })
    ])
    // Jeunes
    await JeuneSqlModel.bulkCreate([
      unJeuneDto({
        id: 'j1',
        idConseiller: 'con1',
        pushNotificationToken: 'push1'
      })
    ])
  })

  describe('send', () => {
    const message: Notification.Message = {
      token: 'push1',
      notification: {
        title: 'Titre',
        body: 'Description'
      },
      data: {
        type: Notification.Type.OUTILS
      }
    }

    it('persiste une notification en base quand idJeune est fourni', async () => {
      async function waitFor<T>(
        callback: () => Promise<T>,
        { timeout = 1000, interval = 50 } = {}
      ): Promise<T> {
        const start = Date.now()
        while (true) {
          try {
            return await callback()
          } catch (e) {
            if (Date.now() - start > timeout) throw e
            await new Promise(r => setTimeout(r, interval))
          }
        }
      }

      // When
      await repository.send(message, 'j1')

      // Then
      const notif = await waitFor(async () => {
        const notif = await NotificationJeuneSqlModel.findOne({
          where: { idJeune: 'j1' }
        })
        expect(notif).to.not.be.null()
        return notif
      })
      expect(notif!.id).to.equal(unId)
      expect(notif!.idJeune).to.equal('j1')
      expect(notif!.type).to.equal('OUTILS')
      expect(notif!.titre).to.equal('Titre')
      expect(notif!.description).to.equal('Description')
      expect(notif!.idObjet).to.be.null()
      expect(notif!.dateNotif).to.deep.equal(maintenant.toJSDate())
    })

    it("n'enregistre rien si idJeune n'est pas fourni", async () => {
      // When
      await repository.send(message)

      // Then
      expect(await NotificationJeuneSqlModel.findAll()).to.be.empty()
    })

    it('envoie aussi une notification push si pushNotification = true', async () => {
      // When
      await repository.send(message, 'j1', true)

      // Then
      expect(firebaseClient.send).to.have.been.calledOnceWithExactly(message)
      expect(
        matomoClient.trackEventPushNotificationEnvoyee
      ).to.have.been.calledOnceWithExactly(message)
    })

    it('envoie une notification push si pushNotification non fourni', async () => {
      // When
      await repository.send(message, 'j1')

      // Then
      expect(firebaseClient.send).to.have.been.calledOnceWithExactly(message)
      expect(
        matomoClient.trackEventPushNotificationEnvoyee
      ).to.have.been.calledOnceWithExactly(message)
    })

    it("n'envoie pas de notification push si pushNotification = false", async () => {
      // When
      await repository.send(message, 'j1', false)

      // Then
      expect(firebaseClient.send).not.to.have.been.called()
      expect(
        matomoClient.trackEventPushNotificationEnvoyee
      ).not.to.have.been.called()
    })

    describe('envoie le bon type de notification', () => {
      it('envoie un NEW_RENDEZVOUS pour un NEW_RENDEZVOUS', async () => {
        await repository.send(unMessagePush(Notification.Type.NEW_RENDEZVOUS))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.NEW_RENDEZVOUS)
        )
      })

      it('envoie un NEW_RENDEZVOUS pour un RAPPEL_RENDEZVOUS', async () => {
        await repository.send(
          unMessagePush(Notification.Type.RAPPEL_RENDEZVOUS)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.NEW_RENDEZVOUS)
        )
      })

      it('envoie un NEW_RENDEZVOUS pour un UPDATED_RENDEZVOUS', async () => {
        await repository.send(
          unMessagePush(Notification.Type.UPDATED_RENDEZVOUS)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.NEW_RENDEZVOUS)
        )
      })

      it('envoie un NEW_RENDEZVOUS pour un CANCELED_RENDEZVOUS', async () => {
        await repository.send(
          unMessagePush(Notification.Type.CANCELED_RENDEZVOUS)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.NEW_RENDEZVOUS)
        )
      })

      it('envoie un NEW_RENDEZVOUS pour un DELETED_RENDEZVOUS', async () => {
        await repository.send(
          unMessagePush(Notification.Type.DELETED_RENDEZVOUS)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.DELETED_RENDEZVOUS)
        )
      })
      it('envoie un NEW_ACTION pour un NEW_ACTION', async () => {
        await repository.send(unMessagePush(Notification.Type.NEW_ACTION))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.NEW_ACTION)
        )
      })

      it('envoie un NEW_MESSAGE pour un NEW_MESSAGE', async () => {
        await repository.send(unMessagePush(Notification.Type.NEW_MESSAGE))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.NEW_MESSAGE)
        )
      })

      it('envoie un NOUVELLE_OFFRE pour un NOUVELLE_OFFRE', async () => {
        await repository.send(unMessagePush(Notification.Type.NOUVELLE_OFFRE))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.NOUVELLE_OFFRE)
        )
      })

      it('envoie un DETAIL_ACTION pour un DETAIL_ACTION', async () => {
        await repository.send(unMessagePush(Notification.Type.DETAIL_ACTION))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.DETAIL_ACTION)
        )
      })

      it('envoie un DETAIL_SESSION_MILO pour un DETAIL_SESSION_MILO', async () => {
        await repository.send(
          unMessagePush(Notification.Type.DETAIL_SESSION_MILO)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.DETAIL_SESSION_MILO)
        )
      })

      it('envoie un DELETED_SESSION_MILO pour un DELETED_SESSION_MILO', async () => {
        await repository.send(
          unMessagePush(Notification.Type.DELETED_SESSION_MILO)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.DELETED_SESSION_MILO)
        )
      })

      it('envoie un RAPPEL_CREATION_ACTION pour un RAPPEL_CREATION_ACTION', async () => {
        await repository.send(
          unMessagePush(Notification.Type.RAPPEL_CREATION_ACTION)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.RAPPEL_CREATION_ACTION)
        )
      })

      it('envoie un RAPPEL_CREATION_DEMARCHE pour un RAPPEL_CREATION_DEMARCHE', async () => {
        await repository.send(
          unMessagePush(Notification.Type.RAPPEL_CREATION_DEMARCHE)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.RAPPEL_CREATION_DEMARCHE)
        )
      })

      it('envoie un OUTILS pour un OUTILS', async () => {
        await repository.send(unMessagePush(Notification.Type.OUTILS))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.OUTILS)
        )
      })

      it('envoie un SAVED_SEARCHES pour un SAVED_SEARCHES', async () => {
        await repository.send(unMessagePush(Notification.Type.SAVED_SEARCHES))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.SAVED_SEARCHES)
        )
      })

      it('envoie un OFFRES_ENREGISTREES pour un OFFRES_ENREGISTREES', async () => {
        await repository.send(
          unMessagePush(Notification.Type.OFFRES_ENREGISTREES)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.OFFRES_ENREGISTREES)
        )
      })

      it('envoie un RECHERCHE pour un RECHERCHE', async () => {
        await repository.send(unMessagePush(Notification.Type.RECHERCHE))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.RECHERCHE)
        )
      })

      it('envoie un ACTUALISATION_PE pour un ACTUALISATION_PE', async () => {
        await repository.send(unMessagePush(Notification.Type.ACTUALISATION_PE))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.ACTUALISATION_PE)
        )
      })

      it('envoie un MON_SUIVI pour un MON_SUIVI', async () => {
        await repository.send(unMessagePush(Notification.Type.MON_SUIVI))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.MON_SUIVI)
        )
      })

      it('envoie un EVENT_LIST pour un EVENT_LIST', async () => {
        await repository.send(unMessagePush(Notification.Type.EVENT_LIST))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.EVENT_LIST)
        )
      })

      it('envoie un LA_BONNE_ALTERNANCE pour un LA_BONNE_ALTERNANCE', async () => {
        await repository.send(
          unMessagePush(Notification.Type.LA_BONNE_ALTERNANCE)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.LA_BONNE_ALTERNANCE)
        )
      })

      it('envoie un BENEVOLAT pour un BENEVOLAT', async () => {
        await repository.send(unMessagePush(Notification.Type.BENEVOLAT))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.BENEVOLAT)
        )
      })

      it('envoie un CAMPAGNE pour un CAMPAGNE', async () => {
        await repository.send(unMessagePush(Notification.Type.CAMPAGNE))
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(TypeNotificationRepository.CAMPAGNE)
        )
      })

      it('envoie un NOUVELLES_FONCTIONNALITES pour un NOUVELLES_FONCTIONNALITES', async () => {
        await repository.send(
          unMessagePush(Notification.Type.NOUVELLES_FONCTIONNALITES)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(
            TypeNotificationRepository.NOUVELLES_FONCTIONNALITES
          )
        )
      })

      it('envoie un CENTRE_DE_NOTIFS_UNIQUEMENT pour un CENTRE_DE_NOTIFS_UNIQUEMENT', async () => {
        await repository.send(
          unMessagePush(Notification.Type.CENTRE_DE_NOTIFS_UNIQUEMENT)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(
            TypeNotificationRepository.CENTRE_DE_NOTIFS_UNIQUEMENT
          )
        )
      })

      it('envoie un MIGRATION_PARCOURS_EMPLOI pour un MIGRATION_PARCOURS_EMPLOI', async () => {
        await repository.send(
          unMessagePush(Notification.Type.MIGRATION_PARCOURS_EMPLOI)
        )
        expect(firebaseClient.send).to.have.been.calledOnceWithExactly(
          unMessageRepoPush(
            TypeNotificationRepository.MIGRATION_PARCOURS_EMPLOI
          )
        )
      })
    })
  })
})

const notifSansType = {
  token: 'push1',
  notification: {
    title: 'Titre',
    body: 'Description'
  },
  idJeune: 'j1',
  pushNotification: true
}
function unMessagePush(type: Notification.Type): Notification.Message {
  return {
    ...notifSansType,
    data: {
      type
    }
  }
}
function unMessageRepoPush(
  type: TypeNotificationRepository
): NotificationRepository {
  return {
    ...notifSansType,
    data: {
      type
    }
  }
}
