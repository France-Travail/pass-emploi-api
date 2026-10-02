'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE INDEX conseiller_email_idx ON conseiller (email)'
    )
    await queryInterface.sequelize.query(
      'CREATE INDEX conseiller_id_agence_idx ON conseiller (id_agence)'
    )
    await queryInterface.sequelize.query(
      'CREATE INDEX conseiller_id_structure_milo_idx ON conseiller (id_structure_milo)'
    )
    await queryInterface.sequelize.query(
      'CREATE INDEX conseiller_structure_dispositif_idx ON conseiller (structure, dispositif)'
    )
    await queryInterface.sequelize.query(
      'CREATE INDEX jeune_conseiller_de_reference_idx ON jeune ((COALESCE(id_conseiller_initial, id_conseiller)))'
    )

    await queryInterface.sequelize.query(`
      CREATE VIEW appartenance_population_conseiller AS
      -- UNION (pas ALL) : dédoublonne un conseiller visé par plusieurs critères.
      -- Chaque branche part de la population, donc un petit ciblage ne lit que ses conseillers.
      SELECT pc.id_population, c.id AS id_conseiller
      FROM population_conseiller pc JOIN conseiller c ON c.email = pc.email_conseiller
      UNION
      SELECT pp.id_population, c.id
      FROM population_profil pp JOIN conseiller c ON c.structure = pp.structure
       AND (pp.dispositif IS NULL OR c.dispositif = pp.dispositif)
      UNION
      SELECT psm.id_population, c.id
      FROM population_structure_milo psm JOIN conseiller c ON c.id_structure_milo = psm.id_structure_milo
      UNION
      SELECT pa.id_population, c.id
      FROM population_agence_ft pa JOIN conseiller c ON c.id_agence = pa.id_agence
       AND (pa.dispositifs IS NULL OR c.dispositif = ANY (pa.dispositifs))
    `)

    await queryInterface.sequelize.query(`
      CREATE VIEW appartenance_population_jeune AS
      -- « À plat » (D5) : chaque critère joint directement le jeune via son conseiller de
      -- référence. Mêmes critères que la vue conseiller, écrits une seconde fois : le test
      -- de contrat garantit qu'ils concordent. UNION dédoublonne (id_population, id_jeune).
      SELECT pc.id_population, j.id AS id_jeune
      FROM population_conseiller pc
      JOIN conseiller c ON c.email = pc.email_conseiller
      JOIN jeune j ON COALESCE(j.id_conseiller_initial, j.id_conseiller) = c.id
      UNION
      SELECT pp.id_population, j.id
      FROM population_profil pp
      JOIN conseiller c ON c.structure = pp.structure
       AND (pp.dispositif IS NULL OR c.dispositif = pp.dispositif)
      JOIN jeune j ON COALESCE(j.id_conseiller_initial, j.id_conseiller) = c.id
      UNION
      SELECT psm.id_population, j.id
      FROM population_structure_milo psm
      JOIN conseiller c ON c.id_structure_milo = psm.id_structure_milo
      JOIN jeune j ON COALESCE(j.id_conseiller_initial, j.id_conseiller) = c.id
      UNION
      SELECT pa.id_population, j.id
      FROM population_agence_ft pa
      JOIN conseiller c ON c.id_agence = pa.id_agence
       AND (pa.dispositifs IS NULL OR c.dispositif = ANY (pa.dispositifs))
      JOIN jeune j ON COALESCE(j.id_conseiller_initial, j.id_conseiller) = c.id
      UNION
      -- non accompagné : son propre profil
      SELECT pp.id_population, j.id
      FROM population_profil pp
      JOIN jeune j ON j.structure = pp.structure
       AND (pp.dispositif IS NULL OR pp.dispositif = j.dispositif)
      WHERE COALESCE(j.id_conseiller_initial, j.id_conseiller) IS NULL
    `)
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP VIEW IF EXISTS appartenance_population_jeune'
    )
    await queryInterface.sequelize.query(
      'DROP VIEW IF EXISTS appartenance_population_conseiller'
    )
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS jeune_conseiller_de_reference_idx'
    )
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS conseiller_structure_dispositif_idx'
    )
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS conseiller_id_structure_milo_idx'
    )
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS conseiller_id_agence_idx'
    )
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS conseiller_email_idx'
    )
  }
}
