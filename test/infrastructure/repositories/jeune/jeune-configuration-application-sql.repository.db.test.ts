import { Core } from '../../../../src/domain/core'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { JeuneConfigurationApplicationSqlRepository } from '../../../../src/infrastructure/repositories/jeune/jeune-configuration-application-sql.repository.db'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { uneDatetime } from '../../../fixtures/date.fixture'
import { desPreferencesJeune, unJeune } from '../../../fixtures/jeune.fixture'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../../fixtures/sql-models/jeune.sql-model'
import { expect } from '../../../utils'
import { getDatabase } from '../../../utils/database-for-testing'

describe('JeuneConfigurationApplicationSqlRepository', () => {
  let jeuneConfigurationApplicationSqlRepositorySql: JeuneConfigurationApplicationSqlRepository

  beforeEach(async () => {
    await getDatabase().cleanPG()
    jeuneConfigurationApplicationSqlRepositorySql =
      new JeuneConfigurationApplicationSqlRepository()
  })

  describe('get', () => {
    let jeune: Jeune

    beforeEach(async () => {
      // Given
      jeune = {
        ...unJeune()
      }
      const conseillerDto = unConseillerDto({
        structure: Core.Structure.POLE_EMPLOI
      })
      await ConseillerSqlModel.creer(conseillerDto)
      await JeuneSqlModel.creer(
        unJeuneDto({
          idConseiller: conseillerDto.id,
          dateCreation: jeune.creationDate.toJSDate(),
          pushNotificationToken: 'unToken',
          dateDerniereActivite: uneDatetime().toJSDate(),
          datePremiereConnexion: uneDatetime().toJSDate(),
          installationId: 'uneInstallationId',
          instanceId: 'uneInstanceId',
          appVersion: 'uneAppVersion'
        })
      )
    })
    describe('quand le jeune existe', () => {
      it('retourne la configuration application', async () => {
        // When
        const result =
          await jeuneConfigurationApplicationSqlRepositorySql.get('ABCDE')

        // Then
        const configurationApplicationExpected: Jeune.ConfigurationApplication =
          {
            idJeune: jeune.id,
            pushNotificationToken: 'unToken',
            installationId: 'uneInstallationId',
            instanceId: 'uneInstanceId',
            appVersion: 'uneAppVersion',
            dateDerniereActivite: uneDatetime().toJSDate(),
            fuseauHoraire: 'Europe/Paris',
            preferences: desPreferencesJeune()
          }
        expect(result).to.deep.equal(configurationApplicationExpected)
      })
    })

    describe("quand le jeune n'existe pas", () => {
      it('retourne undefined', async () => {
        // When
        const result =
          await jeuneConfigurationApplicationSqlRepositorySql.get('ZIZOU')

        // Then
        expect(result).to.equal(undefined)
      })
    })
  })

  describe('save', () => {
    let jeune: Jeune

    beforeEach(async () => {
      // Given
      jeune = {
        ...unJeune()
      }
      const conseillerDto = unConseillerDto({
        structure: Core.Structure.POLE_EMPLOI
      })
      await ConseillerSqlModel.creer(conseillerDto)
      await JeuneSqlModel.creer(
        unJeuneDto({
          idConseiller: conseillerDto.id,
          dateCreation: jeune.creationDate.toJSDate()
        })
      )
    })
    describe('quand le jeune existe', () => {
      it('met a jour le jeune avec configurationApplication', async () => {
        //Given
        const idJeune = jeune.id
        // When
        const configurationApplication: Jeune.ConfigurationApplication = {
          idJeune,
          pushNotificationToken: 'unToken',
          installationId: 'uneInstallationId',
          instanceId: 'yyy-yy-yyy',
          appVersion: 'uneAppVersion',
          dateDerniereActivite: uneDatetime().toJSDate(),
          fuseauHoraire: 'Europe/Paris'
        }
        await jeuneConfigurationApplicationSqlRepositorySql.save(
          configurationApplication
        )

        // Then
        const result = await JeuneSqlModel.findByPk(idJeune)
        expect(result?.pushNotificationToken).to.equal(
          configurationApplication.pushNotificationToken
        )
        expect(result?.installationId).to.equal(
          configurationApplication.installationId
        )
        expect(result?.instanceId).to.equal(configurationApplication.instanceId)
        expect(result?.appVersion).to.equal(configurationApplication.appVersion)
        expect(result?.dateDerniereActivite).to.deep.equal(
          configurationApplication.dateDerniereActivite
        )
      })
      it('met a jour le jeune avec configurationApplication et contenant des valeurs nulles', async () => {
        //Given
        const idJeune = jeune.id
        // When
        const configurationApplication: Jeune.ConfigurationApplication = {
          idJeune,
          pushNotificationToken: 'unToken',
          installationId: 'uneInstallationId',
          appVersion: undefined,
          fuseauHoraire: 'Europe/Paris'
        }
        await jeuneConfigurationApplicationSqlRepositorySql.save(
          configurationApplication
        )

        // Then
        const result = await JeuneSqlModel.findByPk(idJeune)
        expect(result?.pushNotificationToken).to.equal(
          configurationApplication.pushNotificationToken
        )
        expect(result?.installationId).to.equal(
          configurationApplication.installationId
        )
        expect(result?.appVersion).to.equal(null)
      })
    })
  })
})
