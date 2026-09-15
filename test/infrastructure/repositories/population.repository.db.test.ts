import { Core } from '../../../src/domain/core'
import { Profil } from '../../../src/domain/profil'
import { PopulationSqlRepository } from '../../../src/infrastructure/repositories/population.repository.db'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
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

describe('PopulationSqlRepository', () => {
  let databaseForTesting: DatabaseForTesting
  let repo: PopulationSqlRepository

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    repo = new PopulationSqlRepository(databaseForTesting.sequelize)

    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: 'conseillerCite',
        structure: Core.Structure.MILO,
        email: 'cite@milo.fr'
      }),
      unConseillerDto({
        id: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI,
        email: 'ftcej@ft.fr'
      }),
      unConseillerDto({
        id: 'conseillerHors',
        structure: Core.Structure.MILO,
        email: 'hors@milo.fr'
      })
    ])
    // Le profil du jeune est le sien, pas celui de son conseiller : il est posé explicitement.
    await JeuneSqlModel.bulkCreate([
      unJeuneDto({
        id: 'jeuneCite',
        idConseiller: 'conseillerCite',
        structure: Core.Structure.MILO
      }),
      unJeuneDto({
        id: 'jeuneTransfere',
        idConseiller: 'conseillerHors',
        idConseillerInitial: 'conseillerCite',
        structure: Core.Structure.MILO
      }),
      unJeuneDto({
        id: 'jeuneFtCej',
        idConseiller: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneCejChezHors',
        idConseiller: 'conseillerHors',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneBrsaChezCej',
        idConseiller: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI_BRSA
      }),
      unJeuneDto({
        id: 'jeuneHors',
        idConseiller: 'conseillerHors',
        structure: Core.Structure.MILO
      })
    ])
    await PopulationSqlModel.create({ id: 'PILOTE', description: 'Pilote' })
    await PopulationConseillerSqlModel.create({
      idPopulation: 'PILOTE',
      emailConseiller: 'cite@milo.fr'
    })
    await PopulationProfilSqlModel.create({
      idPopulation: 'PILOTE',
      structure: Profil.Structure.FRANCE_TRAVAIL,
      dispositif: Profil.Dispositif.CEJ
    })
  })

  describe('existe', () => {
    it('reconnaît une population', async () => {
      expect(await repo.existe('PILOTE')).to.equal(true)
      expect(await repo.existe('INCONNUE')).to.equal(false)
    })
  })

  describe('getIdsDesBeneficiaires', () => {
    it('renvoie les jeunes des conseillers cités et ceux dont le propre profil correspond', async () => {
      // When
      const ids = await repo.getIdsDesBeneficiaires('PILOTE')

      // Then
      expect(ids).to.have.members([
        'jeuneCite',
        'jeuneTransfere',
        'jeuneFtCej',
        'jeuneCejChezHors'
      ])
    })

    it('renvoie une liste vide pour une population inconnue', async () => {
      expect(await repo.getIdsDesBeneficiaires('INCONNUE')).to.deep.equal([])
    })
  })
})
