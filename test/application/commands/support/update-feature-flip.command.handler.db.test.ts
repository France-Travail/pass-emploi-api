import { before } from 'mocha'
import { SupportAuthorizer } from '../../../../src/application/authorizers/support-authorizer'
import {
  UpdateFeatureFlipCommand,
  UpdateFeatureFlipCommandHandler
} from '../../../../src/application/commands/support/update-feature-flip.command.handler'
import { FeatureFlip } from '../../../../src/domain/feature-flip'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { FeatureFlipSqlModel } from '../../../../src/infrastructure/sequelize/models/feature-flip.sql-model'
import { JeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../../fixtures/sql-models/jeune.sql-model'
import { expect, StubbedClass, stubClass } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

describe('UpdateFeatureFlipCommandHandler', () => {
  let supportAuthorizer: StubbedClass<SupportAuthorizer>
  let databaseForTesting: DatabaseForTesting
  let handler: UpdateFeatureFlipCommandHandler

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()

    const conseiller = unConseillerDto({ id: 'c-1', email: 'c1@email.com' })
    await ConseillerSqlModel.creer(conseiller)

    const j1 = unJeuneDto({ id: 'j1', idConseiller: 'c-1' })
    const j2 = unJeuneDto({ id: 'j2', idConseiller: 'c-1' })
    await JeuneSqlModel.bulkCreate([j1, j2])

    supportAuthorizer = stubClass(SupportAuthorizer)
    handler = new UpdateFeatureFlipCommandHandler(
      supportAuthorizer,
      databaseForTesting.sequelize
    )
  })

  describe('handle - ajout', () => {
    it('ajoute une ligne unique par email conseiller', async () => {
      // Given
      const command: UpdateFeatureFlipCommand = {
        tagFeature: FeatureFlip.Tag.MIGRATION,
        emailsConseillersAjout: ['c1@email.com', 'c2@email.com', 'c1@email.com']
      }

      // When
      const result = await handler.handle(command)

      // Then
      expect(result._isSuccess).to.equal(true)
      const rows = await FeatureFlipSqlModel.findAll({
        where: { featureTag: FeatureFlip.Tag.MIGRATION },
        order: [['emailConseiller', 'ASC']]
      })
      expect(rows.map(r => r.emailConseiller)).to.deep.equal([
        'c1@email.com',
        'c2@email.com'
      ])
    })

    it("n'ajoute pas de doublon si la ligne existe déjà", async () => {
      // Given
      const dejaEnBase = {
        emailConseiller: 'c1@email.com',
        featureTag: FeatureFlip.Tag.MIGRATION
      }
      await FeatureFlipSqlModel.create(dejaEnBase)

      const command: UpdateFeatureFlipCommand = {
        tagFeature: FeatureFlip.Tag.MIGRATION,
        emailsConseillersAjout: ['c1@email.com']
      }

      // When
      const result = await handler.handle(command)

      // Then
      expect(result._isSuccess).to.equal(true)
      const count = await FeatureFlipSqlModel.count({
        where: {
          featureTag: FeatureFlip.Tag.MIGRATION,
          emailConseiller: 'c1@email.com'
        }
      })
      expect(count).to.equal(1)
    })
  })

  describe('handle - suppression', () => {
    it('supprime uniquement les emails demandés pour le tag donné', async () => {
      // Given
      const dejaEnBase = [
        {
          emailConseiller: 'c1@email.com',
          featureTag: FeatureFlip.Tag.MIGRATION
        },
        {
          emailConseiller: 'c2@email.com',
          featureTag: FeatureFlip.Tag.MIGRATION
        },
        {
          emailConseiller: 'c1@email.com',
          featureTag: FeatureFlip.Tag.DEMARCHES_IA
        }
      ]
      await FeatureFlipSqlModel.bulkCreate(dejaEnBase)

      const command: UpdateFeatureFlipCommand = {
        tagFeature: FeatureFlip.Tag.MIGRATION,
        emailsConseillersSuppression: ['c1@email.com']
      }

      // When
      const result = await handler.handle(command)

      // Then
      expect(result._isSuccess).to.equal(true)
      const restantsEnBase = await FeatureFlipSqlModel.findAll({
        order: [
          ['featureTag', 'ASC'],
          ['emailConseiller', 'ASC']
        ]
      })
      expect(
        restantsEnBase.map(r => `${r.featureTag}:${r.emailConseiller}`)
      ).to.deep.equal([
        `${FeatureFlip.Tag.DEMARCHES_IA}:c1@email.com`,
        `${FeatureFlip.Tag.MIGRATION}:c2@email.com`
      ])
    })
  })

  describe('handle - supprimerExistants', () => {
    it('supprime les existants du tag puis ajoute les nouveaux', async () => {
      // Given
      const dejaEnBase = [
        {
          emailConseiller: 'c1@email.com',
          featureTag: FeatureFlip.Tag.MIGRATION
        },
        {
          emailConseiller: 'c2@email.com',
          featureTag: FeatureFlip.Tag.MIGRATION
        },
        {
          emailConseiller: 'c0@passemploi.com',
          featureTag: FeatureFlip.Tag.DEMARCHES_IA
        }
      ]
      await FeatureFlipSqlModel.bulkCreate(dejaEnBase)

      const command: UpdateFeatureFlipCommand = {
        tagFeature: FeatureFlip.Tag.MIGRATION,
        supprimerExistants: true,
        emailsConseillersAjout: ['c3@passemploi.com']
      }

      // When
      const result = await handler.handle(command)

      // Then
      expect(result._isSuccess).to.equal(true)
      const restants = await FeatureFlipSqlModel.findAll({
        order: [
          ['featureTag', 'ASC'],
          ['emailConseiller', 'ASC']
        ]
      })
      expect(
        restants.map(r => `${r.featureTag}:${r.emailConseiller}`)
      ).to.deep.equal([
        `${FeatureFlip.Tag.DEMARCHES_IA}:c0@passemploi.com`,
        `${FeatureFlip.Tag.MIGRATION}:c3@passemploi.com`
      ])
    })
  })
})
