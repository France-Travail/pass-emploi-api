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

    const conseillerMigrationADto = unConseillerDto({
      id: 'conseillerMigrationA',
      structure: Core.Structure.POLE_EMPLOI,
      email: 'conseillerMigrationA@email.com'
    })
    const conseillerMigrationBDto = unConseillerDto({
      id: 'conseillerMigrationB',
      email: 'conseillerMigrationB@email.com'
    })
    const conseillerDeuxFeaturesDto = unConseillerDto({
      id: 'conseillerDeuxFeatures',
      email: 'conseillerDeuxFeatures@email.com'
    })
    const conseillerSansFeatureDto = unConseillerDto({
      id: 'conseillerSansFeature',
      email: 'conseillerSansFeature@email.com'
    })

    const jeuneConseillerMigrationADto = unJeuneDto({
      id: 'jeuneMigrationA',
      idConseiller: 'conseillerMigrationA',
      idConseillerInitial: undefined
    })
    const jeuneSuiviConseillerMigrationBDto = unJeuneDto({
      id: 'jeune-transfere-conseiller-migration',
      idConseiller: 'conseillerMigrationB',
      idConseillerInitial: 'conseillerMigrationA'
    })
    const jeuneConseillerMigrationBDto = unJeuneDto({
      id: 'jeuneMigrationB',
      idConseiller: 'conseillerMigrationB',
      idConseillerInitial: undefined
    })
    const jeuneConseillerDeuxFeaturesDto = unJeuneDto({
      id: 'jeuneDeuxFeatures',
      idConseiller: 'conseillerDeuxFeatures',
      idConseillerInitial: undefined
    })
    const jeuneConseillerSansFeatureDto = unJeuneDto({
      id: 'jeuneSansFeature',
      idConseiller: 'conseillerSansFeature',
      idConseillerInitial: undefined
    })

    await ConseillerSqlModel.bulkCreate([
      conseillerMigrationADto,
      conseillerMigrationBDto,
      conseillerDeuxFeaturesDto,
      conseillerSansFeatureDto
    ])
    await JeuneSqlModel.bulkCreate([
      jeuneConseillerMigrationADto,
      jeuneSuiviConseillerMigrationBDto,
      jeuneConseillerMigrationBDto,
      jeuneConseillerDeuxFeaturesDto,
      jeuneConseillerSansFeatureDto
    ])

    const ffMigrationA = {
      featureTag: FeatureFlip.Tag.MIGRATION_PHASE_A,
      emailConseiller: 'conseillerMigrationA@email.com'
    }
    const ffMigrationB = {
      featureTag: FeatureFlip.Tag.MIGRATION_PHASE_B,
      emailConseiller: 'conseillerMigrationB@email.com'
    }
    const ffDeuxFeaturesA = {
      featureTag: FeatureFlip.Tag.MIGRATION_PHASE_A,
      emailConseiller: 'conseillerDeuxFeatures@email.com'
    }
    const ffDeuxFeaturesTest = {
      featureTag: FeatureFlip.Tag.MIGRATION_PHASE_TEST,
      emailConseiller: 'conseillerDeuxFeatures@email.com'
    }
    await FeatureFlipSqlModel.bulkCreate([
      ffMigrationA,
      ffMigrationB,
      ffDeuxFeaturesA,
      ffDeuxFeaturesTest
    ])
  })

  describe('getTagsActifsPourLeConseillerDuJeune', () => {
    it('renvoie tous les tags des features de son conseiller', async () => {
      const tags =
        await repo.getTagsActifsPourLeConseillerDuJeune('jeuneDeuxFeatures')
      expect(tags).to.have.members([
        FeatureFlip.Tag.MIGRATION_PHASE_A,
        FeatureFlip.Tag.MIGRATION_PHASE_TEST
      ])
    })

    it('renvoie les tags de son conseiller initial quand le jeune est transféré', async () => {
      const tags = await repo.getTagsActifsPourLeConseillerDuJeune(
        'jeune-transfere-conseiller-migration'
      )
      expect(tags).to.deep.equal([FeatureFlip.Tag.MIGRATION_PHASE_A])
    })

    it("renvoie un tableau vide si son conseiller n'a aucune feature", async () => {
      const tags =
        await repo.getTagsActifsPourLeConseillerDuJeune('jeuneSansFeature')
      expect(tags).to.deep.equal([])
    })

    it("renvoie un tableau vide si l'id jeune n'existe pas", async () => {
      const tags =
        await repo.getTagsActifsPourLeConseillerDuJeune('id-inexistant')
      expect(tags).to.deep.equal([])
    })
  })

  describe('getTagSiFeatureActivePourLeConseillerDuJeune', () => {
    it('renvoie le tag si son conseiller a la feature demandée', async () => {
      const beneficiaire =
        await repo.getTagSiFeatureActivePourLeConseillerDuJeune(
          [
            FeatureFlip.Tag.MIGRATION_PHASE_A,
            FeatureFlip.Tag.MIGRATION_PHASE_B
          ],
          'jeuneMigrationA'
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
          'jeune-transfere-conseiller-migration'
        )
      expect(beneficiaire).to.deep.equal(FeatureFlip.Tag.MIGRATION_PHASE_A)
    })

    it("ne renvoie rien si ni son conseiller, ni son conseiller initial n'ont la feature demandée", async () => {
      const beneficiaire =
        await repo.getTagSiFeatureActivePourLeConseillerDuJeune(
          [FeatureFlip.Tag.MIGRATION_PHASE_B],
          'jeuneMigrationA'
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
        'conseillerMigrationA'
      )
      expect(conseiller).to.deep.equal(FeatureFlip.Tag.MIGRATION_PHASE_A)
    })

    it("ne renvoie rien si le conseiller n'est pas autorisé pour cette feature", async () => {
      const conseiller = await repo.getTagSiFeatureActivePourLeConseiller(
        [FeatureFlip.Tag.MIGRATION_PHASE_A],
        'conseillerMigrationB'
      )
      expect(conseiller).to.be.undefined()
    })
  })
})
