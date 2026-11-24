'use strict'

const INDEX = [
  [
    'notification_jeune_id_jeune_date_notif_idx',
    'notification_jeune (id_jeune, date_notif)'
  ],
  ['suggestion_id_jeune_idx', 'suggestion (id_jeune)'],
  ['communication_envoi_id_jeune_idx', 'communication_envoi (id_jeune)'],
  [
    'liste_diffusion_beneficiaire_id_beneficiaire_idx',
    '"liste-de-diffusion-beneficiaire-association" (id_beneficiaire)'
  ],
  ['commentaire_action_id_action_idx', 'commentaire_action (id_action)'],
  [
    'log_modification_rendez_vous_id_rendez_vous_idx',
    'log_modification_rendez_vous (id_rendez_vous)'
  ],
  ['jeune_id_conseiller_initial_idx', 'jeune (id_conseiller_initial)'],
  ['session_milo_id_structure_milo_idx', 'session_milo (id_structure_milo)'],
  [
    'rendez_vous_id_partenaire_type_partenaire_idx',
    'rendez_vous (id_partenaire, type_partenaire)'
  ]
]

module.exports = {
  async up(queryInterface) {
    // CONCURRENTLY : ne bloque pas les écritures, mais interdit toute transaction autour.
    // DROP préalable : une création interrompue laisse un index invalide, et les index
    // déjà créés feraient échouer la reprise ; la migration se rejoue telle quelle.
    for (const [nom, cible] of INDEX) {
      await queryInterface.sequelize.query(
        `DROP INDEX CONCURRENTLY IF EXISTS ${nom}`
      )
      await queryInterface.sequelize.query(
        `CREATE INDEX CONCURRENTLY ${nom} ON ${cible}`
      )
    }
  },

  async down(queryInterface) {
    for (const [nom] of INDEX) {
      await queryInterface.sequelize.query(
        `DROP INDEX CONCURRENTLY IF EXISTS ${nom}`
      )
    }
  }
}
