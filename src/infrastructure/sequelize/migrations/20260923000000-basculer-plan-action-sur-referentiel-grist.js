'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('plan_action_tache', null, {})
    await queryInterface.bulkDelete('plan_action_objectif', null, {})
    await queryInterface.bulkDelete('plan_action', null, {})

    await queryInterface.removeColumn('plan_action_tache', 'id_tache_referentiel')
    await queryInterface.addColumn('plan_action_tache', 'id_solution', {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: 'referentiel_plan_action_solution',
        key: 'id'
      }
    })

    await queryInterface.dropTable('referentiel_plan_action_tache')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('referentiel_plan_action_tache', {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      label: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false },
      deeplink: { type: Sequelize.STRING, allowNull: true },
      url: { type: Sequelize.STRING, allowNull: true },
      nom_service: { type: Sequelize.STRING, allowNull: true },
      nom_description: { type: Sequelize.STRING, allowNull: true }
    })

    await queryInterface.bulkDelete('plan_action_tache', null, {})
    await queryInterface.removeColumn('plan_action_tache', 'id_solution')
    await queryInterface.addColumn('plan_action_tache', 'id_tache_referentiel', {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: 'referentiel_plan_action_tache',
        key: 'id'
      }
    })
  }
}
