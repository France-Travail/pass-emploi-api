import { Core } from '../../../src/domain/core'
import { Profil, structureLegacyVersProfil } from '../../../src/domain/profil'
import { ConseillerDto } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { AsSql } from '../../../src/infrastructure/sequelize/types'
import { uneDatetime } from '../date.fixture'

// `structure` s'exprime en valeur legacy (12 valeurs) : la fixture la
// convertit vers les colonnes du modèle Profil (structure × dispositif).
type ConseillerDtoArgs = Partial<Omit<AsSql<ConseillerDto>, 'structure'>> & {
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

export function unConseillerDto(
  args: ConseillerDtoArgs = {}
): AsSql<ConseillerDto> {
  const { structure: _structure, dispositif: _dispositif, ...reste } = args
  const couple = colonnesProfil(
    args.structure ?? Core.Structure.MILO,
    args.dispositif
  )
  const defaults: AsSql<ConseillerDto> = {
    id: '1',
    prenom: 'Nils',
    nom: 'Tavernier',
    email: 'nils.tavernier@passemploi.com',
    ...couple,
    idAuthentification: 'un-id',
    dateCreation: uneDatetime().toJSDate(),
    dateVerificationMessages: uneDatetime().toJSDate(),
    dateDerniereConnexion: null,
    dateSignatureCGU: null,
    dateVisionnageActus: null,
    dateVerificationStructureMilo: null,
    idAgence: null,
    nomManuelAgence: null,
    notificationsSonores: false,
    idStructureMilo: null,
    username: null
  }

  return { ...defaults, ...reste }
}

export function unConseillerMiloDto(
  conseillerDto: AsSql<ConseillerDto>,
  idStructureMilo: string
): AsSql<ConseillerDto> {
  return { ...conseillerDto, idStructureMilo: idStructureMilo }
}
