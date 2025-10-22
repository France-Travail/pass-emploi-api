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

describe('FeatureFlipSqlRepository', () => {
  let databaseForTesting: DatabaseForTesting
  let repo: FeatureFlipSqlRepository

  before(async () => {
    databaseForTesting = getDatabase()
    await databaseForTesting.cleanPG()
    repo = new FeatureFlipSqlRepository(databaseForTesting.sequelize)

    const conseillerDto1 = unConseillerDto({ id: 'c1', email: 'c1@email.com' })
    const conseillerDto2 = unConseillerDto({ id: 'c2', email: 'c2@email.com' })

    const jeuneDtoJ1 = unJeuneDto({
      id: 'j1',
      idConseiller: 'c1'
    })
    const jeuneDtoJ2 = unJeuneDto({
      id: 'j2',
      idConseiller: 'c2'
    })
    const jeuneDtoJ3 = unJeuneDto({
      id: 'j3',
      idConseiller: 'c2',
      idConseillerInitial: 'c1'
    })

    await ConseillerSqlModel.bulkCreate([conseillerDto1, conseillerDto2])
    await JeuneSqlModel.bulkCreate([jeuneDtoJ1, jeuneDtoJ2, jeuneDtoJ3])

    const j1Migration = {
      featureTag: FeatureFlip.Tag.MIGRATION,
      emailConseiller: 'c1@email.com'
    }
    const j2DemarchesIA = {
      featureTag: FeatureFlip.Tag.DEMARCHES_IA,
      emailConseiller: 'c2@email.com'
    }
    await FeatureFlipSqlModel.bulkCreate([j1Migration, j2DemarchesIA])
  })

  describe('featureActivePourBeneficiaire', () => {
    it("renvoie true si l'id jeune existe pour cette feature", async () => {
      const actif = await repo.featureActivePourBeneficiaire(
        FeatureFlip.Tag.MIGRATION,
        'j1'
      )
      expect(actif).to.be.true()
    })

    it("renvoie false si l'id jeune existe mais pour une autre feature", async () => {
      const actif = await repo.featureActivePourBeneficiaire(
        FeatureFlip.Tag.DEMARCHES_IA,
        'j1'
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
    it("renvoie true si l'email du conseiller est autorisé pour la feature", async () => {
      const actif = await repo.featureActivePourConseiller(
        FeatureFlip.Tag.MIGRATION,
        'c1'
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

    it('renvoie true pour un autre feature tag autorisé sur un autre conseiller', async () => {
      const actif = await repo.featureActivePourConseiller(
        FeatureFlip.Tag.DEMARCHES_IA,
        'c2'
      )
      expect(actif).to.be.true()
    })
  })
})
