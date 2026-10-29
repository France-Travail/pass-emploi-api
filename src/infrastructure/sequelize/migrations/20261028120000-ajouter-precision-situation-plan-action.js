'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('plan_action', 'precision_situation', {
      type: Sequelize.TEXT,
      allowNull: true
    })
  },

  down: async queryInterface => {
    await queryInterface.removeColumn('plan_action', 'precision_situation')
  }
}
