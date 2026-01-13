'use strict'

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(
      `CREATE INDEX idx_rendez_vous_agence_date_type
       ON rendez_vous (id_agence, date, type)
       WHERE annule = false`
    )
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS idx_rendez_vous_agence_date_type'
    )
  }
}
