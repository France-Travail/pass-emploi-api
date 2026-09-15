// Fragments SQL partagés par les dépôts qui lisent les déploiements.

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

// Un conseiller est dans la population s'il est cité par email ou si son propre profil correspond.
export function sqlConseillerDansPopulation(
  aliasConseiller: string,
  idPopulation: string
): string {
  return `(${sqlEmailDuConseillerDansPopulation(aliasConseiller, idPopulation)} OR ${sqlProfilDansPopulation(aliasConseiller, idPopulation)})`
}

// Un jeune est dans la population si son conseiller de référence est cité par email ou si son propre profil correspond.
export function sqlJeuneDansPopulation(
  aliasJeune: string,
  aliasConseillerDeReference: string,
  idPopulation: string
): string {
  return `(${sqlEmailDuConseillerDansPopulation(aliasConseillerDeReference, idPopulation)} OR ${sqlProfilDansPopulation(aliasJeune, idPopulation)})`
}
