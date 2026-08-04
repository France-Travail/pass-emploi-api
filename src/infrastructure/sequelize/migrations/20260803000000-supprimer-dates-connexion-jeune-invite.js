'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn(
        'jeune_invite',
        'date_premiere_connexion',
        { transaction }
      )
      await queryInterface.removeColumn(
        'jeune_invite',
        'date_derniere_connexion',
        { transaction }
      )
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        'jeune_invite',
        'date_premiere_connexion',
        {
          type: Sequelize.DATE,
          allowNull: true
        },
        { transaction }
      )
      await queryInterface.addColumn(
        'jeune_invite',
        'date_derniere_connexion',
        {
          type: Sequelize.DATE,
          allowNull: true
        },
        { transaction }
      )
    })
  }
}
