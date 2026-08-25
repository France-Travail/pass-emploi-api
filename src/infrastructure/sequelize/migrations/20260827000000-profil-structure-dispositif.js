'use strict'

// Bascule vers le modèle Profil (structure × dispositif) :
// - `structure` passe des 12 valeurs legacy aux 4 organisations
//   (MILO / FRANCE_TRAVAIL / CONSEIL_DEPARTEMENTAL / INVITE) ;
// - `dispositif` porte le reste (BRSA, AIJ, DEMANDEUR_D_EMPLOI…), NULL pour
//   le Conseil départemental, les invités et les conseillers MiLo.
// Le format legacy reste celui du fil (claim `userStructure`) et de
// l'analytics : il est recalculé par codec (src/domain/profil.ts) côté API
// et reconstruit par l'ELT côté base analytics. Mapping bijectif : le down
// restaure exactement l'état antérieur.

const VERS_STRUCTURE = `
  CASE structure
    WHEN 'MILO' THEN 'MILO'
    WHEN 'INVITE' THEN 'INVITE'
    WHEN 'CONSEIL_DEPT' THEN 'CONSEIL_DEPARTEMENTAL'
    ELSE 'FRANCE_TRAVAIL'
  END`

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

// Repli 4 + dispositif → 12 (down et ELT analytics).
const VERS_STRUCTURE_LEGACY = `
  CASE
    WHEN structure = 'MILO' THEN 'MILO'
    WHEN structure = 'INVITE' THEN 'INVITE'
    WHEN structure = 'CONSEIL_DEPARTEMENTAL' THEN 'CONSEIL_DEPT'
    WHEN dispositif = 'CEJ' THEN 'POLE_EMPLOI'
    WHEN dispositif = 'BRSA' THEN 'POLE_EMPLOI_BRSA'
    WHEN dispositif = 'AIJ' THEN 'POLE_EMPLOI_AIJ'
    WHEN dispositif = 'AVENIR_PRO' THEN 'AVENIR_PRO'
    WHEN dispositif = 'ACCOMPAGNEMENT_INTENSIF' THEN 'FT_ACCOMPAGNEMENT_INTENSIF'
    WHEN dispositif = 'ACCOMPAGNEMENT_GLOBAL' THEN 'FT_ACCOMPAGNEMENT_GLOBAL'
    WHEN dispositif = 'EQUIP_EMPLOI_RECRUT' THEN 'FT_EQUIP_EMPLOI_RECRUT'
    WHEN dispositif = 'DEMANDEUR_D_EMPLOI' THEN 'FT_DEMANDEUR_D_EMPLOI'
    WHEN dispositif = 'ESPACE_CANDIDAT' THEN 'FT_ESPACE_CANDIDAT'
    ELSE 'POLE_EMPLOI'
  END`

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      // jeune : le dispositif d'abord (le CASE lit la structure legacy).
      // CONSEIL_DEPT était une valeur de dispositif redondante avec la
      // structure ; les non-accompagnés (dispositif NULL jusqu'ici) prennent
      // leur mode comme dispositif.
      await queryInterface.sequelize.query(
        `UPDATE jeune SET dispositif = ${VERS_DISPOSITIF_DEPUIS_STRUCTURE}
         WHERE dispositif IS NULL OR dispositif = 'CONSEIL_DEPT'`,
        { transaction }
      )
      await queryInterface.sequelize.query(
        `UPDATE jeune SET structure = ${VERS_STRUCTURE}`,
        { transaction }
      )

      // conseiller : dispositif = sa porte SSO, NULL pour MiLo (il couvre
      // CEJ et PACEA) et pour le Conseil départemental.
      await queryInterface.addColumn(
        'conseiller',
        'dispositif',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      )
      await queryInterface.sequelize.query(
        `UPDATE conseiller SET dispositif = ${VERS_DISPOSITIF_DEPUIS_STRUCTURE}`,
        { transaction }
      )
      await queryInterface.sequelize.query(
        `UPDATE conseiller SET structure = ${VERS_STRUCTURE}`,
        { transaction }
      )

    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        `UPDATE conseiller SET structure = ${VERS_STRUCTURE_LEGACY}`,
        { transaction }
      )
      await queryInterface.removeColumn('conseiller', 'dispositif', {
        transaction
      })

      await queryInterface.sequelize.query(
        `UPDATE jeune SET structure = ${VERS_STRUCTURE_LEGACY}`,
        { transaction }
      )
      await queryInterface.sequelize.query(
        `UPDATE jeune
         SET dispositif = CASE
           WHEN structure = 'CONSEIL_DEPT' THEN 'CONSEIL_DEPT'
           WHEN dispositif IN ('DEMANDEUR_D_EMPLOI', 'ESPACE_CANDIDAT') THEN NULL
           ELSE dispositif
         END`,
        { transaction }
      )
    })
  }
}
