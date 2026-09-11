'use strict'

// `feature_flip` mélangeait deux choses : de vrais feature flips (PLAN_D_ACTION,
// DEMARCHES_IA…) et les vagues de bascule vers Parcours Emploi, encodées en
// tags MIGRATION_PHASE_*. On les sépare en deux mécanismes :
//
// - `fonctionnalite` / `fonctionnalite_conseillers` : le feature flip. Une affectation sans
//   date d'activation est active immédiatement.
// - `migration` / `migration_conseillers` : les vagues de bascule. Sans date de
//   migration, personne ne bascule : c'est déjà le comportement actuel d'une
//   phase sans date configurée.
//
// Les ids des deux référentiels sont libres, plus aucune valeur n'est figée
// dans le code. Les tags MIGRATION_PHASE_A / _B deviennent les migrations
// PHASE_A / PHASE_B, ce qui garde les URLs support existantes valables.
//
// Les dates vivaient dans DATE_MIGRATION_PHASE_A / _B ; elles sont recopiées
// ici puis les variables sont retirées de la configuration.

const PREFIXE_TAG_MIGRATION = 'MIGRATION_PHASE_'

const DATES_LEGACY = [
  { idMigration: 'PHASE_A', variable: 'DATE_MIGRATION_PHASE_A' },
  { idMigration: 'PHASE_B', variable: 'DATE_MIGRATION_PHASE_B' }
]

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        'fonctionnalite',
        {
          id: { type: Sequelize.STRING, primaryKey: true, allowNull: false }
        },
        { transaction }
      )

      await queryInterface.createTable(
        'fonctionnalite_conseillers',
        {
          id_fonctionnalite: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false,
            references: { model: 'fonctionnalite', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          email_conseiller: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false
          },
          date_activation: { type: Sequelize.DATE, allowNull: true }
        },
        { transaction }
      )

      await queryInterface.createTable(
        'migration',
        {
          id: { type: Sequelize.STRING, primaryKey: true, allowNull: false }
        },
        { transaction }
      )

      await queryInterface.createTable(
        'migration_conseillers',
        {
          id_migration: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false,
            references: { model: 'migration', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          email_conseiller: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false
          },
          date_migration: { type: Sequelize.DATE, allowNull: true }
        },
        { transaction }
      )

      const replacements = { prefixe: `${PREFIXE_TAG_MIGRATION}%` }

      await queryInterface.sequelize.query(
        `INSERT INTO migration (id)
         SELECT DISTINCT replace(feature_tag, '${PREFIXE_TAG_MIGRATION}', 'PHASE_')
         FROM feature_flip
         WHERE feature_tag LIKE :prefixe
         ON CONFLICT (id) DO NOTHING`,
        { replacements, transaction }
      )

      await queryInterface.sequelize.query(
        `INSERT INTO migration_conseillers (id_migration, email_conseiller)
         SELECT DISTINCT replace(feature_tag, '${PREFIXE_TAG_MIGRATION}', 'PHASE_'), email_conseiller
         FROM feature_flip
         WHERE feature_tag LIKE :prefixe
         ON CONFLICT DO NOTHING`,
        { replacements, transaction }
      )

      await queryInterface.sequelize.query(
        `INSERT INTO fonctionnalite (id)
         SELECT DISTINCT feature_tag
         FROM feature_flip
         WHERE feature_tag NOT LIKE :prefixe
         ON CONFLICT (id) DO NOTHING`,
        { replacements, transaction }
      )

      await queryInterface.sequelize.query(
        `INSERT INTO fonctionnalite_conseillers (id_fonctionnalite, email_conseiller)
         SELECT DISTINCT feature_tag, email_conseiller
         FROM feature_flip
         WHERE feature_tag NOT LIKE :prefixe
         ON CONFLICT DO NOTHING`,
        { replacements, transaction }
      )

      for (const legacy of DATES_LEGACY) {
        const date = process.env[legacy.variable]
        if (!date) continue
        await queryInterface.sequelize.query(
          `UPDATE migration_conseillers
           SET date_migration = CAST(:date AS TIMESTAMPTZ)
           WHERE id_migration = :idMigration`,
          {
            replacements: { idMigration: legacy.idMigration, date },
            transaction
          }
        )
      }

      await queryInterface.dropTable('feature_flip', { transaction })
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        'feature_flip',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          email_conseiller: { type: Sequelize.STRING, allowNull: false },
          feature_tag: { type: Sequelize.STRING, allowNull: false }
        },
        { transaction }
      )

      await queryInterface.addIndex(
        'feature_flip',
        ['feature_tag', 'email_conseiller'],
        {
          unique: true,
          name: 'feature_flip_feature_tag_email_conseiller_unique',
          transaction
        }
      )

      await queryInterface.sequelize.query(
        `INSERT INTO feature_flip (feature_tag, email_conseiller)
         SELECT id_fonctionnalite, email_conseiller FROM fonctionnalite_conseillers
         ON CONFLICT DO NOTHING`,
        { transaction }
      )

      await queryInterface.sequelize.query(
        `INSERT INTO feature_flip (feature_tag, email_conseiller)
         SELECT replace(id_migration, 'PHASE_', '${PREFIXE_TAG_MIGRATION}'), email_conseiller
         FROM migration_conseillers
         ON CONFLICT DO NOTHING`,
        { transaction }
      )

      await queryInterface.dropTable('migration_conseillers', { transaction })
      await queryInterface.dropTable('migration', { transaction })
      await queryInterface.dropTable('fonctionnalite_conseillers', { transaction })
      await queryInterface.dropTable('fonctionnalite', { transaction })
    })
  }
}
