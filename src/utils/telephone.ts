// Immersion Facile refuse les numéros d'outre-mer au format national, pas en E.164
const INDICATIF_PAR_PREFIXE_OUTRE_MER: Record<string, string> = {
  '590': '590', // Guadeloupe, Saint-Barthélemy, Saint-Martin
  '690': '590',
  '691': '590',
  '596': '596', // Martinique
  '696': '596',
  '697': '596',
  '594': '594', // Guyane
  '694': '594',
  '262': '262', // La Réunion
  '263': '262',
  '692': '262',
  '693': '262',
  '269': '262', // Mayotte
  '639': '262'
}

export function nettoyerNumeroTelephone(numero: string): string {
  return numero.replace(/[\s.-]/g, '')
}

export function normaliserNumeroTelephone(numero: string): string {
  const numeroNettoye = nettoyerNumeroTelephone(numero)
  if (numeroNettoye.startsWith('00')) return `+${numeroNettoye.slice(2)}`
  if (!/^0\d{9}$/.test(numeroNettoye)) return numeroNettoye // métropole en national

  const indicatif = INDICATIF_PAR_PREFIXE_OUTRE_MER[numeroNettoye.slice(1, 4)]
  return indicatif ? `+${indicatif}${numeroNettoye.slice(1)}` : numeroNettoye
}
