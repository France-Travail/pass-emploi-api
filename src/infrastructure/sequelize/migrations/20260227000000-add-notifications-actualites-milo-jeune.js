'use strict'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('jeune', 'notifications_actualites_milo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    })
  },
  down: async queryInterface => {
    await queryInterface.removeColumn('jeune', 'notifications_actualites_milo')
  }
}
