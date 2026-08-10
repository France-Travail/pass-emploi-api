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
    // TODO: dateDerniereActivite est toujours posée par ConfigurationApplication.Factory
    // avant d'arriver ici, mais reste optionnelle côté type tant que le split
    // Jeune / Invité de ce type domaine (cf. docs/wip-refacto-configuration-application.md)
    // n'est pas fait. Garde-fou en attendant : la colonne est NOT NULL en base.
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
        dateDerniereActualisationToken:
          configurationApplication.dateDerniereActualisationToken ?? null,
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
      jeuneInviteSqlModel.dateDerniereActualisationToken ?? undefined,
    dateDerniereActivite: jeuneInviteSqlModel.dateDerniereActivite ?? undefined
  }
}

const attributesConfigurationApplication = [
  'id',
  'appVersion',
  'installationId',
  'instanceId',
  'pushNotificationToken',
  'dateDerniereActualisationToken',
  'dateDerniereActivite',
  'timezone'
]
