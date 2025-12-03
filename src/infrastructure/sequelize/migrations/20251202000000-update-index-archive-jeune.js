'use strict'

module.exports = {
  up: async queryInterface => {
    await queryInterface.removeIndex('archive_jeune', 'archive_jeune_email_idx')
    await queryInterface.addIndex('archive_jeune', ['email', 'motif'], {
      name: 'archive_jeune_email_motif_idx'
    })
  },

  down: async queryInterface => {
    await queryInterface.removeIndex(
      'archive_jeune',
      'archive_jeune_email_motif_idx'
    )
    await queryInterface.addIndex('archive_jeune', ['email'], {
      name: 'archive_jeune_email_idx'
    })
  }
}
