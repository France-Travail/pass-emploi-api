import { DateTime } from 'luxon'
import { Core } from '../../../src/domain/core'
import { Deploiement } from '../../../src/domain/deploiement'
import { Profil } from '../../../src/domain/profil'
import { MigrationSqlRepository } from '../../../src/infrastructure/repositories/migration.repository.db'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { DeploiementSqlModel } from '../../../src/infrastructure/sequelize/models/deploiement.sql-model'
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

const DATE_PHASE_A = DateTime.fromISO('2026-11-20T00:00:00.000Z')
const DATE_PHASE_B = DateTime.fromISO('2026-12-15T00:00:00.000Z')

describe('MigrationSqlRepository', () => {
  let databaseForTesting: DatabaseForTesting
  let repo: MigrationSqlRepository

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    repo = new MigrationSqlRepository(databaseForTesting.sequelize)

    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: 'conseillerPhaseA',
        structure: Core.Structure.POLE_EMPLOI,
        email: 'phasea@ft.fr'
      }),
      unConseillerDto({
        id: 'conseillerBrsa',
        structure: Core.Structure.POLE_EMPLOI_BRSA,
        email: 'brsa@ft.fr'
      }),
      unConseillerDto({
        id: 'conseillerHorsMigration',
        structure: Core.Structure.MILO,
        email: 'hors@milo.fr'
      })
    ])
    await JeuneSqlModel.bulkCreate([
      unJeuneDto({ id: 'jeunePhaseA', idConseiller: 'conseillerPhaseA' }),
      unJeuneDto({
        id: 'jeuneTransfere',
        idConseiller: 'conseillerHorsMigration',
        idConseillerInitial: 'conseillerPhaseA'
      }),
      unJeuneDto({
        id: 'jeuneBrsa',
        idConseiller: 'conseillerBrsa',
        structure: Core.Structure.POLE_EMPLOI_BRSA
      }),
      unJeuneDto({
        id: 'jeuneHorsMigration',
        idConseiller: 'conseillerHorsMigration'
      })
    ])
    await PopulationSqlModel.bulkCreate([
      { id: 'PHASE_A', description: null },
      { id: 'PHASE_B', description: null },
      { id: 'SANS_DEPLOIEMENT', description: null }
    ])
    await PopulationConseillerSqlModel.bulkCreate([
      { idPopulation: 'PHASE_A', emailConseiller: 'phasea@ft.fr' },
      { idPopulation: 'SANS_DEPLOIEMENT', emailConseiller: 'hors@milo.fr' }
    ])
    await PopulationProfilSqlModel.bulkCreate([
      {
        idPopulation: 'PHASE_B',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.BRSA
      }
    ])
    await DeploiementSqlModel.bulkCreate([
      {
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PHASE_A',
        idFonctionnalite: null,
        dateActivation: DATE_PHASE_A.toJSDate()
      },
      {
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PHASE_B',
        idFonctionnalite: null,
        dateActivation: DATE_PHASE_B.toJSDate()
      }
    ])
  })

  describe('populationConcerneeParUneMigration', () => {
    it('reconnaît une population visée par une migration', async () => {
      expect(await repo.populationConcerneeParUneMigration('PHASE_A')).to.equal(
        true
      )
    })

    it('ne reconnaît pas une population sans déploiement de migration', async () => {
      expect(
        await repo.populationConcerneeParUneMigration('SANS_DEPLOIEMENT')
      ).to.equal(false)
    })

    it('ne reconnaît pas un id inconnu', async () => {
      expect(
        await repo.populationConcerneeParUneMigration('INCONNUE')
      ).to.equal(false)
    })
  })

  describe('getBeneficiairesDeLaMigrationDuConseillerInitial', () => {
    it('renvoie les jeunes dont le conseiller de référence est cité', async () => {
      // When
      const beneficiaires =
        await repo.getBeneficiairesDeLaMigrationDuConseillerInitial('PHASE_A')

      // Then
      expect(beneficiaires).to.have.deep.members([
        { id: 'jeunePhaseA' },
        { id: 'jeuneTransfere' }
      ])
    })

    it('renvoie les jeunes dont le propre profil correspond', async () => {
      // When
      const beneficiaires =
        await repo.getBeneficiairesDeLaMigrationDuConseillerInitial('PHASE_B')

      // Then
      expect(beneficiaires).to.have.deep.members([{ id: 'jeuneBrsa' }])
    })
  })

  describe('getDateDeMigrationDuConseiller', () => {
    it('renvoie la date du déploiement de migration qui vise le conseiller', async () => {
      // When
      const date = await repo.getDateDeMigrationDuConseiller('conseillerPhaseA')

      // Then
      expect(date?.toISO()).to.equal(DATE_PHASE_A.toISO())
    })

    it('renvoie la date par profil', async () => {
      // When
      const date = await repo.getDateDeMigrationDuConseiller('conseillerBrsa')

      // Then
      expect(date?.toISO()).to.equal(DATE_PHASE_B.toISO())
    })

    it('ne renvoie rien quand aucune migration ne vise le conseiller', async () => {
      // When
      const date = await repo.getDateDeMigrationDuConseiller(
        'conseillerHorsMigration'
      )

      // Then
      expect(date).to.equal(undefined)
    })

    it('renvoie la date la plus proche quand plusieurs migrations visent le conseiller', async () => {
      // Given
      await PopulationConseillerSqlModel.create({
        idPopulation: 'PHASE_B',
        emailConseiller: 'phasea@ft.fr'
      })

      // When
      const date = await repo.getDateDeMigrationDuConseiller('conseillerPhaseA')

      // Then
      expect(date?.toISO()).to.equal(DATE_PHASE_A.toISO())
    })
  })

  describe('getDateDeMigrationDuConseillerDuBeneficiaire', () => {
    it('renvoie la date du conseiller du jeune', async () => {
      // When
      const date =
        await repo.getDateDeMigrationDuConseillerDuBeneficiaire('jeunePhaseA')

      // Then
      expect(date?.toISO()).to.equal(DATE_PHASE_A.toISO())
    })

    it('renvoie la date par le profil du jeune lui-même', async () => {
      // When
      const date =
        await repo.getDateDeMigrationDuConseillerDuBeneficiaire('jeuneBrsa')

      // Then
      expect(date?.toISO()).to.equal(DATE_PHASE_B.toISO())
    })

    it('renvoie la date du conseiller initial quand le jeune est transféré', async () => {
      // When
      const date =
        await repo.getDateDeMigrationDuConseillerDuBeneficiaire(
          'jeuneTransfere'
        )

      // Then
      expect(date?.toISO()).to.equal(DATE_PHASE_A.toISO())
    })

    it('ne renvoie rien quand le conseiller du jeune ne bascule pas', async () => {
      // When
      const date =
        await repo.getDateDeMigrationDuConseillerDuBeneficiaire(
          'jeuneHorsMigration'
        )

      // Then
      expect(date).to.equal(undefined)
    })
  })

  describe('rebasculerOrphelins', () => {
    beforeEach(async () => {
      await ConseillerSqlModel.create(
        unConseillerDto({
          id: 'autreConseillerPhaseA',
          email: 'autre-phasea@ft.fr'
        })
      )
      await PopulationConseillerSqlModel.create({
        idPopulation: 'PHASE_A',
        emailConseiller: 'autre-phasea@ft.fr'
      })
      // Orphelin : conseiller actuel dans PHASE_A, initial hors migration
      await JeuneSqlModel.create(
        unJeuneDto({
          id: 'jeuneOrphelin',
          idConseiller: 'conseillerPhaseA',
          idConseillerInitial: 'conseillerHorsMigration'
        })
      )
      // Non orphelin : les deux conseillers sont dans PHASE_A
      await JeuneSqlModel.create(
        unJeuneDto({
          id: 'jeuneNonOrphelin',
          idConseiller: 'conseillerPhaseA',
          idConseillerInitial: 'autreConseillerPhaseA'
        })
      )
    })

    it('rebascule uniquement les orphelins vers leur conseiller initial', async () => {
      // When
      const rebasculements = await repo.rebasculerOrphelins('PHASE_A')

      // Then
      expect(rebasculements).to.deep.equal([
        {
          idJeune: 'jeuneOrphelin',
          ancienIdConseiller: 'conseillerPhaseA',
          nouveauIdConseiller: 'conseillerHorsMigration'
        }
      ])
      const jeuneOrphelin = await JeuneSqlModel.findByPk('jeuneOrphelin')
      expect(jeuneOrphelin!.idConseiller).to.equal('conseillerHorsMigration')
      expect(jeuneOrphelin!.idConseillerInitial).to.be.null()
      const jeuneNonOrphelin = await JeuneSqlModel.findByPk('jeuneNonOrphelin')
      expect(jeuneNonOrphelin!.idConseiller).to.equal('conseillerPhaseA')
    })
  })
})
