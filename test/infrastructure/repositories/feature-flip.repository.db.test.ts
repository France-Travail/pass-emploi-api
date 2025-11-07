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
      id: 'cej',
      structure: Core.Structure.POLE_EMPLOI,
      email: 'conseillerCEJMigration@email.com'
    })
    const conseillerAIJMigrationDto = unConseillerDto({
      id: 'aij',
      structure: Core.Structure.POLE_EMPLOI_AIJ,
      email: 'conseillerAIJMigration@email.com'
    })
    const conseillerDtoFTIA = unConseillerDto({
      id: 'c2',
      email: 'conseillerFTIA@email.com'
    })

    const jeuneCEJDto = unJeuneDto({
      id: 'cej',
      structure: Core.Structure.POLE_EMPLOI,
      idConseiller: 'cej'
    })
    const jeuneAIJDto = unJeuneDto({
      id: 'aij',
      structure: Core.Structure.POLE_EMPLOI_AIJ,
      idConseiller: 'aij'
    })
    const jeuneAIJSuiviCEJDto = unJeuneDto({
      id: 'aij-suivi-cej',
      structure: Core.Structure.POLE_EMPLOI_AIJ,
      idConseiller: 'cej'
    })
    const jeuneDtoJ2 = unJeuneDto({
      id: 'j2',
      idConseiller: 'c2'
    })
    const jeuneDtoJ3 = unJeuneDto({
      id: 'j3',
      structure: Core.Structure.POLE_EMPLOI,
      idConseiller: 'c2',
      idConseillerInitial: 'cej'
    })

    await ConseillerSqlModel.bulkCreate([
      conseillerCEJMigrationDto,
      conseillerAIJMigrationDto,
      conseillerDtoFTIA
    ])
    await JeuneSqlModel.bulkCreate([
      jeuneCEJDto,
      jeuneAIJDto,
      jeuneAIJSuiviCEJDto,
      jeuneDtoJ2,
      jeuneDtoJ3
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

  describe('featureActivePourBeneficiaire', () => {
    it("renvoie true si l'id jeune existe pour cette feature", async () => {
      const actif = await repo.featureActivePourBeneficiaire(
        FeatureFlip.Tag.MIGRATION,
        'cej'
      )
      expect(actif).to.be.true()
    })

    it("renvoie false si l'id jeune existe mais pour une autre feature", async () => {
      const actif = await repo.featureActivePourBeneficiaire(
        FeatureFlip.Tag.DEMARCHES_IA,
        'cej'
      )
      expect(actif).to.be.false()
    })

    it('renvoie false si jeune pas CEJ', async () => {
      const actif = await repo.featureActivePourBeneficiaire(
        FeatureFlip.Tag.DEMARCHES_IA,
        'aij'
      )
      expect(actif).to.be.false()
    })

    it('renvoie false si conseiller pas CEJ', async () => {
      const actif = await repo.featureActivePourBeneficiaire(
        FeatureFlip.Tag.DEMARCHES_IA,
        'aij-suivi-cej'
      )
      expect(actif).to.be.false()
    })

    it("renvoie false si l'id jeune n'existe pas", async () => {
      const actif = await repo.featureActivePourBeneficiaire(
        FeatureFlip.Tag.MIGRATION,
        'id-inexistant'
      )
      expect(actif).to.be.false()
    })

    it("renvoie true si l'email du conseiller initial est autorisé pour la feature", async () => {
      const actif = await repo.featureActivePourBeneficiaire(
        FeatureFlip.Tag.MIGRATION,
        'j3'
      )
      expect(actif).to.be.true()
    })
  })

  describe('featureActivePourConseiller', () => {
    it("renvoie true si l'email du conseiller est autorisée pour la feature", async () => {
      const actif = await repo.featureActivePourConseiller(
        FeatureFlip.Tag.MIGRATION,
        'cej'
      )
      expect(actif).to.be.true()
    })

    it("renvoie false si le conseiller n'est pas autorisé pour cette feature", async () => {
      const actif = await repo.featureActivePourConseiller(
        FeatureFlip.Tag.MIGRATION,
        'c2'
      )
      expect(actif).to.be.false()
    })

    it("renvoie false si le conseiller n'est pas CEJ pour Migration", async () => {
      const actif = await repo.featureActivePourConseiller(
        FeatureFlip.Tag.MIGRATION,
        'aij'
      )
      expect(actif).to.be.false()
    })

    it('renvoie true pour un autre feature tag autorisé sur un autre conseiller', async () => {
      const actif = await repo.featureActivePourConseiller(
        FeatureFlip.Tag.DEMARCHES_IA,
        'c2'
      )
      expect(actif).to.be.true()
    })
  })

  describe('getIdsBeneficiaires', () => {
    it('renvoie la liste des id des jeunes pour un conseiller avec le tag migration et aussi ceux qui ont ce conseiller initial mais pas ceux non CEJ', async () => {
      const idJeunes = await repo.getIdsBeneficiaires(FeatureFlip.Tag.MIGRATION)
      expect(idJeunes).to.be.deep.equal(['cej', 'j3'])
    })
  })
})
