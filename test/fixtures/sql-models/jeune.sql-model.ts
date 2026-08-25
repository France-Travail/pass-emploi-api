import { Core } from '../../../src/domain/core'
import { Profil, structureLegacyVersProfil } from '../../../src/domain/profil'
import { JeuneDto } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { AsSql } from '../../../src/infrastructure/sequelize/types'
import { uneDate, uneDatetime } from '../date.fixture'

// `structure` s'exprime en valeur legacy (12 valeurs) : la fixture la
// convertit vers les colonnes du modèle Profil (structure × dispositif).
type JeuneDtoArgs = Partial<Omit<AsSql<JeuneDto>, 'structure'>> & {
  structure?: Core.Structure
}

function colonnesProfil(
  structureLegacy: Core.Structure,
  dispositifConnu?: Profil.Dispositif | null
): { structure: Profil.Structure; dispositif: Profil.Dispositif | null } {
  const profil = structureLegacyVersProfil(structureLegacy)
  return {
    structure: profil.structure,
    dispositif: dispositifConnu ?? profil.dispositif
  }
}

export function unJeuneDto(args: JeuneDtoArgs = {}): AsSql<JeuneDto> {
  const structureLegacy = args.structure ?? Core.Structure.MILO
  const { structure: _structure, dispositif: _dispositif, ...reste } = args
  const couple = colonnesProfil(
    structureLegacy,
    args.dispositif !== undefined
      ? args.dispositif
      : structureLegacy === Core.Structure.MILO
        ? Profil.Dispositif.CEJ
        : undefined
  )
  const defaults: AsSql<JeuneDto> = {
    id: 'ABCDE',
    prenom: 'John',
    nom: 'Doe',
    idConseiller: '1',
    idConseillerInitial: undefined,
    dateCreation: new Date('2021-11-11T08:03:30.000Z'),
    datePremiereConnexion: new Date('2021-11-11T08:03:30.000Z'),
    dateFinCEJ: null,
    pushNotificationToken: 'token',
    dateDerniereActivite: uneDate(),
    email: 'john.doe@plop.io',
    ...couple,
    idAuthentification: 'un-id',
    dateDerniereConnexion: uneDatetime().toJSDate(),
    idPartenaire: '1234',
    appVersion: '1.8.1',
    installationId: '123456',
    instanceId: 'abcdef',
    partageFavoris: true,
    notificationsAlertesOffres: true,
    notificationsMessages: true,
    notificationsCreationActionConseiller: true,
    notificationsRendezVousSessions: true,
    notificationsRappelActions: true,
    notificationsActualitesMilo: true,
    timezone: 'Europe/Paris',
    idStructureMilo: null,
    dateSignatureCGU: null,
    peutVoirLeComptageDesHeures: null
  }

  return { ...defaults, ...reste }
}

export function unJeuneMiloDto(
  jeuneDto: AsSql<JeuneDto>,
  idStructureMilo: string
): AsSql<JeuneDto> {
  return { ...jeuneDto, idStructureMilo: idStructureMilo }
}
