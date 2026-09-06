import { AsSql } from '../../../src/infrastructure/sequelize/types'
import { AgenceDto } from '../../../src/infrastructure/sequelize/models/agence.sql-model'
import { Profil } from '../../../src/domain/profil'

export function uneAgenceMiloDto(
  args: Partial<AsSql<AgenceDto>> = {}
): AsSql<AgenceDto> {
  const defaults: AsSql<AgenceDto> = {
    id: '1',
    nomAgence: 'Mission Locale Aubenas',
    nomUsuel: 'Mission Locale Aubenas',
    nomDepartement: null,
    codeDepartement: '07',
    structure: Profil.Structure.MILO,
    nomRegion: 'Auvergne-Rhône-Alpes',
    codeRegion: null,
    timezone: 'Europe/Paris'
  }

  return { ...defaults, ...args }
}

export function uneAgenceDto(
  args: Partial<AsSql<AgenceDto>> = {}
): AsSql<AgenceDto> {
  const defaults: AsSql<AgenceDto> = {
    id: '1',
    nomAgence: 'Nice',
    nomUsuel: 'Nice',
    nomDepartement: null,
    codeDepartement: '6',
    structure: Profil.Structure.FRANCE_TRAVAIL,
    nomRegion: 'PACA',
    codeRegion: null,
    timezone: 'Europe/Paris'
  }

  return { ...defaults, ...args }
}
