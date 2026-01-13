'use strict'

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(
      `CREATE INDEX idx_rendez_vous_date_non_annule
       ON rendez_vous(date)
       WHERE annule = false`
    )
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS idx_rendez_vous_date_non_annule'
    )
  }
}
