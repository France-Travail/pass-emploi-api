'use strict'

const regions = require('../seeders/data/regions.json')
const departementsRegions = require('../seeders/data/departements_regions.json')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.bulkInsert('region', regions, {
        ignoreDuplicates: true,
        transaction
      })

      await queryInterface.bulkInsert(
        'departement',
        departementsRegions
          .filter(d => ['975', '977', '978'].includes(d.code))
          .map(d => ({ code: d.code, libelle: d.libelle })),
        { transaction }
      )

      await queryInterface.addColumn(
        'departement',
        'code_region',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      )

      for (const departement of departementsRegions) {
        await queryInterface.sequelize.query(
          'UPDATE departement SET code_region = :codeRegion WHERE code = :code',
          {
            replacements: {
              codeRegion: departement.code_region,
              code: departement.code
            },
            type: Sequelize.QueryTypes.UPDATE,
            transaction
          }
        )
      }

      await queryInterface.changeColumn(
        'departement',
        'code_region',
        {
          type: Sequelize.STRING,
          allowNull: false,
          references: { model: 'region', key: 'code' }
        },
        { transaction }
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn('departement', 'code_region', {
        transaction
      })
      await queryInterface.bulkDelete(
        'departement',
        { code: ['975', '977', '978'] },
        { transaction }
      )
    })
  }
}
