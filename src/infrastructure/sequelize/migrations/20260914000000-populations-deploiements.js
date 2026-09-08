'use strict'

// Remplace feature_flip par fonctionnalite, population (+ population_conseiller, population_profil) et deploiement : un tag MIGRATION_X devient la population X avec un déploiement MIGRATION, tout autre tag une fonctionnalité et une population de même id avec un déploiement FONCTIONNALITE, chacune avec ses emails ; tous actifs immédiatement, comme le feature flip l'était.

const PREFIXE_TAG_MIGRATION = 'MIGRATION_'

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
        'population',
        {
          id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
          description: { type: Sequelize.STRING, allowNull: true }
        },
        { transaction }
      )

      await queryInterface.createTable(
        'population_conseiller',
        {
          id_population: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false,
            references: { model: 'population', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          email_conseiller: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false
          }
        },
        { transaction }
      )

      await queryInterface.createTable(
        'population_profil',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          id_population: {
            type: Sequelize.STRING,
            allowNull: false,
            references: { model: 'population', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          structure: { type: Sequelize.STRING, allowNull: false },
          dispositif: { type: Sequelize.STRING, allowNull: true }
        },
        { transaction }
      )
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX population_profil_unique
         ON population_profil (id_population, structure, COALESCE(dispositif, ''))`,
        { transaction }
      )

      await queryInterface.createTable(
        'deploiement',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          nature: { type: Sequelize.STRING, allowNull: false },
          id_population: {
            type: Sequelize.STRING,
            allowNull: false,
            references: { model: 'population', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
          },
          id_fonctionnalite: {
            type: Sequelize.STRING,
            allowNull: true,
            references: { model: 'fonctionnalite', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT'
          },
          date_activation: { type: Sequelize.DATE, allowNull: false }
        },
        { transaction }
      )
      await queryInterface.sequelize.query(
        `ALTER TABLE deploiement ADD CONSTRAINT deploiement_nature_fonctionnalite_check
         CHECK (
           (nature = 'FONCTIONNALITE' AND id_fonctionnalite IS NOT NULL)
           OR (nature = 'MIGRATION' AND id_fonctionnalite IS NULL)
         )`,
        { transaction }
      )
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX deploiement_fonctionnalite_unique
         ON deploiement (id_population, id_fonctionnalite)
         WHERE nature = 'FONCTIONNALITE'`,
        { transaction }
      )
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX deploiement_migration_unique
         ON deploiement (id_population)
         WHERE nature = 'MIGRATION'`,
        { transaction }
      )

      const prefixe = `${PREFIXE_TAG_MIGRATION}%`

      // Feature flips : une fonctionnalité et une population de même id, avec ses emails et un déploiement actif tout de suite.
      await queryInterface.sequelize.query(
        `INSERT INTO fonctionnalite (id)
         SELECT DISTINCT feature_tag FROM feature_flip
         WHERE feature_tag NOT LIKE :prefixe
         ON CONFLICT (id) DO NOTHING`,
        { replacements: { prefixe }, transaction }
      )
      await queryInterface.sequelize.query(
        `INSERT INTO population (id, description)
         SELECT DISTINCT feature_tag, 'Reprise des conseillers de la fonctionnalité ' || feature_tag
         FROM feature_flip
         WHERE feature_tag NOT LIKE :prefixe
         ON CONFLICT (id) DO NOTHING`,
        { replacements: { prefixe }, transaction }
      )
      await queryInterface.sequelize.query(
        `INSERT INTO population_conseiller (id_population, email_conseiller)
         SELECT DISTINCT feature_tag, email_conseiller
         FROM feature_flip
         WHERE feature_tag NOT LIKE :prefixe
         ON CONFLICT DO NOTHING`,
        { replacements: { prefixe }, transaction }
      )
      await queryInterface.sequelize.query(
        `INSERT INTO deploiement (nature, id_population, id_fonctionnalite, date_activation)
         SELECT DISTINCT 'FONCTIONNALITE', feature_tag, feature_tag, NOW()
         FROM feature_flip
         WHERE feature_tag NOT LIKE :prefixe`,
        { replacements: { prefixe }, transaction }
      )

      // Migrations : MIGRATION_X devient la population X, avec ses emails et un déploiement MIGRATION actif tout de suite.
      await queryInterface.sequelize.query(
        `INSERT INTO population (id, description)
         SELECT DISTINCT substr(feature_tag, :debut), 'Migration ' || substr(feature_tag, :debut)
         FROM feature_flip
         WHERE feature_tag LIKE :prefixe
         ON CONFLICT (id) DO NOTHING`,
        {
          replacements: { prefixe, debut: PREFIXE_TAG_MIGRATION.length + 1 },
          transaction
        }
      )
      await queryInterface.sequelize.query(
        `INSERT INTO population_conseiller (id_population, email_conseiller)
         SELECT DISTINCT substr(feature_tag, :debut), email_conseiller
         FROM feature_flip
         WHERE feature_tag LIKE :prefixe
         ON CONFLICT DO NOTHING`,
        {
          replacements: { prefixe, debut: PREFIXE_TAG_MIGRATION.length + 1 },
          transaction
        }
      )
      await queryInterface.sequelize.query(
        `INSERT INTO deploiement (nature, id_population, id_fonctionnalite, date_activation)
         SELECT DISTINCT 'MIGRATION', substr(feature_tag, :debut), NULL, NOW()
         FROM feature_flip
         WHERE feature_tag LIKE :prefixe`,
        {
          replacements: { prefixe, debut: PREFIXE_TAG_MIGRATION.length + 1 },
          transaction
        }
      )

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
         SELECT d.id_fonctionnalite, pc.email_conseiller
         FROM deploiement d
         JOIN population_conseiller pc ON pc.id_population = d.id_population
         WHERE d.nature = 'FONCTIONNALITE'
         ON CONFLICT DO NOTHING`,
        { transaction }
      )
      await queryInterface.sequelize.query(
        `INSERT INTO feature_flip (feature_tag, email_conseiller)
         SELECT '${PREFIXE_TAG_MIGRATION}' || d.id_population, pc.email_conseiller
         FROM deploiement d
         JOIN population_conseiller pc ON pc.id_population = d.id_population
         WHERE d.nature = 'MIGRATION'
         ON CONFLICT DO NOTHING`,
        { transaction }
      )

      await queryInterface.dropTable('deploiement', { transaction })
      await queryInterface.dropTable('population_profil', { transaction })
      await queryInterface.dropTable('population_conseiller', { transaction })
      await queryInterface.dropTable('population', { transaction })
      await queryInterface.dropTable('fonctionnalite', { transaction })
    })
  }
}
