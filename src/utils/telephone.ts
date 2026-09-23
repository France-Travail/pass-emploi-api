// Indicatif international par préfixe national (3 chiffres après le 0) des
// départements et collectivités d'outre-mer. Immersion Facile valide les
// numéros « en France » : un numéro d'outre-mer au format national (0692…)
// est refusé alors qu'il passe en E.164 (+262692…).
const INDICATIF_PAR_PREFIXE_OUTRE_MER: Record<string, string> = {
  // Guadeloupe, Saint-Barthélemy, Saint-Martin
  '590': '590',
  '690': '590',
  '691': '590',
  // Martinique
  '596': '596',
  '696': '596',
  '697': '596',
  // Guyane
  '594': '594',
  '694': '594',
  // La Réunion
  '262': '262',
  '263': '262',
  '692': '262',
  '693': '262',
  // Mayotte
  '269': '262',
  '639': '262'
}

export function nettoyerNumeroTelephone(numero: string): string {
  return numero.replace(/[\s.-]/g, '')
}

/**
 * Retire les séparateurs, convertit le préfixe 00 en +, et passe les numéros
 * d'outre-mer saisis au format national en E.164. Les numéros de métropole
 * sont laissés au format national.
 */
export function normaliserNumeroTelephone(numero: string): string {
  const numeroNettoye = nettoyerNumeroTelephone(numero)
  if (numeroNettoye.startsWith('00')) return `+${numeroNettoye.slice(2)}`
  if (!/^0[0-9]{9}$/.test(numeroNettoye)) return numeroNettoye

  const indicatif = INDICATIF_PAR_PREFIXE_OUTRE_MER[numeroNettoye.slice(1, 4)]
  return indicatif ? `+${indicatif}${numeroNettoye.slice(1)}` : numeroNettoye
}
