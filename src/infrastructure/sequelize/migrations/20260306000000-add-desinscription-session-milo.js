'use strict'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('session_milo', 'autodesinscription', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    })
  },
  down: async queryInterface => {
    await queryInterface.removeColumn('session_milo', 'autodesinscription')
  }
}
