'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('communication', 'date_fin', {
      type: Sequelize.DATE,
      allowNull: true
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('communication', 'date_fin', {
      type: Sequelize.DATE,
      allowNull: false
    })
  }
}
