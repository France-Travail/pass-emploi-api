'use strict'

module.exports = {
  async up(queryInterface) {
    // Au seuil par défaut (20 %), l'autovacuum de cette TOAST de 15 Go la relit toute d'un bloc et sature le disque.
    // Pas en dessous de 5 % : chaque passage relit aussi tout l'index de la TOAST, un coût fixe à ne pas payer trop souvent.
    await queryInterface.sequelize.query(
      `ALTER TABLE cache_api_partenaire SET (
        toast.autovacuum_vacuum_scale_factor = 0.05,
        toast.log_autovacuum_min_duration = 0
      )`
    )
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE cache_api_partenaire RESET (
        toast.autovacuum_vacuum_scale_factor,
        toast.log_autovacuum_min_duration
      )`
    )
  }
}
