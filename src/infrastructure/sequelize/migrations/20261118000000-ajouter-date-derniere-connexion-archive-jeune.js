'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        'archive_jeune',
        'date_derniere_connexion',
        { type: Sequelize.DATE, allowNull: true },
        { transaction }
      )
      // Rattrapage approximatif des archives existantes : la vraie date n'a jamais été archivée.
      // Sans elle, un jeune désarchivé créé il y a plus de 2 ans serait purgé la nuit suivante.
      await queryInterface.sequelize.query(
        `UPDATE archive_jeune
         SET date_derniere_connexion = date_archivage
         WHERE date_premiere_connexion IS NOT NULL`,
        { transaction }
      )
    })
  },

  down: async queryInterface => {
    await queryInterface.removeColumn(
      'archive_jeune',
      'date_derniere_connexion'
    )
  }
}
