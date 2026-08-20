'use strict'

// suggestion.id_recherche est en ON DELETE CASCADE mais n'était pas indexé :
// chaque suppression d'une recherche imposait un scan complet de suggestion
module.exports = {
  up: async (queryInterface, _Sequelize) => {
    await queryInterface.addIndex('suggestion', ['id_recherche'], {
      name: 'idx_suggestion_id_recherche'
    })
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeIndex('suggestion', 'idx_suggestion_id_recherche')
  }
}
