import { Authentification } from '../../domain/authentification'
import { Profil } from '../../domain/profil'
import { DroitsInsuffisants } from './domain-error'
import { emptySuccess, failure, Result } from './result'

export function verifierProfils(
  profilsAutorises: readonly Profil[],
  utilisateur: Authentification.Utilisateur | undefined
): Result {
  // Les tâches (`task.service.ts`) exécutent des handlers sans utilisateur :
  // il n'y a alors aucun public à contrôler.
  if (!utilisateur) {
    return emptySuccess()
  }

  if (!utilisateur.profil || !profilsAutorises.includes(utilisateur.profil)) {
    return failure(new DroitsInsuffisants())
  }
  return emptySuccess()
}
