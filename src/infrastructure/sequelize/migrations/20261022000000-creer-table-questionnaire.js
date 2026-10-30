'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('questionnaire', {
      id_jeune: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        references: { model: 'jeune', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      date_creation: { type: Sequelize.DATE, allowNull: false },
      structure: { type: Sequelize.STRING, allowNull: false },
      situation: { type: Sequelize.STRING, allowNull: false },
      besoins: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: false },
      contraintes: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false
      },
      date_naissance: { type: Sequelize.DATEONLY, allowNull: true },
      code_insee_commune_residence: { type: Sequelize.STRING, allowNull: true },
      nom_commune_residence: { type: Sequelize.STRING, allowNull: true },
      code_insee_commune_recherche: { type: Sequelize.STRING, allowNull: true },
      nom_commune_recherche: { type: Sequelize.STRING, allowNull: true },
      domaine_professionnel_vise: { type: Sequelize.TEXT, allowNull: true },
      rayon_km: { type: Sequelize.FLOAT, allowNull: true }
    })
  },

  down: async queryInterface => {
    await queryInterface.dropTable('questionnaire')
  }
}
