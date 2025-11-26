'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async () => {
      await queryInterface.addColumn('rendez_vous', 'annule', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
      })
    })
    await queryInterface.changeColumn('rendez_vous', 'annule', {
      allowNull: false
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async () => {
      await queryInterface.removeColumn('rendez_vous', 'annule')
    })
  }
}
