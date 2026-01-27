'use strict'

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE feature_flip
      SET feature_tag = 'MIGRATION_PHASE_A'
      WHERE feature_tag = 'MIGRATION'
    `)
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE feature_flip
      SET feature_tag = 'MIGRATION'
      WHERE feature_tag = 'MIGRATION_PHASE_A'
    `)
  }
}
