'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('archive_jeune', 'date_derniere_connexion', {
      type: Sequelize.DATE,
      allowNull: true
    })
  },

  down: async queryInterface => {
    await queryInterface.removeColumn(
      'archive_jeune',
      'date_derniere_connexion'
    )
  }
}
