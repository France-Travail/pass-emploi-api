'use strict'

// Une population peut aussi cibler des établissements : une structure MiLo ou une agence FT, par leurs conseillers et les jeunes de référence de ces conseillers. Une agence peut être restreinte à une liste de dispositifs (`dispositifs` nul = toute l'agence) ; une structure MiLo non, un conseiller MiLo n'ayant pas de dispositif.

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
          },
          dispositifs: {
            type: Sequelize.ARRAY(Sequelize.STRING),
            allowNull: true
          }
        },
        { transaction }
      )
      await queryInterface.sequelize.query(
        `ALTER TABLE population_agence_ft
         ADD CONSTRAINT population_agence_ft_dispositifs_non_vide
         CHECK (dispositifs IS NULL OR array_length(dispositifs, 1) > 0)`,
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
