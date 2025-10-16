import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'
import { GetFeaturesQueryGetter } from '../../../../src/application/queries/query-getters/get-features.query.getter.db'
import {
  FeatureFlipSqlModel,
  FeatureFlipTag
} from '../../../../src/infrastructure/sequelize/models/feature-flip.sql-model'
import { unJeuneDto } from '../../../fixtures/sql-models/jeune.sql-model'
import { JeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { expect } from '../../../utils'

describe('GetFeaturesQueryGetter', () => {
  let databaseForTesting: DatabaseForTesting
  let getFeaturesQueryGetter: GetFeaturesQueryGetter

  before(async () => {
    databaseForTesting = getDatabase()
    await databaseForTesting.cleanPG()
    getFeaturesQueryGetter = new GetFeaturesQueryGetter(
      databaseForTesting.sequelize
    )

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
    await ConseillerSqlModel.bulkCreate([conseillerDto1, conseillerDto2])
    await JeuneSqlModel.bulkCreate([jeuneDtoJ1, jeuneDtoJ2])

    const j1Migration = {
      featureTag: FeatureFlipTag.MIGRATION,
      emailConseiller: 'c1@email.com'
    }
    const j2DemarchesIA = {
      featureTag: FeatureFlipTag.DEMARCHES_IA,
      emailConseiller: 'c2@email.com'
    }
    await FeatureFlipSqlModel.bulkCreate([j1Migration, j2DemarchesIA])
  })

  describe('handle', () => {
    it("renvoie true si l'id jeune existe pour cette feature", async () => {
      // When
      const featureExiste = await getFeaturesQueryGetter.handle({
        idJeune: 'j1',
        featureTag: FeatureFlipTag.MIGRATION
      })

      // Then
      expect(featureExiste).to.be.true()
    })
    it("renvoie false si l'id jeune existe mais pour une autre feature", async () => {
      // When
      const featureExiste = await getFeaturesQueryGetter.handle({
        idJeune: 'j1',
        featureTag: FeatureFlipTag.DEMARCHES_IA
      })

      // Then
      expect(featureExiste).to.be.false()
    })
    it("renvoie false si l'id jeune n'existe pas", async () => {
      // When
      const featureExiste = await getFeaturesQueryGetter.handle({
        idJeune: 'id-inexistant',
        featureTag: FeatureFlipTag.MIGRATION
      })

      // Then
      expect(featureExiste).to.be.false()
    })
  })
})
