import { Injectable } from '@nestjs/common'
import { DateService } from '../../utils/date-service'

export const TIMEZONE_PAR_DEFAUT = 'Europe/Paris'

export interface ConfigurationApplicationCommune {
  idJeune: string
  pushNotificationToken?: string
  appVersion?: string
  installationId?: string
  instanceId?: string
  fuseauHoraire: string
}

export interface ConfigurationApplicationJeune extends ConfigurationApplicationCommune {
  dateDerniereActualisationToken?: Date
  preferences?: ConfigurationApplication.Preferences
}

export interface ConfigurationApplicationInvite extends ConfigurationApplicationCommune {
  dateDerniereActivite?: Date
}

export namespace ConfigurationApplication {
  export interface Preferences {
    partageFavoris: boolean
    alertesOffres: boolean
    messages: boolean
    creationActionConseiller: boolean
    rendezVousSessions: boolean
    rappelActions: boolean
    actualitesMilo: boolean
  }

  export interface AMettreAJour {
    pushNotificationToken?: string
    dateDerniereActualisationToken?: Date
    appVersion?: string
    installationId?: string
    instanceId?: string
    fuseauHoraire?: string
  }

  export interface Repository<T> {
    get(idJeune: string): Promise<T | undefined>

    save(configurationApplication: T): Promise<void>
  }

  @Injectable()
  export class FactoryJeune {
    constructor(private dateService: DateService) {}

    mettreAJour(
      configuration: ConfigurationApplicationJeune,
      aMettreAJour: AMettreAJour
    ): ConfigurationApplicationJeune {
      return {
        idJeune: configuration.idJeune,
        pushNotificationToken:
          aMettreAJour.pushNotificationToken ??
          configuration.pushNotificationToken,
        dateDerniereActualisationToken: aMettreAJour.pushNotificationToken
          ? this.dateService.nowJs()
          : configuration.dateDerniereActualisationToken,
        installationId:
          aMettreAJour.installationId ?? configuration.installationId,
        instanceId: aMettreAJour.instanceId ?? configuration.instanceId,
        appVersion: aMettreAJour.appVersion ?? configuration.appVersion,
        fuseauHoraire: aMettreAJour.fuseauHoraire ?? configuration.fuseauHoraire
      }
    }
  }

  @Injectable()
  export class FactoryInvite {
    constructor(private dateService: DateService) {}

    mettreAJour(
      configuration: ConfigurationApplicationInvite,
      aMettreAJour: AMettreAJour
    ): ConfigurationApplicationInvite {
      return {
        idJeune: configuration.idJeune,
        pushNotificationToken:
          aMettreAJour.pushNotificationToken ??
          configuration.pushNotificationToken,
        dateDerniereActivite: this.dateService.nowJs(),
        installationId:
          aMettreAJour.installationId ?? configuration.installationId,
        instanceId: aMettreAJour.instanceId ?? configuration.instanceId,
        appVersion: aMettreAJour.appVersion ?? configuration.appVersion,
        fuseauHoraire: aMettreAJour.fuseauHoraire ?? configuration.fuseauHoraire
      }
    }
  }
}
