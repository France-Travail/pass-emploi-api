'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        'communication',
        'type_notification',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      )
      await queryInterface.addColumn(
        'communication',
        'envoyee_le',
        { type: Sequelize.DATE, allowNull: true },
        { transaction }
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn('communication', 'type_notification', {
        transaction
      })
      await queryInterface.removeColumn('communication', 'envoyee_le', {
        transaction
      })
    })
  }
}
