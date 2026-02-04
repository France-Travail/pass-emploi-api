'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn(
      'actualite',
      'nom_prenom_conseiller',
      'prenom_nom_conseiller'
    )

    await queryInterface.changeColumn('actualite', 'date_modification', {
      type: Sequelize.DATE,
      allowNull: true
    })

    await queryInterface.changeColumn('actualite', 'date_suppression', {
      type: Sequelize.DATE,
      allowNull: true
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('actualite', 'date_suppression', {
      type: Sequelize.DATE,
      allowNull: false
    })

    await queryInterface.changeColumn('actualite', 'date_modification', {
      type: Sequelize.DATE,
      allowNull: false
    })

    await queryInterface.renameColumn(
      'actualite',
      'prenom_nom_conseiller',
      'nom_prenom_conseiller'
    )
  }
}
