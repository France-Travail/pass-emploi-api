'use strict'
const regions = require('./data/regions.json')
const departements = require('./data/departements_regions.json')
const communes = require('./data/communes.json')

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(
      { isolationLevel: Sequelize.Transaction.SERIALIZABLE },
      async _transaction => {
        await queryInterface.bulkInsert('region', regions)
        await queryInterface.bulkInsert('departement', departements)
        await queryInterface.bulkInsert('commune', communes)
      }
    )
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(
      { isolationLevel: Sequelize.Transaction.SERIALIZABLE },
      async _transaction => {
        await queryInterface.bulkDelete('departement', null, {})
        await queryInterface.bulkDelete('commune', null, {})
        await queryInterface.bulkDelete('region', null, {})
      }
    )
  }
}
