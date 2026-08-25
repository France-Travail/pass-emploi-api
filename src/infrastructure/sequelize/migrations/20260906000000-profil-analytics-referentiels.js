'use strict'

// Fin du legacy hors frontières : la capture analytics (evenement_engagement_hebdo,
// feedback), l'archive des jeunes et le référentiel des agences passent au modèle
// Profil (structure × dispositif). La structure legacy ne survit plus que sur le
// fil (claim `userStructure`, entrées/sorties d'API) où elle est recalculée par codec.
// Les valeurs hors modèle (ex. 'PASS_EMPLOI' du support) sont conservées telles quelles.

const STRUCTURES_LEGACY_FT = `('POLE_EMPLOI', 'POLE_EMPLOI_BRSA', 'POLE_EMPLOI_AIJ', 'AVENIR_PRO',
  'FT_ACCOMPAGNEMENT_INTENSIF', 'FT_ACCOMPAGNEMENT_GLOBAL', 'FT_EQUIP_EMPLOI_RECRUT',
  'FT_DEMANDEUR_D_EMPLOI', 'FT_ESPACE_CANDIDAT')`

const VERS_DISPOSITIF_DEPUIS_STRUCTURE = `
  CASE structure
    WHEN 'POLE_EMPLOI' THEN 'CEJ'
    WHEN 'POLE_EMPLOI_BRSA' THEN 'BRSA'
    WHEN 'POLE_EMPLOI_AIJ' THEN 'AIJ'
    WHEN 'AVENIR_PRO' THEN 'AVENIR_PRO'
    WHEN 'FT_ACCOMPAGNEMENT_INTENSIF' THEN 'ACCOMPAGNEMENT_INTENSIF'
    WHEN 'FT_ACCOMPAGNEMENT_GLOBAL' THEN 'ACCOMPAGNEMENT_GLOBAL'
    WHEN 'FT_EQUIP_EMPLOI_RECRUT' THEN 'EQUIP_EMPLOI_RECRUT'
    WHEN 'FT_DEMANDEUR_D_EMPLOI' THEN 'DEMANDEUR_D_EMPLOI'
    WHEN 'FT_ESPACE_CANDIDAT' THEN 'ESPACE_CANDIDAT'
    ELSE NULL
  END`

const VERS_STRUCTURE = `
  CASE
    WHEN structure = 'CONSEIL_DEPT' THEN 'CONSEIL_DEPARTEMENTAL'
    WHEN structure IN ${STRUCTURES_LEGACY_FT} THEN 'FRANCE_TRAVAIL'
    ELSE structure
  END`

const VERS_STRUCTURE_LEGACY = `
  CASE
    WHEN structure = 'CONSEIL_DEPARTEMENTAL' THEN 'CONSEIL_DEPT'
    WHEN structure = 'FRANCE_TRAVAIL' THEN
      CASE dispositif
        WHEN 'CEJ' THEN 'POLE_EMPLOI'
        WHEN 'BRSA' THEN 'POLE_EMPLOI_BRSA'
        WHEN 'AIJ' THEN 'POLE_EMPLOI_AIJ'
        WHEN 'AVENIR_PRO' THEN 'AVENIR_PRO'
        WHEN 'ACCOMPAGNEMENT_INTENSIF' THEN 'FT_ACCOMPAGNEMENT_INTENSIF'
        WHEN 'ACCOMPAGNEMENT_GLOBAL' THEN 'FT_ACCOMPAGNEMENT_GLOBAL'
        WHEN 'EQUIP_EMPLOI_RECRUT' THEN 'FT_EQUIP_EMPLOI_RECRUT'
        WHEN 'DEMANDEUR_D_EMPLOI' THEN 'FT_DEMANDEUR_D_EMPLOI'
        WHEN 'ESPACE_CANDIDAT' THEN 'FT_ESPACE_CANDIDAT'
        ELSE 'POLE_EMPLOI'
      END
    ELSE structure
  END`

const TABLES_DE_CAPTURE = ['evenement_engagement_hebdo', 'feedback']

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const table of TABLES_DE_CAPTURE) {
        await queryInterface.addColumn(
          table,
          'dispositif',
          { type: Sequelize.STRING, allowNull: true },
          { transaction }
        )
        await queryInterface.sequelize.query(
          `UPDATE ${table} SET dispositif = ${VERS_DISPOSITIF_DEPUIS_STRUCTURE}`,
          { transaction }
        )
        await queryInterface.sequelize.query(
          `UPDATE ${table} SET structure = ${VERS_STRUCTURE}`,
          { transaction }
        )
      }

      // archive_jeune : le dispositif existait déjà (valeurs du modèle Profil,
      // ou 'CONSEIL_DEPT' redondant, ou NULL pour les archives anciennes).
      await queryInterface.sequelize.query(
        `UPDATE archive_jeune SET dispositif = ${VERS_DISPOSITIF_DEPUIS_STRUCTURE}
         WHERE dispositif IS NULL OR dispositif = 'CONSEIL_DEPT'`,
        { transaction }
      )
      await queryInterface.sequelize.query(
        `UPDATE archive_jeune SET structure = ${VERS_STRUCTURE}`,
        { transaction }
      )

      await queryInterface.sequelize.query(
        `UPDATE agence SET structure = 'FRANCE_TRAVAIL' WHERE structure = 'POLE_EMPLOI'`,
        { transaction }
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        `UPDATE agence SET structure = 'POLE_EMPLOI' WHERE structure = 'FRANCE_TRAVAIL'`,
        { transaction }
      )

      await queryInterface.sequelize.query(
        `UPDATE archive_jeune SET structure = ${VERS_STRUCTURE_LEGACY}`,
        { transaction }
      )
      await queryInterface.sequelize.query(
        `UPDATE archive_jeune
         SET dispositif = CASE
           WHEN structure = 'CONSEIL_DEPT' THEN 'CONSEIL_DEPT'
           WHEN dispositif IN ('DEMANDEUR_D_EMPLOI', 'ESPACE_CANDIDAT') THEN NULL
           ELSE dispositif
         END`,
        { transaction }
      )

      for (const table of TABLES_DE_CAPTURE) {
        await queryInterface.sequelize.query(
          `UPDATE ${table} SET structure = ${VERS_STRUCTURE_LEGACY}`,
          { transaction }
        )
        await queryInterface.removeColumn(table, 'dispositif', { transaction })
      }
    })
  }
}
