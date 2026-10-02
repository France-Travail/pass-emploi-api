'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('plan_action_objectif', 'ordre', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
    await queryInterface.addColumn('plan_action_tache', 'ordre', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
  },

  down: async queryInterface => {
    await queryInterface.removeColumn('plan_action_tache', 'ordre')
    await queryInterface.removeColumn('plan_action_objectif', 'ordre')
  }
}
