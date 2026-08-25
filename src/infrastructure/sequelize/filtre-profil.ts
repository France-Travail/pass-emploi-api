import { Op, WhereOptions } from 'sequelize'
import { ProfilAutorise } from '../../domain/profil'

// Matcher sans dispositifs ne contraint que la structure
export function filtreProfil(profil: ProfilAutorise): WhereOptions {
  if (profil.dispositifs === undefined) {
    return { structure: profil.structure }
  }
  return {
    structure: profil.structure,
    dispositif: { [Op.in]: [...profil.dispositifs] }
  }
}

export function filtreProfils(
  profils: readonly ProfilAutorise[]
): WhereOptions {
  return { [Op.or]: profils.map(filtreProfil) }
}

// Fragment SQL brut équivalent, pour les requêtes hors ORM.
export function clauseSqlProfils(
  profils: readonly ProfilAutorise[],
  alias = ''
): { clause: string; remplacements: Record<string, string[]> } {
  const prefixe = alias ? `${alias}.` : ''
  const branches: string[] = []
  const remplacements: Record<string, string[]> = {}
  profils.forEach((profil, index) => {
    if (profil.dispositifs === undefined) {
      branches.push(`${prefixe}structure = :profilStructure${index}`)
      remplacements[`profilStructure${index}`] = [profil.structure]
    } else {
      branches.push(
        `(${prefixe}structure = :profilStructure${index} AND ${prefixe}dispositif IN (:profilDispositifs${index}))`
      )
      remplacements[`profilStructure${index}`] = [profil.structure]
      remplacements[`profilDispositifs${index}`] = [...profil.dispositifs]
    }
  })
  return { clause: `(${branches.join(' OR ')})`, remplacements }
}
