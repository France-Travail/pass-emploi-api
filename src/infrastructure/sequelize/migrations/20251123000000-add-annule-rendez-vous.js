'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('rendez_vous', 'annule', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    })
  },

  down: async queryInterface => {
    await queryInterface.removeColumn('rendez_vous', 'annule')
  }
}
