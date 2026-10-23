'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const colonne of [
        'id_authentification',
        'id_conseiller',
        'nettoyage_idp',
        'nettoyage_chat'
      ]) {
        await queryInterface.addColumn(
          'archive_jeune',
          colonne,
          { type: Sequelize.STRING, allowNull: true },
          { transaction }
        )
      }
      await queryInterface.addIndex('archive_jeune', ['id'], {
        name: 'archive_jeune_a_nettoyer_idx',
        where: {
          [Sequelize.Op.or]: [
            { nettoyage_idp: { [Sequelize.Op.ne]: null } },
            { nettoyage_chat: { [Sequelize.Op.ne]: null } }
          ]
        },
        transaction
      })
    })
  },

  down: async queryInterface => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeIndex(
        'archive_jeune',
        'archive_jeune_a_nettoyer_idx',
        { transaction }
      )
      for (const colonne of [
        'nettoyage_chat',
        'nettoyage_idp',
        'id_conseiller',
        'id_authentification'
      ]) {
        await queryInterface.removeColumn('archive_jeune', colonne, {
          transaction
        })
      }
    })
  }
}
