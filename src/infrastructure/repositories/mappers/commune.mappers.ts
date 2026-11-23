export namespace Commune {
  const ARRONDISSEMENTS_PARIS: Record<string, string> = {
    '75001': '75101',
    '75002': '75102',
    '75003': '75103',
    '75004': '75104',
    '75005': '75105',
    '75006': '75106',
    '75007': '75107',
    '75008': '75108',
    '75009': '75109',
    '75010': '75110',
    '75011': '75111',
    '75012': '75112',
    '75013': '75113',
    '75014': '75114',
    '75015': '75115',
    '75016': '75116',
    '75017': '75117',
    '75018': '75118',
    '75019': '75119',
    '75020': '75120',
    '75116': '75116'
  }

  const ARRONDISSEMENTS_LYON: Record<string, string> = {
    '69001': '69381',
    '69002': '69382',
    '69003': '69383',
    '69004': '69384',
    '69005': '69385',
    '69006': '69386',
    '69007': '69387',
    '69008': '69388',
    '69009': '69389'
  }

  const ARRONDISSEMENTS_MARSEILLE: Record<string, string> = {
    '13001': '13201',
    '13002': '13202',
    '13003': '13203',
    '13004': '13204',
    '13005': '13205',
    '13006': '13206',
    '13007': '13207',
    '13008': '13208',
    '13009': '13209',
    '13010': '13210',
    '13011': '13211',
    '13012': '13212',
    '13013': '13213',
    '13014': '13214',
    '13015': '13215',
    '13016': '13216'
  }

  const ARRONDISSEMENTS_PAR_VILLE: Record<string, Record<string, string>> = {
    '75056': ARRONDISSEMENTS_PARIS,
    '69123': ARRONDISSEMENTS_LYON,
    '13055': ARRONDISSEMENTS_MARSEILLE
  }

  export function codeInseeArrondissement(
    codeInsee: string,
    codePostal: string
  ): string | undefined {
    const arrondissements = ARRONDISSEMENTS_PAR_VILLE[codeInsee]
    if (!arrondissements) return codeInsee
    return arrondissements[codePostal]
  }
}
