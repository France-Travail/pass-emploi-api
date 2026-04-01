'use strict'

module.exports = {
  up: async queryInterface => {
    await queryInterface.removeConstraint(
      'archive_jeune',
      'archive_jeune_id_jeune_key'
    )
  },

  down: async queryInterface => {
    await queryInterface.addConstraint('archive_jeune', {
      fields: ['id_jeune'],
      type: 'unique',
      name: 'archive_jeune_id_jeune_key'
    })
  }
}
