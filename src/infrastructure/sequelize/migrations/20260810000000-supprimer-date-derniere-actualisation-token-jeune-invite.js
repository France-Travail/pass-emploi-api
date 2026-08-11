'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn(
      'jeune_invite',
      'date_derniere_actualisation_token'
    )
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'jeune_invite',
      'date_derniere_actualisation_token',
      {
        type: Sequelize.DATE,
        allowNull: true
      }
    )
  }
}
