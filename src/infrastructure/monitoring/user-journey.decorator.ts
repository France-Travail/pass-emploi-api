import { SetMetadata } from '@nestjs/common'

export const USER_JOURNEY_METADATA = 'user_journey'

// Les valeurs sont filtrées telles quelles par les SLO Kibana
// (labels.user_journey) : renommer un parcours casse son SLO.
export type Parcours =
  | 'accueil_jeune_france_travail'
  | 'accueil_jeune_milo'
  | 'actualites'
  | 'agenda'
  | 'agenda_france_travail'
  | 'animations_collectives'
  | 'authentification'
  | 'campagnes'
  | 'compte_jeune'
  | 'compte_jeune_france_travail'
  | 'configuration_application'
  | 'creation_jeune'
  | 'creation_jeune_france_travail'
  | 'creation_jeune_milo'
  | 'creation_rendez_vous'
  | 'delete_plan_action_tache'
  | 'diagoriente'
  | 'evenement_engagement'
  | 'evenements_emploi'
  | 'favoris'
  | 'invitation_jeune'
  | 'messagerie'
  | 'mon_suivi_france_travail'
  | 'mon_suivi_milo'
  | 'notifications'
  | 'plan_action'
  | 'portefeuille_conseiller'
  | 'qualification_actions'
  | 'questionnaire'
  | 'recherche_offres'
  | 'recherches_sauvegardees'
  | 'referentiels'
  | 'rendez_vous'
  | 'reprise_invite'
  | 'sessions_milo'
  | 'suivi_actions'
  | 'suivi_demarches'
  | 'support'
  | 'update_plan_action_tache'

export const UserJourney = (
  journey: Parcours
): ClassDecorator & MethodDecorator =>
  SetMetadata(USER_JOURNEY_METADATA, journey)
