import { Injectable } from '@nestjs/common'
import {
  ConfigurationApplication,
  TIMEZONE_PAR_DEFAUT
} from '../../../domain/jeune/configuration-application'
import { JeuneInviteSqlModel } from '../../sequelize/models/jeune-invite.sql-model'

@Injectable()
export class JeuneInviteConfigurationApplicationSqlRepository
  implements ConfigurationApplication.Repository
{
  async get(idJeune: string): Promise<ConfigurationApplication | undefined> {
    const jeuneInviteSqlModel = await JeuneInviteSqlModel.findByPk(idJeune, {
      attributes: attributesConfigurationApplication
    })
    if (!jeuneInviteSqlModel) {
      return undefined
    }

    return toConfigurationApplication(jeuneInviteSqlModel)
  }

  async save(
    configurationApplication: ConfigurationApplication
  ): Promise<void> {
    if (!configurationApplication.dateDerniereActivite) {
      throw new Error(
        "dateDerniereActivite est requise pour sauvegarder la configuration d'un invité"
      )
    }

    await JeuneInviteSqlModel.update(
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
  jeuneInviteSqlModel: JeuneInviteSqlModel
): ConfigurationApplication {
  return {
    idJeune: jeuneInviteSqlModel.id,
    appVersion: jeuneInviteSqlModel.appVersion ?? undefined,
    installationId: jeuneInviteSqlModel.installationId ?? undefined,
    instanceId: jeuneInviteSqlModel.instanceId ?? undefined,
    pushNotificationToken:
      jeuneInviteSqlModel.pushNotificationToken ?? undefined,
    fuseauHoraire: jeuneInviteSqlModel.timezone ?? TIMEZONE_PAR_DEFAUT,
    dateDerniereActivite: jeuneInviteSqlModel.dateDerniereActivite ?? undefined
  }
}

const attributesConfigurationApplication = [
  'id',
  'appVersion',
  'installationId',
  'instanceId',
  'pushNotificationToken',
  'dateDerniereActivite',
  'timezone'
]
