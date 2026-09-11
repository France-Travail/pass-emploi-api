import { DateTime } from 'luxon'
import { Core } from '../../../src/domain/core'
import { MigrationSqlRepository } from '../../../src/infrastructure/repositories/migration.repository.db'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { MigrationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/migration-conseiller.sql-model'
import { MigrationSqlModel } from '../../../src/infrastructure/sequelize/models/migration.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { expect } from '../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../utils/database-for-testing'

const DATE_DE_MIGRATION = DateTime.fromISO('2026-11-20T00:00:00.000Z')

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
        id: 'conseillerMigration',
        structure: Core.Structure.POLE_EMPLOI,
        email: 'conseillerMigration@email.com'
      }),
      unConseillerDto({
        id: 'conseillerNonMigration',
        email: 'conseillerNonMigration@email.com'
      }),
      unConseillerDto({
        id: 'conseillerSansDate',
        email: 'conseillerSansDate@email.com'
      })
    ])

    await JeuneSqlModel.bulkCreate([
      unJeuneDto({
        id: 'jeuneMigration',
        idConseiller: 'conseillerMigration',
        idConseillerInitial: undefined
      }),
      unJeuneDto({
        id: 'jeune-suivi-conseiller-migration',
        idConseiller: 'conseillerNonMigration',
        idConseillerInitial: 'conseillerMigration'
      }),
      unJeuneDto({
        id: 'jeuneNonMigration',
        idConseiller: 'conseillerNonMigration',
        idConseillerInitial: undefined
      }),
      unJeuneDto({
        id: 'jeuneSansDate',
        idConseiller: 'conseillerSansDate',
        idConseillerInitial: undefined
      })
    ])

    await MigrationSqlModel.bulkCreate([{ id: 'PHASE_A' }, { id: 'PHASE_B' }])

    await MigrationConseillerSqlModel.bulkCreate([
      {
        idMigration: 'PHASE_A',
        emailConseiller: 'conseillerMigration@email.com',
        dateMigration: DATE_DE_MIGRATION.toJSDate()
      },
      {
        idMigration: 'PHASE_B',
        emailConseiller: 'conseillerSansDate@email.com',
        dateMigration: null
      }
    ])
  })

  describe('existe', () => {
    it('reconnaît une vague enregistrée', async () => {
      // Then
      expect(await repo.existe('PHASE_A')).to.equal(true)
    })

    it('ne reconnaît pas un id inconnu', async () => {
      // Then
      expect(await repo.existe('PHASE_INCONNUE')).to.equal(false)
    })
  })

  describe('getBeneficiairesDeLaMigrationDuConseillerInitial', () => {
    it('renvoie les jeunes dont le conseiller de rattachement est dans la vague', async () => {
      // When
      const beneficiaires =
        await repo.getBeneficiairesDeLaMigrationDuConseillerInitial('PHASE_A')

      // Then
      expect(beneficiaires).to.have.deep.members([
        { id: 'jeuneMigration' },
        { id: 'jeune-suivi-conseiller-migration' }
      ])
    })
  })

  describe('getDateDeMigrationDuConseiller', () => {
    it('renvoie la date posée sur le conseiller', async () => {
      // When
      const date = await repo.getDateDeMigrationDuConseiller(
        'conseillerMigration'
      )

      // Then
      expect(date?.toISO()).to.equal(DATE_DE_MIGRATION.toISO())
    })

    it("ne renvoie rien quand le conseiller n'est dans aucune vague", async () => {
      // When
      const date = await repo.getDateDeMigrationDuConseiller(
        'conseillerNonMigration'
      )

      // Then
      expect(date).to.equal(undefined)
    })

    it('ne renvoie rien quand la vague est sans date', async () => {
      // When
      const date =
        await repo.getDateDeMigrationDuConseiller('conseillerSansDate')

      // Then
      expect(date).to.equal(undefined)
    })

    it('renvoie la date la plus proche quand le conseiller est dans plusieurs vagues', async () => {
      // Given
      const plusProche = DATE_DE_MIGRATION.minus({ days: 10 })
      await MigrationConseillerSqlModel.create({
        idMigration: 'PHASE_B',
        emailConseiller: 'conseillerMigration@email.com',
        dateMigration: plusProche.toJSDate()
      })

      // When
      const date = await repo.getDateDeMigrationDuConseiller(
        'conseillerMigration'
      )

      // Then
      expect(date?.toISO()).to.equal(plusProche.toISO())
    })
  })

  describe('getDateDeMigrationDuConseillerDuBeneficiaire', () => {
    it('renvoie la date du conseiller du jeune', async () => {
      // When
      const date =
        await repo.getDateDeMigrationDuConseillerDuBeneficiaire(
          'jeuneMigration'
        )

      // Then
      expect(date?.toISO()).to.equal(DATE_DE_MIGRATION.toISO())
    })

    it('renvoie la date du conseiller initial quand le jeune est transféré', async () => {
      // When
      const date = await repo.getDateDeMigrationDuConseillerDuBeneficiaire(
        'jeune-suivi-conseiller-migration'
      )

      // Then
      expect(date?.toISO()).to.equal(DATE_DE_MIGRATION.toISO())
    })

    it('ne renvoie rien quand le conseiller du jeune ne bascule pas', async () => {
      // When
      const date =
        await repo.getDateDeMigrationDuConseillerDuBeneficiaire(
          'jeuneNonMigration'
        )

      // Then
      expect(date).to.equal(undefined)
    })

    it('ne renvoie rien quand la vague du conseiller est sans date', async () => {
      // When
      const date =
        await repo.getDateDeMigrationDuConseillerDuBeneficiaire('jeuneSansDate')

      // Then
      expect(date).to.equal(undefined)
    })
  })

  describe('rebasculerOrphelins', () => {
    beforeEach(async () => {
      await ConseillerSqlModel.create(
        unConseillerDto({
          id: 'conseillerPhaseBMigrant',
          email: 'conseillerPhaseBMigrant@email.com'
        })
      )
      await MigrationConseillerSqlModel.create({
        idMigration: 'PHASE_B',
        emailConseiller: 'conseillerPhaseBMigrant@email.com',
        dateMigration: null
      })
      // Orphelin : conseiller actuel dans PHASE_B, initial non concerné
      await JeuneSqlModel.create(
        unJeuneDto({
          id: 'jeuneOrphelin',
          idConseiller: 'conseillerPhaseBMigrant',
          idConseillerInitial: 'conseillerNonMigration'
        })
      )
      // Non orphelin : les deux conseillers sont dans PHASE_B
      await ConseillerSqlModel.create(
        unConseillerDto({
          id: 'autreConseillerPhaseBMigrant',
          email: 'autreConseillerPhaseBMigrant@email.com'
        })
      )
      await MigrationConseillerSqlModel.create({
        idMigration: 'PHASE_B',
        emailConseiller: 'autreConseillerPhaseBMigrant@email.com',
        dateMigration: null
      })
      await JeuneSqlModel.create(
        unJeuneDto({
          id: 'jeuneNonOrphelin',
          idConseiller: 'conseillerPhaseBMigrant',
          idConseillerInitial: 'autreConseillerPhaseBMigrant'
        })
      )
    })

    it('rebascule uniquement les orphelins vers leur conseiller initial', async () => {
      // When
      const rebasculements = await repo.rebasculerOrphelins('PHASE_B')

      // Then
      expect(rebasculements).to.have.length(1)

      const jeuneOrphelin = await JeuneSqlModel.findByPk('jeuneOrphelin')
      expect(jeuneOrphelin!.idConseiller).to.equal('conseillerNonMigration')
      expect(jeuneOrphelin!.idConseillerInitial).to.be.null()

      const jeuneNonOrphelin = await JeuneSqlModel.findByPk('jeuneNonOrphelin')
      expect(jeuneNonOrphelin!.idConseiller).to.equal('conseillerPhaseBMigrant')
      expect(jeuneNonOrphelin!.idConseillerInitial).to.equal(
        'autreConseillerPhaseBMigrant'
      )
    })
  })
})
