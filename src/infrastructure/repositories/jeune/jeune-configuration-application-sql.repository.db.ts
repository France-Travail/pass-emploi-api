import { Injectable } from '@nestjs/common'
import {
  ConfigurationApplication,
  TIMEZONE_PAR_DEFAUT
} from '../../../domain/jeune/configuration-application'
import { JeuneSqlModel } from '../../sequelize/models/jeune.sql-model'
import { fromSqlToPreferencesJeune } from '../mappers/jeunes.mappers'

@Injectable()
export class JeuneConfigurationApplicationSqlRepository
  implements ConfigurationApplication.Repository
{
  async get(idJeune: string): Promise<ConfigurationApplication | undefined> {
    const jeuneSqlModel = await JeuneSqlModel.findByPk(idJeune, {
      attributes: attributesConfigurationApplication
    })
    if (!jeuneSqlModel) {
      return undefined
    }

    return toConfigurationApplication(jeuneSqlModel)
  }

  async save(
    configurationApplication: ConfigurationApplication
  ): Promise<void> {
    await JeuneSqlModel.update(
      {
        appVersion: configurationApplication.appVersion ?? null,
        pushNotificationToken:
          configurationApplication.pushNotificationToken ?? null,
        dateDerniereActivite: configurationApplication.dateDerniereActivite,
        installationId: configurationApplication.installationId ?? null,
        instanceId: configurationApplication.instanceId ?? null,
        timezone: configurationApplication.fuseauHoraire ?? null
      },
      { where: { id: configurationApplication.idJeune } }
    )
  }
}

function toConfigurationApplication(
  jeuneSqlModel: JeuneSqlModel
): ConfigurationApplication {
  return {
    idJeune: jeuneSqlModel.id,
    appVersion: jeuneSqlModel.appVersion ?? undefined,
    installationId: jeuneSqlModel.installationId ?? undefined,
    instanceId: jeuneSqlModel.instanceId ?? undefined,
    pushNotificationToken: jeuneSqlModel.pushNotificationToken ?? undefined,
    fuseauHoraire: jeuneSqlModel.timezone ?? TIMEZONE_PAR_DEFAUT,
    dateDerniereActivite: jeuneSqlModel.dateDerniereActivite ?? undefined,
    preferences: fromSqlToPreferencesJeune(jeuneSqlModel)
  }
}

const attributesConfigurationApplication = [
  'id',
  'appVersion',
  'installationId',
  'instanceId',
  'pushNotificationToken',
  'dateDerniereActivite',
  'timezone',
  'partageFavoris',
  'notificationsAlertesOffres',
  'notificationsMessages',
  'notificationsCreationActionConseiller',
  'notificationsRendezVousSessions',
  'notificationsRappelActions',
  'notificationsActualitesMilo'
]
