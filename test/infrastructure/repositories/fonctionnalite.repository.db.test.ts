import { DateTime } from 'luxon'
import { Core } from '../../../src/domain/core'
import { Deploiement } from '../../../src/domain/deploiement'
import { Profil } from '../../../src/domain/profil'
import { FonctionnaliteSqlRepository } from '../../../src/infrastructure/repositories/fonctionnalite.repository.db'
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

describe('FonctionnaliteSqlRepository', () => {
  const maintenant = DateTime.fromISO('2026-09-14T12:00:00.000Z')
  const hier = maintenant.minus({ days: 1 }).toJSDate()
  const demain = maintenant.plus({ days: 1 }).toJSDate()

  let databaseForTesting: DatabaseForTesting
  let repo: FonctionnaliteSqlRepository

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    repo = new FonctionnaliteSqlRepository(databaseForTesting.sequelize)

    await ConseillerSqlModel.bulkCreate([
      // AIJ : cité par email, hors du profil FT × CEJ ciblé plus bas
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
        id: 'conseillerFtBrsa',
        structure: Core.Structure.POLE_EMPLOI_BRSA,
        email: 'ftbrsa@ft.fr'
      }),
      unConseillerDto({
        id: 'conseillerMilo',
        structure: Core.Structure.MILO,
        email: 'milo@milo.fr'
      })
    ])
    // Le profil du jeune est le sien, pas celui de son conseiller : il est posé explicitement.
    await JeuneSqlModel.bulkCreate([
      unJeuneDto({
        id: 'jeuneCite',
        idConseiller: 'conseillerCite',
        structure: Core.Structure.POLE_EMPLOI_AIJ
      }),
      unJeuneDto({
        id: 'jeuneTransfere',
        idConseiller: 'conseillerMilo',
        idConseillerInitial: 'conseillerCite',
        structure: Core.Structure.POLE_EMPLOI_AIJ
      }),
      unJeuneDto({
        id: 'jeuneFtCej',
        idConseiller: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneFtBrsa',
        idConseiller: 'conseillerFtBrsa',
        structure: Core.Structure.POLE_EMPLOI_BRSA
      }),
      unJeuneDto({
        id: 'jeuneBrsaChezCej',
        idConseiller: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI_BRSA
      }),
      unJeuneDto({
        id: 'jeuneMilo',
        idConseiller: 'conseillerMilo',
        structure: Core.Structure.MILO
      }),
      unJeuneDto({
        id: 'jeuneMiloPacea',
        idConseiller: 'conseillerMilo',
        structure: Core.Structure.MILO,
        dispositif: Profil.Dispositif.PACEA
      })
    ])
    await FonctionnaliteSqlModel.bulkCreate([
      { id: 'PLAN_D_ACTION' },
      { id: 'QCM' },
      { id: 'FT_IA' }
    ])
    await PopulationSqlModel.bulkCreate([
      { id: 'PILOTE', description: null },
      { id: 'FT_CEJ', description: null },
      { id: 'MILO_TOUS', description: null }
    ])
    await PopulationConseillerSqlModel.bulkCreate([
      { idPopulation: 'PILOTE', emailConseiller: 'cite@ft.fr' }
    ])
    await PopulationProfilSqlModel.bulkCreate([
      {
        idPopulation: 'FT_CEJ',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.CEJ
      },
      {
        idPopulation: 'MILO_TOUS',
        structure: Profil.Structure.MILO,
        dispositif: null
      }
    ])
    await DeploiementSqlModel.bulkCreate([
      {
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation: hier
      },
      {
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'QCM',
        dateActivation: demain
      },
      {
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'FT_CEJ',
        idFonctionnalite: 'FT_IA',
        dateActivation: hier
      },
      {
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'MILO_TOUS',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation: hier
      }
    ])
  })

  describe('getIdsFonctionnalitesActivesDuJeune', () => {
    it('active une fonctionnalité déployée sur une population qui cite le conseiller', async () => {
      // When
      const ids = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneCite',
        maintenant
      )

      // Then
      expect(ids).to.deep.equal(['PLAN_D_ACTION'])
    })

    it("n'active pas une fonctionnalité dont la date n'est pas atteinte", async () => {
      // When
      const ids = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneCite',
        maintenant.plus({ days: 2 })
      )

      // Then
      expect(ids).to.deep.equal(['PLAN_D_ACTION', 'QCM'])
    })

    it('suit le conseiller initial quand le jeune est transféré', async () => {
      // When
      const ids = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneTransfere',
        maintenant
      )

      // Then
      expect(ids).to.deep.equal(['PLAN_D_ACTION'])
    })

    it('active par le profil structure et dispositif du jeune lui-même', async () => {
      // When
      const ids = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneFtCej',
        maintenant
      )

      // Then
      expect(ids).to.deep.equal(['FT_IA'])
    })

    it("n'active pas quand le dispositif du jeune diffère", async () => {
      // When
      const ids = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneFtBrsa',
        maintenant
      )

      // Then
      expect(ids).to.deep.equal([])
    })

    it("ne regarde pas le profil du conseiller : un jeune BRSA chez un conseiller CEJ n'est pas ciblé", async () => {
      // When
      const ids = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneBrsaChezCej',
        maintenant
      )

      // Then
      expect(ids).to.deep.equal([])
    })

    it('cible un dispositif MiLo directement sur le jeune, sans passer par un conseiller sans dispositif', async () => {
      // Given
      await PopulationSqlModel.create({ id: 'MILO_PACEA', description: null })
      await PopulationProfilSqlModel.create({
        idPopulation: 'MILO_PACEA',
        structure: Profil.Structure.MILO,
        dispositif: Profil.Dispositif.PACEA
      })
      await DeploiementSqlModel.create({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'MILO_PACEA',
        idFonctionnalite: 'QCM',
        dateActivation: hier
      })

      // When
      const pacea = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneMiloPacea',
        maintenant
      )
      const cej = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneMilo',
        maintenant
      )

      // Then
      expect(pacea).to.deep.equal(['PLAN_D_ACTION', 'QCM'])
      expect(cej).to.deep.equal(['PLAN_D_ACTION'])
    })

    it('un profil sans dispositif couvre toute la structure', async () => {
      // When
      const ids = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneMilo',
        maintenant
      )

      // Then
      expect(ids).to.deep.equal(['PLAN_D_ACTION'])
    })

    it('un profil FRANCE_TRAVAIL sans dispositif couvre tous les dispositifs FT', async () => {
      // Given
      await PopulationSqlModel.create({ id: 'FT_TOUS', description: null })
      await PopulationProfilSqlModel.create({
        idPopulation: 'FT_TOUS',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: null
      })
      await DeploiementSqlModel.create({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'FT_TOUS',
        idFonctionnalite: 'QCM',
        dateActivation: hier
      })

      // When
      const brsa = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneFtBrsa',
        maintenant
      )
      const cej = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneFtCej',
        maintenant
      )
      const milo = await repo.getIdsFonctionnalitesActivesDuJeune(
        'jeuneMilo',
        maintenant
      )

      // Then
      expect(brsa).to.deep.equal(['QCM'])
      expect(cej).to.deep.equal(['FT_IA', 'QCM'])
      expect(milo).to.deep.equal(['PLAN_D_ACTION'])
    })

    it("renvoie une liste vide quand l'id jeune n'existe pas", async () => {
      // When
      const ids = await repo.getIdsFonctionnalitesActivesDuJeune(
        'id-inexistant',
        maintenant
      )

      // Then
      expect(ids).to.deep.equal([])
    })
  })
})
