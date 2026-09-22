'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('conseiller', 'date_maj_dispositif', {
      type: Sequelize.DATE,
      allowNull: true
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('conseiller', 'date_maj_dispositif')
  }
}
