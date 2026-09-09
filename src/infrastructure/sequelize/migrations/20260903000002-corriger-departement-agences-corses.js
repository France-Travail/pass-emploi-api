'use strict'

const CORSE_DU_SUD = ['681', '682', '683']
const HAUTE_CORSE = ['684', '685', '686', '687']

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        "UPDATE agence SET code_departement = '2A' WHERE id IN (:ids)",
        {
          replacements: { ids: CORSE_DU_SUD },
          type: Sequelize.QueryTypes.UPDATE,
          transaction
        }
      )
      await queryInterface.sequelize.query(
        "UPDATE agence SET code_departement = '2B' WHERE id IN (:ids)",
        {
          replacements: { ids: HAUTE_CORSE },
          type: Sequelize.QueryTypes.UPDATE,
          transaction
        }
      )
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "UPDATE agence SET code_departement = '20' WHERE id IN (:ids)",
      {
        replacements: { ids: [...CORSE_DU_SUD, ...HAUTE_CORSE] },
        type: Sequelize.QueryTypes.UPDATE
      }
    )
  }
}
