import { UtilisateurQueryModel } from '../../../src/application/queries/query-models/authentification.query-model'
import { Authentification } from '../../../src/domain/authentification'
import { Core } from '../../../src/domain/core'
import { Profil, structureLegacyVersProfil } from '../../../src/domain/profil'
import { unProfilFT } from '../profil.fixture'

export function unUtilisateurQueryModel(
  overrides: Partial<UtilisateurQueryModel> = {}
): UtilisateurQueryModel {
  const structure = overrides.structure ?? Core.Structure.MILO
  const defaults: UtilisateurQueryModel = {
    id: '1',
    nom: 'Tavernier',
    prenom: 'Nils',
    type: Authentification.Type.CONSEILLER,
    email: 'nils.tavernier@passemploi.com',
    structure,
    profil: structureLegacyVersProfil(structure),
    roles: [],
    username: undefined
  }
  return { ...defaults, ...overrides }
}

export const unUtilisateurSansEmailQueryModel = (): UtilisateurQueryModel =>
  unUtilisateurQueryModel({
    email: undefined
  })

export const unUtilisateurBRSAQueryModel = (): UtilisateurQueryModel =>
  unUtilisateurQueryModel({
    structure: Core.Structure.POLE_EMPLOI_BRSA,
    profil: unProfilFT(Profil.Dispositif.BRSA)
  })

export const unUtilisateurAIJQueryModel = (): UtilisateurQueryModel =>
  unUtilisateurQueryModel({
    structure: Core.Structure.POLE_EMPLOI_AIJ,
    profil: unProfilFT(Profil.Dispositif.AIJ)
  })
