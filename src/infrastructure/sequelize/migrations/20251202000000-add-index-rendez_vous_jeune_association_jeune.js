'use strict'

module.exports = {
  up: async queryInterface => {
    await queryInterface.addIndex(
      'rendez_vous_jeune_association',
      ['id_jeune'],
      {
        name: 'rendez_vous_jeune_association_id_jeune'
      }
    )
  },

  down: async queryInterface => {
    await queryInterface.removeIndex(
      'rendez_vous_jeune_association',
      'id_jeune'
    )
  }
}
