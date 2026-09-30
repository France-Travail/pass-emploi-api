'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('plan_action_tache', 'date_suppression', {
      type: Sequelize.DATE,
      allowNull: true
    })
  },

  down: async queryInterface => {
    await queryInterface.removeColumn('plan_action_tache', 'date_suppression')
  }
}
