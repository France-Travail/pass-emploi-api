'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('jeune_invite', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      id_authentification: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      // Nom d'affichage choisi par l'invité. Renseigné par défaut à la création
      // (il est anonyme), puis modifiable par l'utilisateur depuis l'app.
      prenom: {
        type: Sequelize.STRING,
        allowNull: false
      },
      date_creation: {
        type: Sequelize.DATE,
        allowNull: false
      },
      date_premiere_connexion: {
        type: Sequelize.DATE,
        allowNull: true
      },
      date_derniere_connexion: {
        type: Sequelize.DATE,
        allowNull: true
      },
      push_notification_token: {
        type: Sequelize.STRING,
        allowNull: true
      },
      date_derniere_actualisation_token: {
        type: Sequelize.DATE,
        allowNull: true
      },
      app_version: {
        type: Sequelize.STRING,
        allowNull: true
      },
      installation_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      instance_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      timezone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      date_signature_cgu: {
        type: Sequelize.DATE,
        allowNull: true
      }
    })

    await queryInterface.addIndex('jeune_invite', ['id_authentification'], {
      name: 'jeune_invite_id_authentification_idx',
      unique: true
    })
  },

  down: async queryInterface => {
    await queryInterface.removeIndex(
      'jeune_invite',
      'jeune_invite_id_authentification_idx'
    )
    await queryInterface.dropTable('jeune_invite')
  }
}
