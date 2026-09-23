'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('referentiel_plan_action_service', {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      nom: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true }
    })

    await queryInterface.createTable('referentiel_plan_action_solution', {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      besoin: { type: Sequelize.STRING, allowNull: true },
      contrainte: { type: Sequelize.STRING, allowNull: true },
      sous_categorie: { type: Sequelize.TEXT, allowNull: true },
      besoin_exprime: { type: Sequelize.TEXT, allowNull: true },
      type: { type: Sequelize.STRING, allowNull: false },
      libelle: { type: Sequelize.TEXT, allowNull: false },
      url: { type: Sequelize.TEXT, allowNull: true },
      ecran_app: { type: Sequelize.STRING, allowNull: true },
      id_service: {
        type: Sequelize.STRING,
        allowNull: true,
        references: { model: 'referentiel_plan_action_service', key: 'id' }
      },
      situations: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: []
      },
      authentifications: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: []
      },
      territoires: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: []
      },
      age_min: { type: Sequelize.INTEGER, allowNull: true },
      age_max: { type: Sequelize.INTEGER, allowNull: true },
      domaine: { type: Sequelize.TEXT, allowNull: true },
      conversion_ft_thematique: { type: Sequelize.TEXT, allowNull: true },
      conversion_ft_demarche: { type: Sequelize.TEXT, allowNull: true },
      conversion_ft_code_pourquoi: { type: Sequelize.STRING, allowNull: true },
      conversion_ft_code_quoi: { type: Sequelize.STRING, allowNull: true },
      conversion_ml_categorie: { type: Sequelize.TEXT, allowNull: true },
      conversion_ml_code_categorie: { type: Sequelize.TEXT, allowNull: true },
      conversion_ml_action: { type: Sequelize.TEXT, allowNull: true },
      conversion_ml_origine: { type: Sequelize.TEXT, allowNull: true },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      date_maj: { type: Sequelize.DATE, allowNull: false }
    })
  },

  down: async queryInterface => {
    await queryInterface.dropTable('referentiel_plan_action_solution')
    await queryInterface.dropTable('referentiel_plan_action_service')
  }
}
