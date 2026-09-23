import { DateTime } from 'luxon'
import { AnnulerEnvoiCommunicationCommandHandler } from '../../../../src/application/commands/support/annuler-envoi-communication.command.handler.db'
import { CreerCommunicationCommandHandler } from '../../../../src/application/commands/support/creer-communication.command.handler.db'
import { ModifierCommunicationCommandHandler } from '../../../../src/application/commands/support/modifier-communication.command.handler.db'
import { SupprimerCommunicationCommandHandler } from '../../../../src/application/commands/support/supprimer-communication.command.handler.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import {
  isFailure,
  isSuccess
} from '../../../../src/building-blocks/types/result'
import { Communication } from '../../../../src/domain/communication'
import { CommunicationEnvoi } from '../../../../src/domain/communication-envoi'
import { Core } from '../../../../src/domain/core'
import { Notification } from '../../../../src/domain/notification/notification'
import { CommunicationSqlRepository } from '../../../../src/infrastructure/repositories/communication.repository.db'
import { PopulationSqlRepository } from '../../../../src/infrastructure/repositories/population.repository.db'
import { CommunicationEnvoiSqlModel } from '../../../../src/infrastructure/sequelize/models/communication-envoi.sql-model'
import { CommunicationSqlModel } from '../../../../src/infrastructure/sequelize/models/communication.sql-model'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationSqlModel } from '../../../../src/infrastructure/sequelize/models/population.sql-model'
import { DateService } from '../../../../src/utils/date-service'
import { uneDatetime } from '../../../fixtures/date.fixture'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../../fixtures/sql-models/jeune.sql-model'
import { expect, StubbedClass, stubClass } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

const maintenant = uneDatetime()

