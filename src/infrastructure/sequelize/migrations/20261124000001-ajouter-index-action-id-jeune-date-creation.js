'use strict'

const NOM = 'action_id_jeune_date_creation_idx'

module.exports = {
  async up(queryInterface) {
    // CONCURRENTLY : ne bloque pas les écritures, mais interdit toute transaction autour.
    // DROP préalable : une création interrompue laisse un index invalide ; la migration se rejoue telle quelle.
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${NOM}`
    )
    await queryInterface.sequelize.query(
      `CREATE INDEX CONCURRENTLY ${NOM} ON action (id_jeune, date_creation)`
    )
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${NOM}`
    )
  }
}
