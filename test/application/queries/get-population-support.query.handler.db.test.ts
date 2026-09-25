import { DateTime } from 'luxon'
import { before } from 'mocha'
import { GetPopulationSupportQueryHandler } from '../../../src/application/queries/get-population-support.query.handler.db'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import {
  failure,
  isSuccess,
  success
} from '../../../src/building-blocks/types/result'
import { Communication } from '../../../src/domain/communication'
import { CommunicationEnvoi } from '../../../src/domain/communication-envoi'
import { Core } from '../../../src/domain/core'
import { Deploiement } from '../../../src/domain/deploiement'
import { Notification } from '../../../src/domain/notification/notification'
import { Profil } from '../../../src/domain/profil'
import { CommunicationSqlRepository } from '../../../src/infrastructure/repositories/communication.repository.db'
import { CommunicationEnvoiSqlModel } from '../../../src/infrastructure/sequelize/models/communication-envoi.sql-model'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { DeploiementSqlModel } from '../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { expect } from '../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../utils/database-for-testing'

describe('GetPopulationSupportQueryHandler', () => {
  const dateActivation = DateTime.fromISO('2026-10-13T00:00:00.000Z')

  let databaseForTesting: DatabaseForTesting
  let handler: GetPopulationSupportQueryHandler

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    handler = new GetPopulationSupportQueryHandler(
      new CommunicationSqlRepository(databaseForTesting.sequelize)
    )
  })

  it('renvoie la population avec ses cibles et ses déploiements', async () => {
    // Given
    await PopulationSqlModel.create({
      id: 'PILOTE_1J1S',
      description: 'Beta testeurs 1J1S'
    })
    await PopulationConseillerSqlModel.bulkCreate([
      { idPopulation: 'PILOTE_1J1S', emailConseiller: 'b@ft.fr' },
      { idPopulation: 'PILOTE_1J1S', emailConseiller: 'a@ft.fr' }
    ])
    await PopulationProfilSqlModel.create({
      idPopulation: 'PILOTE_1J1S',
      structure: Profil.Structure.MILO,
      dispositif: null
    })
    await FonctionnaliteSqlModel.create({ id: 'PLAN_D_ACTION' })
    const deploiement = await DeploiementSqlModel.create({
      nature: Deploiement.Nature.FONCTIONNALITE,
      idPopulation: 'PILOTE_1J1S',
      idFonctionnalite: 'PLAN_D_ACTION',
      dateActivation: dateActivation.toJSDate()
    })
    const communication = await CommunicationSqlModel.create({
      idPopulation: 'PILOTE_1J1S',
      destinataire: Communication.Destinataire.CONSEILLER,
      type: Communication.Type.IN_APP,
      dateDebut: DateTime.fromISO('2026-09-30T00:00:00.000Z').toJSDate(),
      dateFin: DateTime.fromISO('2026-10-15T00:00:00.000Z').toJSDate(),
      titre: 'Votre application évolue',
      contenu: 'Le 15 octobre 2026…'
    })

    // When
    const result = await handler.handle({ idPopulation: 'PILOTE_1J1S' })

    // Then
    expect(result).to.deep.equal(
      success({
        id: 'PILOTE_1J1S',
        description: 'Beta testeurs 1J1S',
        conseillers: ['a@ft.fr', 'b@ft.fr'],
        profils: [{ structure: Profil.Structure.MILO, dispositif: undefined }],
        deploiements: [
          {
            id: deploiement.id,
            nature: Deploiement.Nature.FONCTIONNALITE,
            idFonctionnalite: 'PLAN_D_ACTION',
            dateActivation: '2026-10-13T00:00:00.000Z'
          }
        ],
        communications: [
          {
            id: communication.id,
            destinataire: Communication.Destinataire.CONSEILLER,
            type: Communication.Type.IN_APP,
            dateDebut: '2026-09-30T00:00:00.000Z',
            dateFin: '2026-10-15T00:00:00.000Z',
            titre: 'Votre application évolue',
            contenu: 'Le 15 octobre 2026…',
            ctaLabel: undefined,
            ctaUrlAndroid: undefined,
            ctaUrlIos: undefined,
            typeNotification: undefined,
            push: undefined,
            statutEnvoi: undefined,
            envoiTermineLe: undefined
          }
        ]
      })
    )
  })

  it('renvoie typeNotification et push pour une communication NOTIFICATION, sans dateFin', async () => {
    // Given
    await PopulationSqlModel.create({ id: 'PHASE_C', description: null })
    const communication = await CommunicationSqlModel.create({
      idPopulation: 'PHASE_C',
      destinataire: Communication.Destinataire.JEUNE,
      type: Communication.Type.NOTIFICATION,
      typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
      push: true,
      statutEnvoi: Communication.StatutEnvoi.A_ENVOYER,
      dateDebut: DateTime.fromISO('2026-09-30T00:00:00.000Z').toJSDate(),
      dateFin: null,
      titre: 'Courte',
      contenu: 'Court'
    })

    // When
    const result = await handler.handle({ idPopulation: 'PHASE_C' })

    // Then
    expect(result).to.deep.equal(
      success({
        id: 'PHASE_C',
        description: undefined,
        conseillers: [],
        profils: [],
        deploiements: [],
        communications: [
          {
            id: communication.id,
            destinataire: Communication.Destinataire.JEUNE,
            type: Communication.Type.NOTIFICATION,
            dateDebut: '2026-09-30T00:00:00.000Z',
            dateFin: undefined,
            titre: 'Courte',
            contenu: 'Court',
            ctaLabel: undefined,
            ctaUrlAndroid: undefined,
            ctaUrlIos: undefined,
            typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
            push: true,
            statutEnvoi: Communication.StatutEnvoi.A_ENVOYER,
            envoiTermineLe: undefined,
            nbDestinataires: 0
          }
        ]
      })
    )
  })

  it("échoue quand la population n'existe pas", async () => {
    // When
    const result = await handler.handle({ idPopulation: 'INCONNUE' })

    // Then
    expect(result).to.deep.equal(
      failure(new NonTrouveError('Population', 'INCONNUE'))
    )
  })

  describe('suivi de l’envoi', () => {
    beforeEach(async () => {
      await PopulationSqlModel.create({
        id: 'PHASE_C',
        description: null
      })
      await ConseillerSqlModel.create(
        unConseillerDto({
          id: 'conseiller',
          structure: Core.Structure.MILO,
          email: 'conseiller@milo.fr'
        })
      )
      await PopulationProfilSqlModel.create({
        idPopulation: 'PHASE_C',
        structure: Profil.Structure.MILO,
        dispositif: null
      })
    })

    it('expose nbDestinataires pour une NOTIFICATION à envoyer', async () => {
      // Given : un jeune avec token dans la population, un sans
      await JeuneSqlModel.bulkCreate([
        unJeuneDto({
          id: 'jeuneAvecToken',
          idConseiller: 'conseiller',
          structure: Core.Structure.MILO,
          pushNotificationToken: 'token'
        }),
        unJeuneDto({
          id: 'jeuneSansToken',
          idConseiller: 'conseiller',
          structure: Core.Structure.MILO,
          pushNotificationToken: null
        })
      ])
      await CommunicationSqlModel.create({
        idPopulation: 'PHASE_C',
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
        push: true,
        statutEnvoi: Communication.StatutEnvoi.A_ENVOYER,
        dateDebut: DateTime.fromISO('2026-09-30T00:00:00.000Z').toJSDate(),
        dateFin: null,
        titre: 'Courte',
        contenu: 'Court'
      })

      // When
      const result = await handler.handle({ idPopulation: 'PHASE_C' })

      // Then
      if (!isSuccess(result)) throw new Error('devrait réussir')
      const model = result.data
      expect(model.communications[0].statutEnvoi).to.equal(
        Communication.StatutEnvoi.A_ENVOYER
      )
      expect(model.communications[0].nbDestinataires).to.equal(1)
      expect(model.communications[0].envoi).to.equal(undefined)
    })

    it("expose les compteurs vivants d'une NOTIFICATION en cours", async () => {
      // Given : EN_COURS + 2 lignes communication_envoi (ENVOYEE, A_ENVOYER)
      await JeuneSqlModel.bulkCreate([
        unJeuneDto({
          id: 'jeune1',
          idConseiller: 'conseiller',
          structure: Core.Structure.MILO
        }),
        unJeuneDto({
          id: 'jeune2',
          idConseiller: 'conseiller',
          structure: Core.Structure.MILO
        })
      ])
      const communication = await CommunicationSqlModel.create({
        idPopulation: 'PHASE_C',
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
        push: true,
        statutEnvoi: Communication.StatutEnvoi.EN_COURS,
        dateDebut: DateTime.fromISO('2026-09-30T00:00:00.000Z').toJSDate(),
        dateFin: null,
        titre: 'Courte',
        contenu: 'Court'
      })
      await CommunicationEnvoiSqlModel.bulkCreate([
        {
          idCommunication: communication.id,
          idJeune: 'jeune1',
          statut: CommunicationEnvoi.Statut.ENVOYEE,
          dateTraitement: DateTime.fromISO(
            '2026-10-01T09:00:00.000Z'
          ).toJSDate()
        },
        {
          idCommunication: communication.id,
          idJeune: 'jeune2',
          statut: CommunicationEnvoi.Statut.A_ENVOYER,
          dateTraitement: null
        }
      ])

      // When
      const result = await handler.handle({ idPopulation: 'PHASE_C' })

      // Then
      if (!isSuccess(result)) throw new Error('devrait réussir')
      const model = result.data
      expect(model.communications[0].envoi).to.deep.equal({
        aEnvoyer: 1,
        enCours: 0,
        envoyees: 1,
        erreurs: 0,
        tokensInvalides: 0
      })
      expect(model.communications[0].nbDestinataires).to.equal(undefined)
    })

    it("expose les totaux figés d'une NOTIFICATION terminée", async () => {
      // Given : ENVOYEE, envoiTermineLe, nbEnvoyees 3, nbErreurs 1, nbTokensInvalides 0, aucune ligne détail (purgée)
      const communication = await CommunicationSqlModel.create({
        idPopulation: 'PHASE_C',
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        typeNotification: Notification.Type.MIGRATION_PARCOURS_EMPLOI,
        push: true,
        statutEnvoi: Communication.StatutEnvoi.ENVOYEE,
        envoiTermineLe: DateTime.fromISO('2026-10-01T09:54:00.000Z').toJSDate(),
        nbEnvoyees: 3,
        nbErreurs: 1,
        nbTokensInvalides: 0,
        dateDebut: DateTime.fromISO('2026-09-30T00:00:00.000Z').toJSDate(),
        dateFin: null,
        titre: 'Courte',
        contenu: 'Court'
      })

      // When
      const result = await handler.handle({ idPopulation: 'PHASE_C' })

      // Then
      if (!isSuccess(result)) throw new Error('devrait réussir')
      const model = result.data
      expect(communication.id).to.be.a('number')
      expect(model.communications[0].envoiTermineLe).to.equal(
        '2026-10-01T09:54:00.000Z'
      )
      expect(model.communications[0].envoi).to.deep.equal({
        envoyees: 3,
        erreurs: 1,
        tokensInvalides: 0
      })
    })

    it("n'expose rien de l'envoi pour une IN_APP", async () => {
      // Given
      await CommunicationSqlModel.create({
        idPopulation: 'PHASE_C',
        destinataire: Communication.Destinataire.CONSEILLER,
        type: Communication.Type.IN_APP,
        dateDebut: DateTime.fromISO('2026-09-30T00:00:00.000Z').toJSDate(),
        dateFin: DateTime.fromISO('2026-10-15T00:00:00.000Z').toJSDate(),
        titre: 'Votre application évolue',
        contenu: 'Le 15 octobre 2026…'
      })

      // When
      const result = await handler.handle({ idPopulation: 'PHASE_C' })

      // Then
      if (!isSuccess(result)) throw new Error('devrait réussir')
      const model = result.data
      expect(model.communications[0].statutEnvoi).to.equal(undefined)
      expect(model.communications[0].envoiTermineLe).to.equal(undefined)
      expect(model.communications[0].nbDestinataires).to.equal(undefined)
      expect(model.communications[0].envoi).to.equal(undefined)
    })
  })
})