describe('Communications : handlers support', () => {
  const commande = {
    idPopulation: 'PHASE_C',
    destinataire: Communication.Destinataire.CONSEILLER,
    type: Communication.Type.IN_APP,
    dateDebut: DateTime.fromISO('2026-09-30T00:00:00.000Z'),
    dateFin: DateTime.fromISO('2026-10-15T00:00:00.000Z'),
    titre: 'Votre application évolue',
    contenu: 'Le 15 octobre 2026…'
  }

  let databaseForTesting: DatabaseForTesting

  before(() => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    await PopulationSqlModel.create({ id: 'PHASE_C', description: null })
  })

  describe('CreerCommunicationCommandHandler', () => {
    const handler = new CreerCommunicationCommandHandler(
      new PopulationSqlRepository(getDatabase().sequelize)
    )

    it('crée la communication et renvoie son id', async () => {
      // When
      const result = await handler.handle(commande)

      // Then
      expect(isSuccess(result)).to.equal(true)
      const communication = await CommunicationSqlModel.findOne()
      expect(communication!.idPopulation).to.equal('PHASE_C')
      expect(communication!.titre).to.equal('Votre application évolue')
      expect(communication!.ctaLabel).to.be.null()
      expect(communication!.statutEnvoi).to.be.null()
      if (isSuccess(result)) expect(result.data.id).to.equal(communication!.id)
    })

    it("refuse quand la population n'existe pas", async () => {
      // When
      const result = await handler.handle({
        ...commande,
        idPopulation: 'INCONNUE'
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(NonTrouveError)
      }
    })

    it('refuse quand la date de fin ne suit pas la date de début', async () => {
      // When
      const result = await handler.handle({
        ...commande,
        dateFin: commande.dateDebut
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
      expect(await CommunicationSqlModel.count()).to.equal(0)
    })

    it('crée une communication IN_APP sans date de fin', async () => {
      // When
      const result = await handler.handle({ ...commande, dateFin: undefined })

      // Then
      expect(isSuccess(result)).to.equal(true)
      const communication = await CommunicationSqlModel.findOne()
      expect(communication!.dateFin).to.be.null()
    })
  })

  describe('ModifierCommunicationCommandHandler', () => {
    const handler = new ModifierCommunicationCommandHandler(
      new PopulationSqlRepository(getDatabase().sequelize)
    )

    it('remplace la communication en entier', async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: commande.dateFin.toJSDate(),
        ctaLabel: 'Télécharger'
      })

      // When
      const result = await handler.handle({
        ...commande,
        id: communication.id,
        titre: 'Titre corrigé'
      })

      // Then
      expect(isSuccess(result)).to.equal(true)
      const communicationModifiee = await CommunicationSqlModel.findByPk(
        communication.id
      )
      expect(communicationModifiee!.titre).to.equal('Titre corrigé')
      expect(communicationModifiee!.contenu).to.equal(commande.contenu)
      expect(communicationModifiee!.idPopulation).to.equal('PHASE_C')
    })

    it('efface un CTA absent du nouveau payload', async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: commande.dateFin.toJSDate(),
        ctaLabel: 'Télécharger'
      })

      // When
      const result = await handler.handle({ ...commande, id: communication.id })

      // Then
      expect(isSuccess(result)).to.equal(true)
      const communicationModifiee = await CommunicationSqlModel.findByPk(
        communication.id
      )
      expect(communicationModifiee!.ctaLabel).to.equal(null)
    })

    it("refuse quand la communication n'existe pas", async () => {
      // When
      const result = await handler.handle({ ...commande, id: 999 })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(NonTrouveError)
      }
    })

    it('refuse quand la date de fin ne suit pas la date de début, sans rien modifier', async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: commande.dateFin.toJSDate()
      })

      // When
      const result = await handler.handle({
        ...commande,
        id: communication.id,
        titre: 'Titre corrigé',
        dateFin: commande.dateDebut
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
      const communicationInchangee = await CommunicationSqlModel.findByPk(
        communication.id
      )
      expect(communicationInchangee!.titre).to.equal(commande.titre)
    })

    it("refuse quand la nouvelle population n'existe pas", async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: commande.dateFin.toJSDate()
      })

      // When
      const result = await handler.handle({
        ...commande,
        id: communication.id,
        idPopulation: 'INCONNUE'
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(NonTrouveError)
      }
    })

    it("ne touche pas au statut d'envoi : le remplacement n'est pas un nouvel envoi", async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
        push: true,
        titre: 'Courte',
        contenu: 'Court',
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: null,
        statutEnvoi: Communication.StatutEnvoi.A_ENVOYER
      })

      // When
      const result = await handler.handle({
        ...commande,
        id: communication.id,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
        push: true,
        titre: 'Courte corrigée',
        contenu: 'Court',
        dateFin: undefined
      })

      // Then
      expect(isSuccess(result)).to.equal(true)
      const communicationModifiee = await CommunicationSqlModel.findByPk(
        communication.id
      )
      expect(communicationModifiee!.statutEnvoi).to.equal(
        Communication.StatutEnvoi.A_ENVOYER
      )
    })

    it("refuse de modifier une communication dont l'envoi a démarré", async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        push: true,
        titre: 'Courte',
        contenu: 'Court',
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: null,
        statutEnvoi: Communication.StatutEnvoi.EN_COURS
      })

      // When
      const result = await handler.handle({
        ...commande,
        id: communication.id,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        push: true,
        titre: 'Autre',
        contenu: 'Court',
        dateFin: undefined
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result))
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      expect(
        (await CommunicationSqlModel.findByPk(communication.id))!.titre
      ).to.equal('Courte')
    })
  })

  describe('CreerCommunicationCommandHandler : communication NOTIFICATION', () => {
    const handler = new CreerCommunicationCommandHandler(
      new PopulationSqlRepository(getDatabase().sequelize)
    )

    const commandeNotification = {
      ...commande,
      destinataire: Communication.Destinataire.JEUNE,
      type: Communication.Type.NOTIFICATION,
      typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
      push: true,
      titre: 'Courte',
      contenu: 'Court',
      dateFin: undefined
    }

    it('crée la communication avec son typeNotification, sans date de fin', async () => {
      // When
      const result = await handler.handle(commandeNotification)

      // Then
      expect(isSuccess(result)).to.equal(true)
      const communication = await CommunicationSqlModel.findOne()
      expect(communication!.typeNotification).to.equal(
        Notification.Type.MIGRATION_PARCOURS_EMPLOI
      )
      expect(communication!.dateFin).to.be.null()
      expect(communication!.statutEnvoi).to.equal(
        Communication.StatutEnvoi.A_ENVOYER
      )
    })

    it('crée une communication NOTIFICATION sans typeNotification', async () => {
      // When
      const result = await handler.handle({
        ...commandeNotification,
        typeNotification: undefined
      })

      // Then
      expect(isSuccess(result)).to.equal(true)
      const communication = await CommunicationSqlModel.findOne()
      expect(communication!.typeNotification).to.be.null()
    })

    it('refuse une communication NOTIFICATION sans push', async () => {
      // When
      const result = await handler.handle({
        ...commandeNotification,
        push: undefined
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })

    it('refuse une communication NOTIFICATION avec une date de fin', async () => {
      // When
      const result = await handler.handle({
        ...commandeNotification,
        dateFin: commande.dateFin
      })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      }
    })
  })

  describe('SupprimerCommunicationCommandHandler', () => {
    const handler = new SupprimerCommunicationCommandHandler()

    it('supprime la communication', async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: commande.dateFin.toJSDate()
      })

      // When
      const result = await handler.handle({ id: communication.id })

      // Then
      expect(isSuccess(result)).to.equal(true)
      expect(await CommunicationSqlModel.count()).to.equal(0)
    })

    it("renvoie une erreur quand la communication n'existe pas", async () => {
      // When
      const result = await handler.handle({ id: 999 })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result)) {
        expect(result.error).to.be.an.instanceOf(NonTrouveError)
      }
    })

    it("refuse de supprimer une communication dont l'envoi a démarré", async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        push: true,
        titre: 'Courte',
        contenu: 'Court',
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: null,
        statutEnvoi: Communication.StatutEnvoi.EN_COURS
      })

      // When
      const result = await handler.handle({ id: communication.id })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result))
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      expect(await CommunicationSqlModel.count()).to.equal(1)
    })
  })

  describe('AnnulerEnvoiCommunicationCommandHandler', () => {
    let dateService: StubbedClass<DateService>
    let handler: AnnulerEnvoiCommunicationCommandHandler

    beforeEach(async () => {
      dateService = stubClass(DateService)
      dateService.now.returns(maintenant)
      handler = new AnnulerEnvoiCommunicationCommandHandler(
        new CommunicationSqlRepository(getDatabase().sequelize),
        dateService
      )

      await ConseillerSqlModel.create(
        unConseillerDto({
          id: 'conseiller',
          structure: Core.Structure.POLE_EMPLOI
        })
      )
      await JeuneSqlModel.bulkCreate(
        ['jeune1', 'jeune2'].map(id =>
          unJeuneDto({ id, idConseiller: 'conseiller' })
        )
      )
    })

    it("annule l'envoi en cours et fige les totaux", async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        push: true,
        titre: 'Courte',
        contenu: 'Court',
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: null,
        statutEnvoi: Communication.StatutEnvoi.EN_COURS
      })
      await CommunicationEnvoiSqlModel.bulkCreate([
        {
          idCommunication: communication.id,
          idJeune: 'jeune1',
          statut: CommunicationEnvoi.Statut.ENVOYEE
        },
        {
          idCommunication: communication.id,
          idJeune: 'jeune2',
          statut: CommunicationEnvoi.Statut.A_ENVOYER
        }
      ])

      // When
      const result = await handler.handle({ id: communication.id })

      // Then
      expect(isSuccess(result)).to.equal(true)
      const annulee = (await CommunicationSqlModel.findByPk(communication.id))!
      expect(annulee.statutEnvoi).to.equal(Communication.StatutEnvoi.ANNULEE)
      expect(annulee.nbEnvoyees).to.equal(1)
      expect(annulee.envoiTermineLe).to.deep.equal(maintenant.toJSDate())
    })

    it("refuse une communication qui n'est pas EN_COURS", async () => {
      // Given
      const communication = await CommunicationSqlModel.create({
        ...commande,
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        push: true,
        titre: 'Courte',
        contenu: 'Court',
        dateDebut: commande.dateDebut.toJSDate(),
        dateFin: null,
        statutEnvoi: Communication.StatutEnvoi.A_ENVOYER
      })

      // When
      const result = await handler.handle({ id: communication.id })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result))
        expect(result.error).to.be.an.instanceOf(MauvaiseCommandeError)
      expect(
        (await CommunicationSqlModel.findByPk(communication.id))!.statutEnvoi
      ).to.equal(Communication.StatutEnvoi.A_ENVOYER)
    })

    it("renvoie NonTrouveError quand la communication n'existe pas", async () => {
      // When
      const result = await handler.handle({ id: 999 })

      // Then
      expect(isFailure(result)).to.equal(true)
      if (isFailure(result))
        expect(result.error).to.be.an.instanceOf(NonTrouveError)
    })
  })
})
