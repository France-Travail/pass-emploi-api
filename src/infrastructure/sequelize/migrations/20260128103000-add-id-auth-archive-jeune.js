'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('archive_jeune', 'id_authentification', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.removeIndex(
      'archive_jeune',
      'archive_jeune_email_motif_idx'
    )
    await queryInterface.addIndex(
      'archive_jeune',
      ['id_authentification', 'motif'],
      {
        name: 'archive_jeune_id_authentification_motif_idx'
      }
    )
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('archive_jeune', 'id_authentification')
    await queryInterface.removeIndex(
      'archive_jeune',
      'archive_jeune_id_authentification_motif_idx'
    )
    await queryInterface.addIndex('archive_jeune', ['email', 'motif'], {
      name: 'archive_jeune_email_motif_idx'
    })
  }
}
