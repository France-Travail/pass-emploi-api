import { Injectable } from '@nestjs/common'
import { DateService } from '../../utils/date-service'

export const TIMEZONE_PAR_DEFAUT = 'Europe/Paris'

export interface ConfigurationApplication {
  idJeune: string
  pushNotificationToken?: string
  appVersion?: string
  installationId?: string
  instanceId?: string
  fuseauHoraire: string
  dateDerniereActivite?: Date
  preferences?: ConfigurationApplication.Preferences
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
    appVersion?: string
    installationId?: string
    instanceId?: string
    fuseauHoraire?: string
  }

  export interface Repository {
    get(idJeune: string): Promise<ConfigurationApplication | undefined>

    save(configurationApplication: ConfigurationApplication): Promise<void>
  }

  @Injectable()
  export class Factory {
    constructor(private readonly dateService: DateService) {}

    mettreAJour(
      configuration: ConfigurationApplication,
      aMettreAJour: AMettreAJour
    ): ConfigurationApplication {
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
