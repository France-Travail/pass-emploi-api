'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('archive_jeune', 'id_population', {
      type: Sequelize.STRING,
      allowNull: true
    })
  },

  down: async queryInterface => {
    await queryInterface.removeColumn('archive_jeune', 'id_population')
  }
}
