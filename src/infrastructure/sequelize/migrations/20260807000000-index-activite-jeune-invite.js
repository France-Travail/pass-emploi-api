'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE INDEX jeune_invite_activite_idx ON jeune_invite ((GREATEST(date_derniere_activite, date_creation)))'
    )
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS jeune_invite_activite_idx'
    )
  }
}
