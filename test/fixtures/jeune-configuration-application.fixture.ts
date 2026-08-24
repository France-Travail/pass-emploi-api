import { Jeune } from '../../src/domain/jeune/jeune'

export const uneJeuneConfigurationApplication = (
  args: Partial<Jeune.ConfigurationApplication> = {}
): Jeune.ConfigurationApplication => {
  const defaults = {
    idJeune: 'ABCDE',
    pushNotificationToken: 'unToken',
    installationId: 'uneInstallationId',
    instanceId: 'uneInstanceId',
    appVersion: 'uneAppVersion',
    fuseauHoraire: 'Europe/Paris'
  }
  return { ...defaults, ...args }
}
