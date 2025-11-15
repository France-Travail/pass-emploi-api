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

    const conseillerCEJMigrationDto = unConseillerDto({
      id: 'cejMigration',
      structure: Core.Structure.POLE_EMPLOI,
      email: 'conseillerCEJMigration@email.com'
    })
    const conseillerAIJMigrationDto = unConseillerDto({
      id: 'aijMigration',
      structure: Core.Structure.POLE_EMPLOI_AIJ,
      email: 'conseillerAIJMigration@email.com'
    })
    const conseillerFtIaDto = unConseillerDto({
      id: 'ftIAPasMigration',
      email: 'conseillerFTIA@email.com',
      structure: Core.Structure.POLE_EMPLOI_AIJ
    })

    const jeuneCEJConseillerMigrationDto = unJeuneDto({
      id: 'cejMigration',
      structure: Core.Structure.POLE_EMPLOI,
      idConseiller: 'cejMigration',
      idConseillerInitial: undefined
    })
    const jeuneAijConseillerMigrationDto = unJeuneDto({
      id: 'aijMigration',
      structure: Core.Structure.POLE_EMPLOI_AIJ,
      idConseiller: 'aijMigration',
      idConseillerInitial: undefined
    })
    const jeuneAiJSuiviCejMigrationDto = unJeuneDto({
      id: 'aij-suivi-cej',
      structure: Core.Structure.POLE_EMPLOI_AIJ,
      idConseiller: 'cejMigration',
      idConseillerInitial: 'ftIAPasMigration'
    })
    const jeuneCejSuiviAijSansMigrationDto = unJeuneDto({
      id: 'cej-suivi-aij-sans-migration',
      structure: Core.Structure.POLE_EMPLOI,
      idConseiller: 'ftIAPasMigration',
      idConseillerInitial: 'cejMigration'
    })

    await ConseillerSqlModel.bulkCreate([
      conseillerCEJMigrationDto,
      conseillerAIJMigrationDto,
      conseillerFtIaDto
    ])
    await JeuneSqlModel.bulkCreate([
      jeuneCEJConseillerMigrationDto,
      jeuneAijConseillerMigrationDto,
      jeuneAiJSuiviCejMigrationDto,
      jeuneCejSuiviAijSansMigrationDto
    ])

    const ffMigrationCEJ = {
      featureTag: FeatureFlip.Tag.MIGRATION,
      emailConseiller: 'conseillerCEJMigration@email.com'
    }
    const ffMigrationAIJ = {
      featureTag: FeatureFlip.Tag.MIGRATION,
      emailConseiller: 'conseillerAIJMigration@email.com'
    }
    const ffFTIA = {
      featureTag: FeatureFlip.Tag.DEMARCHES_IA,
      emailConseiller: 'conseillerFTIA@email.com'
    }
    await FeatureFlipSqlModel.bulkCreate([
      ffMigrationCEJ,
      ffMigrationAIJ,
      ffFTIA
    ])
  })

  describe('getBeneficiaireSiFeatureActive', () => {
    it('renvoie le bénéficiaire si son conseiller a la feature demandée', async () => {
      const beneficiaire = await repo.getBeneficiaireSiFeatureActive(
        FeatureFlip.Tag.MIGRATION,
        'cejMigration'
      )
      expect(beneficiaire).to.deep.equal({
        id: 'cejMigration',
        structure: Core.Structure.POLE_EMPLOI,
        structureConseillerRattachement: Core.Structure.POLE_EMPLOI
      })
    })

    it('renvoie le bénéficiaire si son conseiller initial a la feature demandée', async () => {
      const beneficiaire = await repo.getBeneficiaireSiFeatureActive(
        FeatureFlip.Tag.MIGRATION,
        'cej-suivi-aij-sans-migration'
      )
      expect(beneficiaire).to.deep.equal({
        id: 'cej-suivi-aij-sans-migration',
        structure: Core.Structure.POLE_EMPLOI,
        structureConseillerRattachement: Core.Structure.POLE_EMPLOI
      })
    })

    it("ne renvoie rien si ni son conseiller, ni son conseiller initial n'ont la feature demandée", async () => {
      const beneficiaire = await repo.getBeneficiaireSiFeatureActive(
        FeatureFlip.Tag.DEMARCHES_IA,
        'cejMigration'
      )
      expect(beneficiaire).to.be.undefined()
    })

    it("ne renvoie rien si l'id jeune n'existe pas", async () => {
      const beneficiaire = await repo.getBeneficiaireSiFeatureActive(
        FeatureFlip.Tag.MIGRATION,
        'id-inexistant'
      )
      expect(beneficiaire).to.be.undefined()
    })
  })

  describe('featureActivePourConseiller', () => {
    it("renvoie le conseiller si l'email du conseiller est autorisée pour la feature", async () => {
      const conseiller = await repo.getConseillerSiFeatureActive(
        FeatureFlip.Tag.MIGRATION,
        'cejMigration'
      )
      expect(conseiller).to.deep.equal({
        id: 'cejMigration',
        structure: Core.Structure.POLE_EMPLOI
      })
    })

    it("ne renvoie rien si le conseiller n'est pas autorisé pour cette feature", async () => {
      const conseiller = await repo.getConseillerSiFeatureActive(
        FeatureFlip.Tag.MIGRATION,
        'ftIAPasMigration'
      )
      expect(conseiller).to.be.undefined()
    })
  })

  describe('getBeneficiairesDeLaFeature', () => {
    it('renvoie la liste des id et structure des jeunes des conseillers de rattachement avec le tag migration', async () => {
      const idJeunes = await repo.getBeneficiairesDeLaFeature(
        FeatureFlip.Tag.MIGRATION
      )
      expect(idJeunes).to.have.deep.members([
        {
          id: 'cejMigration',
          structure: 'POLE_EMPLOI',
          structureConseillerRattachement: 'POLE_EMPLOI'
        },
        {
          id: 'aijMigration',
          structure: 'POLE_EMPLOI_AIJ',
          structureConseillerRattachement: 'POLE_EMPLOI_AIJ'
        },
        {
          id: 'cej-suivi-aij-sans-migration',
          structure: 'POLE_EMPLOI',
          structureConseillerRattachement: 'POLE_EMPLOI'
        }
      ])
    })
  })
})
