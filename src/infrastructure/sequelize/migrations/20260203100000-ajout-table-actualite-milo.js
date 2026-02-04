'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('actualite_milo', {
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
      idConseiller: {
        field: 'id_conseiller',
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'conseiller',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      titre: {
        field: 'titre',
        type: Sequelize.STRING(255),
        allowNull: false
      },
      contenu: {
        field: 'contenu',
        type: Sequelize.TEXT,
        allowNull: false
      },
      titreLien: {
        field: 'titre_lien',
        type: Sequelize.STRING(255),
        allowNull: true
      },
      lien: {
        field: 'lien',
        type: Sequelize.STRING(2048),
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
      }
    })

    await queryInterface.addIndex('actualite_milo', ['id_structure_milo'], {
      name: 'actualite_milo_id_structure_milo_idx'
    })
  },

  down: async queryInterface => {
    await queryInterface.dropTable('actualite_milo')
  }
}
