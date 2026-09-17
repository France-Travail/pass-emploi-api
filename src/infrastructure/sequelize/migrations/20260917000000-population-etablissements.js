'use strict'

// Une population peut aussi cibler des établissements : une structure MiLo (ses conseillers et ses jeunes) ou une agence FT (ses conseillers et leurs jeunes de référence).

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        'population_structure_milo',
        {
          id_population: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false,
            references: { model: 'population', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          id_structure_milo: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false,
            references: { model: 'structure_milo', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          }
        },
        { transaction }
      )

      await queryInterface.createTable(
        'population_agence_ft',
        {
          id_population: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false,
            references: { model: 'population', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          id_agence: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false,
            references: { model: 'agence', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          }
        },
        { transaction }
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.dropTable('population_agence_ft', { transaction })
      await queryInterface.dropTable('population_structure_milo', {
        transaction
      })
    })
  }
}
