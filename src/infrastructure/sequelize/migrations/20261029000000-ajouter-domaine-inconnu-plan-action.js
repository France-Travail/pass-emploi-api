'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'plan_action',
      'domaine_professionnel_inconnu',
      {
        type: Sequelize.BOOLEAN,
        allowNull: true
      }
    )
  },

  down: async queryInterface => {
    await queryInterface.removeColumn(
      'plan_action',
      'domaine_professionnel_inconnu'
    )
  }
}
