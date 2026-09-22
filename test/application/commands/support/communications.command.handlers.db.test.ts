import { DateTime } from 'luxon'
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
import { PopulationSqlRepository } from '../../../../src/infrastructure/repositories/population.repository.db'
import { CommunicationSqlModel } from '../../../../src/infrastructure/sequelize/models/communication.sql-model'
import { PopulationSqlModel } from '../../../../src/infrastructure/sequelize/models/population.sql-model'
import { expect } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

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
  })
})
