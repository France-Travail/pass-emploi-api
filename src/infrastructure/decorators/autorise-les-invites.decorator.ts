import { CustomDecorator, SetMetadata } from '@nestjs/common'

/**
 * Ouvre une route au mode invité.
 *
 * Sans ce décorateur, `OidcAuthGuard` refuse tout utilisateur de structure
 * INVITE : les routes sont fermées par défaut. La règle est ainsi portée par le
 * contrôleur — lisible route par route — plutôt que par le fait qu'un invité
 * soit absent de la table `jeune` et fasse donc échouer la lecture d'un
 * authorizer.
 */
export const AUTORISE_LES_INVITES_KEY = 'autoriseLesInvites'
export const AutoriseLesInvites = (): CustomDecorator<string> =>
  SetMetadata(AUTORISE_LES_INVITES_KEY, true)
