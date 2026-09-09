'use strict'

const regions = require('../seeders/data/regions.json')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        'region',
        {
          code: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false
          },
          libelle: {
            type: Sequelize.STRING,
            allowNull: false
          }
        },
        { transaction }
      )
      await queryInterface.bulkInsert('region', regions, { transaction })
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('region')
  }
}
