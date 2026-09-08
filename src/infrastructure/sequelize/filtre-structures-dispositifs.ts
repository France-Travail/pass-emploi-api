import { Op, WhereOptions } from 'sequelize'
import { StructureEtDispositifs } from '../../domain/profil'

export function filtreStructureEtDispositifs(
  cible: StructureEtDispositifs
): WhereOptions {
  if (cible.dispositifs === undefined) {
    return { structure: cible.structure }
  }
  return {
    structure: cible.structure,
    dispositif: { [Op.in]: [...cible.dispositifs] }
  }
}

export function filtreStructuresEtDispositifs(
  cibles: readonly StructureEtDispositifs[]
): WhereOptions {
  return { [Op.or]: cibles.map(filtreStructureEtDispositifs) }
}

interface ClauseSql {
  clause: string
  remplacements: Record<string, string | string[]>
}

// Pour filtrer les structures et dispositifs dans une query SQL raw hors ORM
export function clauseSqlStructuresEtDispositifs(
  structuresEtDispositifs: readonly StructureEtDispositifs[],
  aliasTable = ''
): ClauseSql {
  const colonne = (nom: string): string =>
    aliasTable ? `${aliasTable}.${nom}` : nom

  const conditions = structuresEtDispositifs.map((cible, index) =>
    conditionSqlPourStructureEtDispositifs(cible, index, colonne)
  )

  return {
    clause: `(${conditions.map(condition => condition.clause).join(' OR ')})`,
    remplacements: Object.assign(
      {},
      ...conditions.map(condition => condition.remplacements)
    )
  }
}

function conditionSqlPourStructureEtDispositifs(
  structureEtDispositifs: StructureEtDispositifs,
  index: number,
  colonne: (nom: string) => string
): ClauseSql {
  const parametreStructure = `structure${index}`
  const parametreDispositifs = `dispositifs${index}`

  if (structureEtDispositifs.dispositifs === undefined) {
    return {
      clause: `${colonne('structure')} = :${parametreStructure}`,
      remplacements: { [parametreStructure]: structureEtDispositifs.structure }
    }
  }
  return {
    clause: `(${colonne('structure')} = :${parametreStructure} AND ${colonne('dispositif')} IN (:${parametreDispositifs}))`,
    remplacements: {
      [parametreStructure]: structureEtDispositifs.structure,
      [parametreDispositifs]: [...structureEtDispositifs.dispositifs]
    }
  }
}
