import { JeuneInviteDto } from '../../../src/infrastructure/sequelize/models/jeune-invite.sql-model'
import { AsSql } from '../../../src/infrastructure/sequelize/types'
import { uneDate, uneDatetime } from '../date.fixture'

export function unJeuneInviteDto(
  args: Partial<AsSql<JeuneInviteDto>> = {}
): AsSql<JeuneInviteDto> {
  const defaults: AsSql<JeuneInviteDto> = {
    id: 'INVITE-ID',
    idAuthentification: 'un-sub-invite',
    prenom: 'Invité',
    dateCreation: new Date('2021-11-11T08:03:30.000Z'),
    datePremiereConnexion: new Date('2021-11-11T08:03:30.000Z'),
    dateDerniereConnexion: uneDatetime().toJSDate(),
    pushNotificationToken: null,
    dateDerniereActualisationToken: uneDate(),
    appVersion: '1.8.1',
    installationId: '123456',
    instanceId: 'abcdef',
    timezone: 'Europe/Paris',
    dateSignatureCGU: null
  }

  return { ...defaults, ...args }
}
