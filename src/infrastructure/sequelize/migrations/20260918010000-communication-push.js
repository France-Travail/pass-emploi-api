'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('communication', 'push', {
      type: Sequelize.BOOLEAN,
      allowNull: true
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('communication', 'push')
  }
}
