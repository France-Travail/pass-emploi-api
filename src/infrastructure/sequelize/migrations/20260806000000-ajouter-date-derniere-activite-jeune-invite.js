'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jeune_invite', 'date_derniere_activite', {
      type: Sequelize.DATE,
      allowNull: true
    })
    // Les invités antérieurs à la colonne n'ont aucun signal d'activité : leur
    // date de création sert de plancher, sinon ils resteraient hors du NOT NULL.
    await queryInterface.sequelize.query(
      'UPDATE jeune_invite SET date_derniere_activite = date_creation WHERE date_derniere_activite IS NULL'
    )
    await queryInterface.changeColumn(
      'jeune_invite',
      'date_derniere_activite',
      {
        type: Sequelize.DATE,
        allowNull: false
      }
    )
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('jeune_invite', 'date_derniere_activite')
  }
}
