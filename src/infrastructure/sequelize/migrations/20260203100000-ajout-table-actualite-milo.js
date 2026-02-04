'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('actualite', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      idStructureMilo: {
        field: 'id_structure_milo',
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'structure_milo',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      prenomNomConseiller: {
        field: 'nom_prenom_conseiller',
        type: Sequelize.STRING,
        allowNull: false
      },
      idConseiller: {
        field: 'id_conseiller',
        type: Sequelize.STRING,
        allowNull: false
      },
      titre: {
        field: 'titre',
        type: Sequelize.STRING(100),
        allowNull: false
      },
      contenu: {
        field: 'contenu',
        type: Sequelize.STRING(500),
        allowNull: false
      },
      titreLien: {
        field: 'titre_lien',
        type: Sequelize.STRING(50),
        allowNull: true
      },
      lien: {
        field: 'lien',
        type: Sequelize.STRING(2000),
        allowNull: true
      },
      dateCreation: {
        field: 'date_creation',
        type: Sequelize.DATE,
        allowNull: false
      },
      dateModification: {
        field: 'date_modification',
        type: Sequelize.DATE,
        allowNull: false
      },
      dateSuppression: {
        field: 'date_suppression',
        type: Sequelize.DATE,
        allowNull: true
      }
    })

    await queryInterface.addIndex('actualite', ['id_structure_milo'], {
      name: 'actualite_id_structure_milo_idx'
    })
  },

  down: async queryInterface => {
    await queryInterface.dropTable('actualite')
  }
}
