'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        `UPDATE plan_action
         SET domaine_professionnel_inconnu = false
         WHERE domaine_professionnel_inconnu IS NULL`,
        { transaction }
      )
      await queryInterface.changeColumn(
        'plan_action',
        'domaine_professionnel_inconnu',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        { transaction }
      )
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn(
      'plan_action',
      'domaine_professionnel_inconnu',
      {
        type: Sequelize.BOOLEAN,
        allowNull: true
      }
    )
  }
}
