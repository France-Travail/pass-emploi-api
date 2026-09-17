import { DateTime } from 'luxon'
import { before } from 'mocha'
import { GetPopulationSupportQueryHandler } from '../../../src/application/queries/get-population-support.query.handler.db'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { Communication } from '../../../src/domain/communication'
import { Deploiement } from '../../../src/domain/deploiement'
import { Profil } from '../../../src/domain/profil'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { DeploiementSqlModel } from '../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { PopulationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { AgenceSqlModel } from '../../../src/infrastructure/sequelize/models/agence.sql-model'
import { PopulationAgenceFTSqlModel } from '../../../src/infrastructure/sequelize/models/population-agence-ft.sql-model'
import { uneAgenceDto } from '../../fixtures/sql-models/agence.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
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
    handler = new GetPopulationSupportQueryHandler()
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
    await AgenceSqlModel.create(uneAgenceDto({ id: 'AG1' }))
    await PopulationAgenceFTSqlModel.create({
      idPopulation: 'PILOTE_1J1S',
      idAgence: 'AG1'
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
        structuresMilo: [],
        agencesFT: ['AG1'],
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
            ctaUrlIos: undefined
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
})
