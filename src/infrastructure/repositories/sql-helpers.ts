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
function sqlEmailDuConseillerDansPopulation(
  aliasConseiller: string,
  idPopulation: string
): string {
  return `EXISTS (
    SELECT 1 FROM population_conseiller pc
    WHERE pc.id_population = ${idPopulation}
      AND pc.email_conseiller = ${aliasConseiller}.email
  )`
}

// Le profil structure × dispositif du conseiller `aliasConseiller` correspond à un profil de la population ; un profil sans dispositif couvre toute la structure.
function sqlProfilDansPopulation(
  aliasConseiller: string,
  idPopulation: string
): string {
  return `EXISTS (
    SELECT 1 FROM population_profil pp
    WHERE pp.id_population = ${idPopulation}
      AND pp.structure = ${aliasConseiller}.structure
      AND (pp.dispositif IS NULL OR pp.dispositif = ${aliasConseiller}.dispositif)
  )`
}

// Un conseiller est dans la population s'il est cité par email ou si son profil correspond. Un jeune y est si et seulement si son conseiller de référence y est : son propre profil n'est jamais regardé (un conseiller MiLo n'ayant pas de dispositif, (MILO, CEJ) ne vise personne).
export function sqlConseillerDansPopulation(
  aliasConseiller: string,
  idPopulation: string
): string {
  return `(${sqlEmailDuConseillerDansPopulation(aliasConseiller, idPopulation)} OR ${sqlProfilDansPopulation(aliasConseiller, idPopulation)})`
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

// Restreint le jeune `aliasJeune` déjà présent dans la requête aux destinataires d'une communication de la population `idPopulation`, via son conseiller de référence `aliasConseiller` ; si `push` est vrai, seulement ceux qui ont un token.
// Seule définition des jeunes destinataires : l'envoi, le décompte support et les analytics doivent trouver les mêmes.
export function sqlJoinJeunesDestinataires(
  aliasJeune: string,
  aliasConseiller: string,
  { idPopulation, push }: { idPopulation: string; push: string }
): string {
  return `
    ${sqlJoinConseillerDeReference(aliasJeune, aliasConseiller)}
    AND ${sqlConseillerDansPopulation(aliasConseiller, idPopulation)}
    AND (${push} IS NOT TRUE OR ${aliasJeune}.push_notification_token IS NOT NULL)`
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
