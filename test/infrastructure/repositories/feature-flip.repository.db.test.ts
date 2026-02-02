import { FeatureFlipSqlRepository } from '../../../src/infrastructure/repositories/feature-flip.repository.db'
import { FeatureFlip } from '../../../src/domain/feature-flip'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { FeatureFlipSqlModel } from '../../../src/infrastructure/sequelize/models/feature-flip.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { expect } from '../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../utils/database-for-testing'
import { Core } from '../../../src/domain/core'

describe('FeatureFlipSqlRepository', () => {
  let databaseForTesting: DatabaseForTesting
  let repo: FeatureFlipSqlRepository

  before(async () => {
    databaseForTesting = getDatabase()
    await databaseForTesting.cleanPG()
    repo = new FeatureFlipSqlRepository(databaseForTesting.sequelize)

    const conseillerMigrationDto = unConseillerDto({
      id: 'conseillerMigration',
      structure: Core.Structure.POLE_EMPLOI,
      email: 'conseillerMigration@email.com'
    })
    const conseillerNonMigrationDto = unConseillerDto({
      id: 'conseillerNonMigration',
      email: 'conseillerNonMigration@email.com'
    })

    const jeuneConseillerMigrationDto = unJeuneDto({
      id: 'jeuneMigration',
      idConseiller: 'conseillerMigration',
      idConseillerInitial: undefined
    })
    const jeuneSuiviConseillerMigrationDto = unJeuneDto({
      id: 'jeune-suivi-conseiller-migration',
      idConseiller: 'conseillerNonMigration',
      idConseillerInitial: 'conseillerMigration'
    })
    const jeuneConseillerNonMigrationDto = unJeuneDto({
      id: 'jeuneNonMigration',
      idConseiller: 'conseillerNonMigration',
      idConseillerInitial: undefined
    })

    await ConseillerSqlModel.bulkCreate([
      conseillerMigrationDto,
      conseillerNonMigrationDto
    ])
    await JeuneSqlModel.bulkCreate([
      jeuneConseillerMigrationDto,
      jeuneSuiviConseillerMigrationDto,
      jeuneConseillerNonMigrationDto
    ])

    const ffMigration = {
      featureTag: FeatureFlip.Tag.MIGRATION_PHASE_A,
      emailConseiller: 'conseillerMigration@email.com'
    }
    const ffDemarchesIA = {
      featureTag: FeatureFlip.Tag.DEMARCHES_IA,
      emailConseiller: 'conseillerNonMigration@email.com'
    }
    await FeatureFlipSqlModel.bulkCreate([ffMigration, ffDemarchesIA])
  })

  describe('getTagSiFeatureActivePourLeConseillerDuJeune', () => {
    it('renvoie le bénéficiaire si son conseiller a la feature demandée', async () => {
      const beneficiaire =
        await repo.getTagSiFeatureActivePourLeConseillerDuJeune(
          [
            FeatureFlip.Tag.MIGRATION_PHASE_A,
            FeatureFlip.Tag.MIGRATION_PHASE_B
          ],
          'jeuneMigration'
        )
      expect(beneficiaire).to.deep.equal(FeatureFlip.Tag.MIGRATION_PHASE_A)
    })

    it('renvoie le bénéficiaire si son conseiller initial a la feature demandée', async () => {
      const beneficiaire =
        await repo.getTagSiFeatureActivePourLeConseillerDuJeune(
          [
            FeatureFlip.Tag.MIGRATION_PHASE_A,
            FeatureFlip.Tag.MIGRATION_PHASE_B
          ],
          'jeune-suivi-conseiller-migration'
        )
      expect(beneficiaire).to.deep.equal(FeatureFlip.Tag.MIGRATION_PHASE_A)
    })

    it("ne renvoie rien si ni son conseiller, ni son conseiller initial n'ont la feature demandée", async () => {
      const beneficiaire =
        await repo.getTagSiFeatureActivePourLeConseillerDuJeune(
          [FeatureFlip.Tag.DEMARCHES_IA],
          'jeuneMigration'
        )
      expect(beneficiaire).to.be.undefined()
    })

    it("ne renvoie rien si l'id jeune n'existe pas", async () => {
      const beneficiaire =
        await repo.getTagSiFeatureActivePourLeConseillerDuJeune(
          [
            FeatureFlip.Tag.MIGRATION_PHASE_A,
            FeatureFlip.Tag.MIGRATION_PHASE_B
          ],
          'id-inexistant'
        )
      expect(beneficiaire).to.be.undefined()
    })
  })

  describe('getTagSiFeatureActivePourLeConseiller', () => {
    it("renvoie le conseiller si l'email du conseiller est autorisée pour la feature", async () => {
      const conseiller = await repo.getTagSiFeatureActivePourLeConseiller(
        [FeatureFlip.Tag.MIGRATION_PHASE_A, FeatureFlip.Tag.MIGRATION_PHASE_B],
        'conseillerMigration'
      )
      expect(conseiller).to.deep.equal(FeatureFlip.Tag.MIGRATION_PHASE_A)
    })

    it("ne renvoie rien si le conseiller n'est pas autorisé pour cette feature", async () => {
      const conseiller = await repo.getTagSiFeatureActivePourLeConseiller(
        [FeatureFlip.Tag.MIGRATION_PHASE_A, FeatureFlip.Tag.MIGRATION_PHASE_B],
        'conseillerNonMigration'
      )
      expect(conseiller).to.be.undefined()
    })
  })

  describe('getBeneficiairesDeLaFeature', () => {
    it('renvoie la liste des ids des jeunes des conseillers de rattachement avec le tag migration', async () => {
      const beneficiaires =
        await repo.getBeneficiairesDeLaFeatureDuConseillerInitial(
          FeatureFlip.Tag.MIGRATION_PHASE_A
        )
      expect(beneficiaires).to.have.deep.members([
        { id: 'jeuneMigration' },
        { id: 'jeune-suivi-conseiller-migration' }
      ])
    })
  })
})
