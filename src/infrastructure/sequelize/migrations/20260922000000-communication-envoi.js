'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      // Bases locales / review apps qui ont joué la v1 de 20260917 ; jamais en prod.
      await queryInterface.sequelize.query(
        'ALTER TABLE communication DROP COLUMN IF EXISTS envoyee_le',
        { transaction }
      )
      await queryInterface.addColumn(
        'communication',
        'statut_envoi',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      )
      await queryInterface.addColumn(
        'communication',
        'envoi_termine_le',
        { type: Sequelize.DATE, allowNull: true },
        { transaction }
      )
      await queryInterface.addColumn(
        'communication',
        'echecs_consecutifs',
        { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        { transaction }
      )
      for (const colonne of ['nb_envoyees', 'nb_erreurs', 'nb_tokens_invalides']) {
        await queryInterface.addColumn(
          'communication',
          colonne,
          { type: Sequelize.INTEGER, allowNull: true },
          { transaction }
        )
      }
      // Reprise : rien ne doit partir du seul fait du déploiement.
      await queryInterface.sequelize.query(
        `UPDATE communication SET statut_envoi = 'ANNULEE', envoi_termine_le = NOW() WHERE type = 'NOTIFICATION'`,
        { transaction }
      )

      await queryInterface.createTable(
        'communication_envoi',
        {
          id_communication: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: { model: 'communication', key: 'id' },
            onDelete: 'CASCADE'
          },
          id_jeune: {
            type: Sequelize.STRING,
            allowNull: false,
            primaryKey: true,
            references: { model: 'jeune', key: 'id' },
            onDelete: 'CASCADE'
          },
          statut: { type: Sequelize.STRING, allowNull: false },
          date_traitement: { type: Sequelize.DATE, allowNull: true }
        },
        { transaction }
      )
      await queryInterface.addIndex(
        'communication_envoi',
        ['id_communication', 'statut'],
        { name: 'communication_envoi_id_communication_statut', transaction }
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.dropTable('communication_envoi', { transaction })
      for (const colonne of [
        'statut_envoi',
        'envoi_termine_le',
        'echecs_consecutifs',
        'nb_envoyees',
        'nb_erreurs',
        'nb_tokens_invalides'
      ]) {
        await queryInterface.removeColumn('communication', colonne, {
          transaction
        })
      }
    })
  }
}
