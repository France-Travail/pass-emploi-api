// Fragments SQL partagés par les dépôts qui lisent les populations, communications et déploiements.
import { Communication } from '../../domain/communication'

// Jointure vers le conseiller de référence du jeune déjà présent dans la requête : l'initial en cas de transfert temporaire, sinon le courant.
export function sqlJoinConseillerDeReference(
  aliasJeune = 'j',
  aliasConseiller = 'c'
): string {
  return `
    JOIN conseiller ${aliasConseiller} ON ${aliasConseiller}.id = COALESCE(${aliasJeune}.id_conseiller_initial, ${aliasJeune}.id_conseiller)`
}

// Jointure du jeune `:paramIdJeune` vers son conseiller de référence.
export function sqlJoinConseillerDeReferenceDuJeune(
  aliasJeune = 'j',
  aliasConseiller = 'c',
  paramIdJeune = 'idJeune'
): string {
  return `
    JOIN jeune ${aliasJeune} ON ${aliasJeune}.id = :${paramIdJeune}
    ${sqlJoinConseillerDeReference(aliasJeune, aliasConseiller)}`
}

// L'email du conseiller `aliasConseiller` est cité dans la population `idPopulation` (paramètre `:idPopulation` ou colonne `d.id_population`).
export function sqlEmailDuConseillerDansPopulation(
  aliasConseiller: string,
  idPopulation: string
): string {
  return `EXISTS (
    SELECT 1 FROM population_conseiller pc
    WHERE pc.id_population = ${idPopulation}
      AND pc.email_conseiller = ${aliasConseiller}.email
  )`
}

// Le profil structure × dispositif de `aliasPorteur` (jeune ou conseiller) correspond à un profil de la population ; un profil sans dispositif couvre toute la structure.
export function sqlProfilDansPopulation(
  aliasPorteur: string,
  idPopulation: string
): string {
  return `EXISTS (
    SELECT 1 FROM population_profil pp
    WHERE pp.id_population = ${idPopulation}
      AND pp.structure = ${aliasPorteur}.structure
      AND (pp.dispositif IS NULL OR pp.dispositif = ${aliasPorteur}.dispositif)
  )`
}

// La structure MiLo de `aliasPorteur` (jeune ou conseiller) est citée dans la population.
export function sqlStructureMiloDansPopulation(
  aliasPorteur: string,
  idPopulation: string
): string {
  return `EXISTS (
    SELECT 1 FROM population_structure_milo psm
    WHERE psm.id_population = ${idPopulation}
      AND psm.id_structure_milo = ${aliasPorteur}.id_structure_milo
  )`
}

// L'agence du conseiller `aliasConseiller` est citée dans la population ; un jeune n'a pas d'agence, il passe par son conseiller de référence.
export function sqlAgenceDuConseillerDansPopulation(
  aliasConseiller: string,
  idPopulation: string
): string {
  return `EXISTS (
    SELECT 1 FROM population_agence_ft pa
    WHERE pa.id_population = ${idPopulation}
      AND pa.id_agence = ${aliasConseiller}.id_agence
  )`
}

// Un conseiller est dans la population s'il est cité par email, si son propre profil correspond, ou si sa structure MiLo ou son agence est citée.
export function sqlConseillerDansPopulation(
  aliasConseiller: string,
  idPopulation: string
): string {
  return `(${sqlEmailDuConseillerDansPopulation(aliasConseiller, idPopulation)}
    OR ${sqlProfilDansPopulation(aliasConseiller, idPopulation)}
    OR ${sqlStructureMiloDansPopulation(aliasConseiller, idPopulation)}
    OR ${sqlAgenceDuConseillerDansPopulation(aliasConseiller, idPopulation)})`
}

// Un jeune est dans la population si son propre profil ou sa propre structure MiLo correspond, ou si son conseiller de référence est cité par email ou par son agence.
export function sqlJeuneDansPopulation(
  aliasJeune: string,
  aliasConseillerDeReference: string,
  idPopulation: string
): string {
  return `(${sqlEmailDuConseillerDansPopulation(aliasConseillerDeReference, idPopulation)}
    OR ${sqlProfilDansPopulation(aliasJeune, idPopulation)}
    OR ${sqlStructureMiloDansPopulation(aliasJeune, idPopulation)}
    OR ${sqlAgenceDuConseillerDansPopulation(aliasConseillerDeReference, idPopulation)})`
}

// Jointure de la communication `aliasCom` vers les conseillers qui en sont destinataires. Même jointure côté fonctionnalité (filtrée sur un conseiller) et côté analytics (exhaustive).
export function sqlJoinConseillersDestinataires(
  aliasCom: string,
  aliasConseiller: string
): string {
  return `
    JOIN conseiller ${aliasConseiller}
      ON ${aliasCom}.destinataire = '${Communication.Destinataire.CONSEILLER}'
     AND ${sqlConseillerDansPopulation(aliasConseiller, `${aliasCom}.id_population`)}`
}

// Visible entre date_debut (incluse) et date_fin (exclue) ; sans date_fin, visible indéfiniment.
export function sqlCommunicationEnCours(
  aliasCom: string,
  maintenant: string
): string {
  return `(${aliasCom}.date_debut <= ${maintenant} AND (${aliasCom}.date_fin IS NULL OR ${maintenant} < ${aliasCom}.date_fin))`
}

// Jointure du déploiement `aliasDep` vers les conseillers de sa population.
export function sqlJoinConseillersConcernes(
  aliasDep: string,
  aliasConseiller: string
): string {
  return `
    JOIN conseiller ${aliasConseiller}
      ON ${sqlConseillerDansPopulation(aliasConseiller, `${aliasDep}.id_population`)}`
}

export function sqlDeploiementActif(
  aliasDep: string,
  maintenant: string
): string {
  return `${aliasDep}.date_activation <= ${maintenant}`
}
