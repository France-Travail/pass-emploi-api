'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        'agence',
        'code_safir',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      )
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX idx_agence_code_safir
         ON agence (code_safir)
         WHERE code_safir IS NOT NULL AND structure = 'FRANCE_TRAVAIL'`,
        { transaction }
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS idx_agence_code_safir',
        { transaction }
      )
      await queryInterface.removeColumn('agence', 'code_safir', { transaction })
    })
  }
}
