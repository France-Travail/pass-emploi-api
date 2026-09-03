import { remove as enleverLesAccents } from 'remove-accents'
import { Op } from 'sequelize'
import { AgenceFTDto } from '../../infrastructure/clients/dto/pole-emploi.dto'
import { CommuneSqlModel } from '../../infrastructure/sequelize/models/commune.sql-model'
import { DepartementSqlModel } from '../../infrastructure/sequelize/models/departement.sql-model'
import { RegionSqlModel } from '../../infrastructure/sequelize/models/region.sql-model'

const PREFIXES = [
  'AGENCE SPECIALISEE POLE EMPLOI ',
  'AGENCE SPECIALISEE FRANCE TRAVAIL ',
  'RELAI POLE EMPLOI ',
  'RELAI FRANCE TRAVAIL ',
  'AGENCE POLE EMPLOI ',
  'AGENCE FRANCE TRAVAIL '
]

export function normaliserNomAgence(nom: string): string {
  let normalise = enleverLesAccents(nom)
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

  const prefixe = PREFIXES.find(p => normalise.startsWith(p))
  if (prefixe) normalise = normalise.slice(prefixe.length)
  if (normalise.startsWith('RPE ')) normalise = normalise.slice(4)

  return normalise.replace(/\bSAINTE\b/g, 'STE').replace(/\bSAINT\b/g, 'ST')
}

export function normaliserDepartement(code: string | undefined | null): string {
  if (!code) return '??'
  if (code === '2A' || code === '2B' || code === '20') return '20'
  return code.length === 1 ? `0${code}` : code
}

export function pousser<T>(
  map: Map<string, T[]>,
  cle: string,
  valeur: T
): void {
  const existants = map.get(cle)
  if (existants) existants.push(valeur)
  else map.set(cle, [valeur])
}

export async function chargerDepartementParCommune(
  agencesFT: AgenceFTDto[]
): Promise<Map<string, string>> {
  const codes = agencesFT.map(a => a.adressePrincipale.communeImplantation)
  const communes = await CommuneSqlModel.findAll({
    where: { code: { [Op.in]: codes } },
    attributes: ['code', 'codeDepartement']
  })
  return new Map(communes.map(c => [c.code, c.codeDepartement]))
}

export async function chargerLibelleParCodeRegion(): Promise<
  Map<string, string>
> {
  const regions = await RegionSqlModel.findAll()
  return new Map(regions.map(r => [r.code, r.libelle]))
}

export async function chargerRegionParDepartement(): Promise<
  Map<string, string>
> {
  const departements = await DepartementSqlModel.findAll({
    attributes: ['code', 'codeRegion']
  })
  return new Map(departements.map(d => [d.code, d.codeRegion]))
}
