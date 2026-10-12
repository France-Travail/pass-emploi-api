'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        'jeune',
        'date_premiere_utilisation_invite',
        { type: Sequelize.DATE, allowNull: true },
        { transaction }
      )
      await queryInterface.addColumn(
        'jeune_invite',
        'date_reprise',
        { type: Sequelize.DATE, allowNull: true },
        { transaction }
      )
    })
  },

  down: async queryInterface => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn('jeune_invite', 'date_reprise', {
        transaction
      })
      await queryInterface.removeColumn(
        'jeune',
        'date_premiere_utilisation_invite',
        { transaction }
      )
    })
  }
}
