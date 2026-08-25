import { ConfigurationApplication } from '../../../../src/domain/jeune/configuration-application'
import { JeuneInviteConfigurationApplicationSqlRepository } from '../../../../src/infrastructure/repositories/jeune/jeune-invite-configuration-application-sql.repository.db'
import { JeuneInviteSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune-invite.sql-model'
import { uneDatetime } from '../../../fixtures/date.fixture'
import { unJeuneInviteDto } from '../../../fixtures/sql-models/jeune-invite.sql-model'
import { expect } from '../../../utils'
import { getDatabase } from '../../../utils/database-for-testing'

describe('JeuneInviteConfigurationApplicationSqlRepository', () => {
  let repository: JeuneInviteConfigurationApplicationSqlRepository
  const idInvite = 'INVITE-ID'

  beforeEach(async () => {
    await getDatabase().cleanPG()
    repository = new JeuneInviteConfigurationApplicationSqlRepository()
  })

  describe('get', () => {
    describe("quand l'invité existe", () => {
      it('retourne la configuration application', async () => {
        // Given
        await JeuneInviteSqlModel.creer(
          unJeuneInviteDto({
            id: idInvite,
            pushNotificationToken: 'unToken',
            dateDerniereActivite: uneDatetime().toJSDate(),
            installationId: 'uneInstallationId',
            instanceId: 'uneInstanceId',
            appVersion: 'uneAppVersion',
            timezone: 'Europe/Paris'
          })
        )

        // When
        const result = await repository.get(idInvite)

        // Then
        const expected: ConfigurationApplication = {
          idJeune: idInvite,
          pushNotificationToken: 'unToken',
          installationId: 'uneInstallationId',
          instanceId: 'uneInstanceId',
          appVersion: 'uneAppVersion',
          dateDerniereActivite: uneDatetime().toJSDate(),
          fuseauHoraire: 'Europe/Paris'
        }
        expect(result).to.deep.equal(expected)
      })

      it('applique le fuseau horaire par défaut quand il est absent', async () => {
        // Given
        await JeuneInviteSqlModel.creer(
          unJeuneInviteDto({
            id: idInvite,
            timezone: null,
            pushNotificationToken: null,
            installationId: null,
            instanceId: null,
            appVersion: null
          })
        )

        // When
        const result = await repository.get(idInvite)

        // Then
        expect(result?.fuseauHoraire).to.equal('Europe/Paris')
        expect(result?.pushNotificationToken).to.equal(undefined)
        expect(result?.appVersion).to.equal(undefined)
      })
    })

    describe("quand l'invité n'existe pas", () => {
      it('retourne undefined', async () => {
        // When
        const result = await repository.get('INCONNU')

        // Then
        expect(result).to.equal(undefined)
      })
    })
  })

  describe('save', () => {
    beforeEach(async () => {
      await JeuneInviteSqlModel.creer(unJeuneInviteDto({ id: idInvite }))
    })

    it("met à jour la configuration de l'invité", async () => {
      // Given
      const configuration: ConfigurationApplication = {
        idJeune: idInvite,
        pushNotificationToken: 'unNouveauToken',
        installationId: 'uneInstallationId',
        instanceId: 'uneInstanceId',
        appVersion: 'uneAppVersion',
        dateDerniereActivite: uneDatetime().toJSDate(),
        fuseauHoraire: 'Europe/Paris'
      }

      // When
      await repository.save(configuration)

      // Then
      const result = await JeuneInviteSqlModel.findByPk(idInvite)
      expect(result?.pushNotificationToken).to.equal('unNouveauToken')
      expect(result?.installationId).to.equal('uneInstallationId')
      expect(result?.instanceId).to.equal('uneInstanceId')
      expect(result?.appVersion).to.equal('uneAppVersion')
      expect(result?.timezone).to.equal('Europe/Paris')
      expect(result?.dateDerniereActivite).to.deep.equal(
        uneDatetime().toJSDate()
      )
    })

    it('écrit null pour les champs optionnels absents', async () => {
      // Given : champs optionnels absents (fuseauHoraire forcé pour couvrir le ?? null)
      // dateDerniereActivite reste requise : toujours posée par ConfigurationApplication.FactoryInvite
      const configuration = {
        idJeune: idInvite,
        pushNotificationToken: 'unToken',
        installationId: 'uneInstallationId',
        appVersion: undefined,
        dateDerniereActivite: uneDatetime().toJSDate(),
        fuseauHoraire: undefined
      } as unknown as ConfigurationApplication

      // When
      await repository.save(configuration)

      // Then
      const result = await JeuneInviteSqlModel.findByPk(idInvite)
      expect(result?.pushNotificationToken).to.equal('unToken')
      expect(result?.appVersion).to.equal(null)
      expect(result?.instanceId).to.equal(null)
      expect(result?.timezone).to.equal(null)
      expect(result?.dateDerniereActivite).to.deep.equal(
        uneDatetime().toJSDate()
      )
    })

    it('lève une erreur si dateDerniereActivite est absente', async () => {
      // Given
      const configuration = {
        idJeune: idInvite,
        fuseauHoraire: 'Europe/Paris'
      } as unknown as ConfigurationApplication

      // When / Then
      await expect(repository.save(configuration)).to.be.rejectedWith(
        "dateDerniereActivite est requise pour sauvegarder la configuration d'un invité"
      )
    })
  })
})
