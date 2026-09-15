// Fragments SQL partagés par les dépôts qui lisent les déploiements.

// Jointure du jeune `:paramIdJeune` vers son conseiller de référence : l'initial en cas de transfert temporaire, sinon le courant.
export function sqlJoinConseillerDeReferenceDuJeune(
  aliasJeune = 'j',
  aliasConseiller = 'c',
  paramIdJeune = 'idJeune'
): string {
  return `
    JOIN jeune ${aliasJeune} ON ${aliasJeune}.id = :${paramIdJeune}
    JOIN conseiller ${aliasConseiller} ON ${aliasConseiller}.id = COALESCE(${aliasJeune}.id_conseiller_initial, ${aliasJeune}.id_conseiller)`
}

// Le conseiller `aliasConseiller` est dans la population `idPopulation` (paramètre `:idPopulation` ou colonne `d.id_population`).
export function sqlConseillerDansPopulation(
  aliasConseiller: string,
  idPopulation: string
): string {
  return `(
    EXISTS (
      SELECT 1 FROM population_conseiller pc
      WHERE pc.id_population = ${idPopulation}
        AND pc.email_conseiller = ${aliasConseiller}.email
    )
    OR EXISTS (
      SELECT 1 FROM population_profil pp
      WHERE pp.id_population = ${idPopulation}
        AND pp.structure = ${aliasConseiller}.structure
        AND (pp.dispositif IS NULL OR pp.dispositif = ${aliasConseiller}.dispositif)
    )
  )`
}
