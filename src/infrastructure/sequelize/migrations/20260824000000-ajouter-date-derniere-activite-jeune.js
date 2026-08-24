'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jeune', 'date_derniere_activite', {
      type: Sequelize.DATE,
      allowNull: true
    })
    // Reprise du stock : meilleur signal d'activité connu à date (GREATEST ignore
    // les NULL en Postgres). Un jeune sans aucun signal reste à NULL : la colonne
    // ne se remplit qu'au premier appel de la route configuration-application.
    await queryInterface.sequelize.query(
      `UPDATE jeune
       SET date_derniere_activite = GREATEST(date_derniere_actualisation_token, date_derniere_connexion)
       WHERE date_derniere_actualisation_token IS NOT NULL
          OR date_derniere_connexion IS NOT NULL`
    )
    // date_derniere_activite remplace la date de MAJ du token comme signal de
    // fraîcheur : plus aucun consommateur.
    await queryInterface.removeColumn(
      'jeune',
      'date_derniere_actualisation_token'
    )
    // Alignement de la colonne homonyme des invités : même nullabilité.
    await queryInterface.changeColumn('jeune_invite', 'date_derniere_activite', {
      type: Sequelize.DATE,
      allowNull: true
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'jeune',
      'date_derniere_actualisation_token',
      {
        type: Sequelize.DATE,
        allowNull: true
      }
    )
    await queryInterface.sequelize.query(
      `UPDATE jeune_invite SET date_derniere_activite = date_creation WHERE date_derniere_activite IS NULL`
    )
    await queryInterface.changeColumn('jeune_invite', 'date_derniere_activite', {
      type: Sequelize.DATE,
      allowNull: false
    })
    await queryInterface.removeColumn('jeune', 'date_derniere_activite')
  }
}
