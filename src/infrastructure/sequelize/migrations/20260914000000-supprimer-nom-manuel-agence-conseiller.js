'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('conseiller', 'nom_manuel_agence')
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('conseiller', 'nom_manuel_agence', {
      type: Sequelize.STRING,
      allowNull: true
    })
  }
}
