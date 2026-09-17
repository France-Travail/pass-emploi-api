'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const [inconnus] = await queryInterface.sequelize.query(
        `select distinct code_region from agence
         where code_region is not null
           and code_region not in (select code from region)`,
        { transaction }
      )

      if (inconnus.length) {
        throw new Error(
          'codes region absents du referentiel: ' +
            inconnus.map(ligne => ligne.code_region).join(', ')
        )
      }

      await queryInterface.sequelize.query(
        `update agence set nom_region = region.libelle
         from region
         where agence.code_region = region.code
           and agence.nom_region is distinct from region.libelle`,
        { transaction }
      )

      await queryInterface.addConstraint('agence', {
        type: 'foreign key',
        fields: ['code_region'],
        name: 'agence_code_region_fkey',
        references: {
          table: 'region',
          field: 'code'
        },
        onUpdate: 'CASCADE',
        transaction
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('agence', 'agence_code_region_fkey')
  }
}
