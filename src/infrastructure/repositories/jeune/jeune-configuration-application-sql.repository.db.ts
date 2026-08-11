import { Injectable } from '@nestjs/common'
import {
  ConfigurationApplication,
  ConfigurationApplicationJeune,
  TIMEZONE_PAR_DEFAUT
} from '../../../domain/jeune/configuration-application'
import { JeuneSqlModel } from '../../sequelize/models/jeune.sql-model'
import { fromSqlToPreferencesJeune } from '../mappers/jeunes.mappers'

@Injectable()
export class JeuneConfigurationApplicationSqlRepository implements ConfigurationApplication.Repository<ConfigurationApplicationJeune> {
  async get(
    idJeune: string
  ): Promise<ConfigurationApplicationJeune | undefined> {
    const jeuneSqlModel = await JeuneSqlModel.findByPk(idJeune, {
      attributes: attributesConfigurationApplication
    })
    if (!jeuneSqlModel) {
      return undefined
    }

    return toConfigurationApplication(jeuneSqlModel)
  }

  async save(
    configurationApplication: ConfigurationApplicationJeune
  ): Promise<void> {
    // TODO: dateDerniereActivite n'est pas persistée ici (contrairement aux invités,
    // cf. JeuneInviteConfigurationApplicationSqlRepository) : la colonne n'existe pas
    // encore sur JeuneSqlModel. Dette assumée, à traiter si le signal se généralise
    // aux jeunes standards.
    await JeuneSqlModel.update(
      {
        appVersion: configurationApplication.appVersion ?? null,
        pushNotificationToken:
          configurationApplication.pushNotificationToken ?? null,
        dateDerniereActualisationToken:
          configurationApplication.dateDerniereActualisationToken,
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
): ConfigurationApplicationJeune {
  return {
    idJeune: jeuneSqlModel.id,
    appVersion: jeuneSqlModel.appVersion ?? undefined,
    installationId: jeuneSqlModel.installationId ?? undefined,
    instanceId: jeuneSqlModel.instanceId ?? undefined,
    pushNotificationToken: jeuneSqlModel.pushNotificationToken ?? undefined,
    fuseauHoraire: jeuneSqlModel.timezone ?? TIMEZONE_PAR_DEFAUT,
    dateDerniereActualisationToken:
      jeuneSqlModel.dateDerniereActualisationToken ?? undefined,
    preferences: fromSqlToPreferencesJeune(jeuneSqlModel)
  }
}

const attributesConfigurationApplication = [
  'id',
  'appVersion',
  'installationId',
  'instanceId',
  'pushNotificationToken',
  'dateDerniereActualisationToken',
  'timezone',
  'partageFavoris',
  'notificationsAlertesOffres',
  'notificationsMessages',
  'notificationsCreationActionConseiller',
  'notificationsRendezVousSessions',
  'notificationsRappelActions',
  'notificationsActualitesMilo'
]
