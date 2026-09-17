import { DateTime } from 'luxon'
import { before } from 'mocha'
import { GetFonctionnalitesSupportQueryHandler } from '../../../src/application/queries/get-fonctionnalites-support.query.handler.db'
import { GetPopulationsSupportQueryHandler } from '../../../src/application/queries/get-populations-support.query.handler.db'
import { success } from '../../../src/building-blocks/types/result'
import { Deploiement } from '../../../src/domain/deploiement'
import { Profil } from '../../../src/domain/profil'
import { DeploiementSqlModel } from '../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { PopulationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { expect } from '../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../utils/database-for-testing'

describe('Listes support : populations et fonctionnalités', () => {
  const dateActivation = DateTime.fromISO('2026-10-13T00:00:00.000Z')

  let databaseForTesting: DatabaseForTesting

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
  })

  describe('GetPopulationsSupportQueryHandler', () => {
    const handler = new GetPopulationsSupportQueryHandler()

    it('renvoie toutes les populations, chacune avec ses cibles et ses déploiements', async () => {
      // Given
      await FonctionnaliteSqlModel.create({ id: 'PLAN_D_ACTION' })
      await PopulationSqlModel.bulkCreate([
        { id: 'PILOTE_1J1S', description: 'Beta testeurs 1J1S' },
        { id: 'FT_CEJ', description: null }
      ])
      await PopulationConseillerSqlModel.bulkCreate([
        { idPopulation: 'PILOTE_1J1S', emailConseiller: 'b@ft.fr' },
        { idPopulation: 'PILOTE_1J1S', emailConseiller: 'a@ft.fr' }
      ])
      await PopulationProfilSqlModel.create({
        idPopulation: 'FT_CEJ',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.CEJ
      })
      const deploiement = await DeploiementSqlModel.create({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE_1J1S',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation: dateActivation.toJSDate()
      })

      // When
      const result = await handler.handle()

      // Then
      expect(result).to.deep.equal(
        success([
          {
            id: 'FT_CEJ',
            description: undefined,
            conseillers: [],
            profils: [
              {
                structure: Profil.Structure.FRANCE_TRAVAIL,
                dispositif: Profil.Dispositif.CEJ
              }
            ],
            structuresMilo: [],
            agencesFT: [],
            deploiements: []
          },
          {
            id: 'PILOTE_1J1S',
            description: 'Beta testeurs 1J1S',
            conseillers: ['a@ft.fr', 'b@ft.fr'],
            profils: [],
            structuresMilo: [],
            agencesFT: [],
            deploiements: [
              {
                id: deploiement.id,
                nature: Deploiement.Nature.FONCTIONNALITE,
                idFonctionnalite: 'PLAN_D_ACTION',
                dateActivation: '2026-10-13T00:00:00.000Z'
              }
            ]
          }
        ])
      )
    })

    it('renvoie une liste vide sans population', async () => {
      expect(await handler.handle()).to.deep.equal(success([]))
    })
  })

  describe('GetFonctionnalitesSupportQueryHandler', () => {
    const handler = new GetFonctionnalitesSupportQueryHandler()

    it('renvoie les ids du référentiel triés', async () => {
      // Given
      await FonctionnaliteSqlModel.bulkCreate([
        { id: 'PLAN_D_ACTION' },
        { id: 'DEMARCHES_IA' }
      ])

      // When
      const result = await handler.handle()

      // Then
      expect(result).to.deep.equal(
        success({ fonctionnalites: ['DEMARCHES_IA', 'PLAN_D_ACTION'] })
      )
    })
  })
})
