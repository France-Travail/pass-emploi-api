import { DateTime } from 'luxon'
import { Communication } from '../../../src/domain/communication'
import { Core } from '../../../src/domain/core'
import { Profil } from '../../../src/domain/profil'
import { CommunicationSqlRepository } from '../../../src/infrastructure/repositories/communication.repository.db'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { PopulationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { expect } from '../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../utils/database-for-testing'

describe('CommunicationSqlRepository', () => {
  const maintenant = DateTime.fromISO('2026-10-01T12:00:00.000Z')
  const hier = maintenant.minus({ days: 1 }).toJSDate()
  const demain = maintenant.plus({ days: 1 }).toJSDate()
  const dansUneSemaine = maintenant.plus({ days: 7 }).toJSDate()

  let databaseForTesting: DatabaseForTesting
  let repo: CommunicationSqlRepository

  before(() => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    repo = new CommunicationSqlRepository(databaseForTesting.sequelize)

    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: 'conseillerCite',
        structure: Core.Structure.POLE_EMPLOI,
        dispositif: Profil.Dispositif.AIJ,
        email: 'cite@ft.fr'
      }),
      unConseillerDto({
        id: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI,
        email: 'ftcej@ft.fr'
      }),
      unConseillerDto({
        id: 'conseillerMilo',
        structure: Core.Structure.MILO,
        email: 'milo@milo.fr'
      })
    ])
    await PopulationSqlModel.bulkCreate([
      { id: 'PILOTE', description: null },
      { id: 'FT_CEJ', description: null }
    ])
    await PopulationConseillerSqlModel.bulkCreate([
      { idPopulation: 'PILOTE', emailConseiller: 'cite@ft.fr' }
    ])
    await PopulationProfilSqlModel.bulkCreate([
      {
        idPopulation: 'FT_CEJ',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.CEJ
      }
    ])
  })

  function uneCommunication(
    surcharge: Partial<{
      idPopulation: string
      destinataire: Communication.Destinataire
      type: Communication.Type
      dateDebut: Date
      dateFin: Date
      titre: string
      contenu: string
    }>
  ): {
    idPopulation: string
    destinataire: Communication.Destinataire
    type: Communication.Type
    dateDebut: Date
    dateFin: Date
    titre: string
    contenu: string
    ctaLabel: null
    ctaUrlAndroid: null
    ctaUrlIos: null
  } {
    return {
      idPopulation: 'PILOTE',
      destinataire: Communication.Destinataire.CONSEILLER,
      type: Communication.Type.IN_APP,
      dateDebut: hier,
      dateFin: demain,
      titre: 'Votre application évolue',
      contenu: 'Le 15 octobre 2026…',
      ctaLabel: null,
      ctaUrlAndroid: null,
      ctaUrlIos: null,
      ...surcharge
    }
  }

  describe('getMessageInformatifDuConseiller', () => {
    it('renvoie la communication du conseiller cité par email', async () => {
      // Given
      await CommunicationSqlModel.create(uneCommunication({}))

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).to.deep.include({
        titre: 'Votre application évolue',
        contenu: 'Le 15 octobre 2026…'
      })
      expect(message!.id).to.be.a('number')
    })

    it('renvoie la communication du conseiller dont le profil correspond', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunication({ idPopulation: 'FT_CEJ' })
      )

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerFtCej',
        maintenant
      )

      // Then
      expect(message).not.to.be.undefined()
    })

    it('ne renvoie rien au conseiller hors de la population', async () => {
      // Given
      await CommunicationSqlModel.create(uneCommunication({}))

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerMilo',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('ne renvoie rien avant la date de début', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunication({ dateDebut: demain, dateFin: dansUneSemaine })
      )

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('ne renvoie rien à partir de la date de fin', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunication({ dateDebut: hier, dateFin: maintenant.toJSDate() })
      )

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('renvoie la communication dès la date de début', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunication({ dateDebut: maintenant.toJSDate(), dateFin: demain })
      )

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).not.to.be.undefined()
    })

    it('ignore les communications destinées aux jeunes et les notifications', async () => {
      // Given
      await CommunicationSqlModel.bulkCreate([
        uneCommunication({ destinataire: Communication.Destinataire.JEUNE }),
        uneCommunication({ type: Communication.Type.NOTIFICATION })
      ])

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('renvoie la communication dont la fin est la plus proche quand plusieurs sont visibles', async () => {
      // Given
      await CommunicationSqlModel.bulkCreate([
        uneCommunication({ titre: 'Lointaine', dateFin: dansUneSemaine }),
        uneCommunication({ titre: 'Urgente', dateFin: demain })
      ])

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message!.titre).to.equal('Urgente')
    })
  })
})
