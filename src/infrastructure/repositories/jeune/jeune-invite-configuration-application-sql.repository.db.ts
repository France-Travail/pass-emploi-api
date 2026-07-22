import { Injectable } from '@nestjs/common'
import { TIMEZONE_PAR_DEFAUT } from '../../../domain/jeune/configuration-application'
import { Jeune } from '../../../domain/jeune/jeune'
import { JeuneInviteSqlModel } from '../../sequelize/models/jeune-invite.sql-model'

@Injectable()
export class JeuneInviteConfigurationApplicationSqlRepository
  implements Jeune.ConfigurationApplication.Repository
{
  async get(
    idJeune: string
  ): Promise<Jeune.ConfigurationApplication | undefined> {
    const jeuneInviteSqlModel = await JeuneInviteSqlModel.findByPk(idJeune, {
      attributes: attributesConfigurationApplication
    })
    if (!jeuneInviteSqlModel) {
      return undefined
    }

    return toConfigurationApplication(jeuneInviteSqlModel)
  }

  async save(
    configurationApplication: Jeune.ConfigurationApplication
  ): Promise<void> {
    await JeuneInviteSqlModel.update(
      {
        appVersion: configurationApplication.appVersion ?? null,
        pushNotificationToken:
          configurationApplication.pushNotificationToken ?? null,
        dateDerniereActualisationToken:
          configurationApplication.dateDerniereActualisationToken ?? null,
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
): Jeune.ConfigurationApplication {
  return {
    idJeune: jeuneInviteSqlModel.id,
    appVersion: jeuneInviteSqlModel.appVersion ?? undefined,
    installationId: jeuneInviteSqlModel.installationId ?? undefined,
    instanceId: jeuneInviteSqlModel.instanceId ?? undefined,
    pushNotificationToken:
      jeuneInviteSqlModel.pushNotificationToken ?? undefined,
    fuseauHoraire: jeuneInviteSqlModel.timezone ?? TIMEZONE_PAR_DEFAUT,
    dateDerniereActualisationToken:
      jeuneInviteSqlModel.dateDerniereActualisationToken ?? undefined
  }
}

const attributesConfigurationApplication = [
  'id',
  'appVersion',
  'installationId',
  'instanceId',
  'pushNotificationToken',
  'dateDerniereActualisationToken',
  'timezone'
]
