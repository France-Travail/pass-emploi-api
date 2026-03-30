'use strict'

module.exports = {
  up: async queryInterface => {
    await queryInterface.changeColumn('archive_jeune', 'donnees', {
      type: 'JSONB',
      allowNull: true
    })
  },

  down: async queryInterface => {
    await queryInterface.changeColumn('archive_jeune', 'donnees', {
      type: 'JSONB',
      allowNull: false
    })
  }
}
