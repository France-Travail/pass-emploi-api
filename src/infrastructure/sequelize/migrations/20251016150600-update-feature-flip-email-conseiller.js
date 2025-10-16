'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1) Add the new column email_conseiller (nullable during backfill)
    await queryInterface.addColumn('feature_flip', 'email_conseiller', {
      type: Sequelize.STRING,
      allowNull: true
    })

    // 2) Backfill from id_jeune -> jeune.id_conseiller -> conseiller.email
    // Use a SQL update with joins
    await queryInterface.sequelize.query(`
      UPDATE feature_flip ff
      SET email_conseiller = c.email
      FROM jeune j
      JOIN conseiller c ON j.id_conseiller = c.id
      WHERE ff.id_jeune = j.id
    `)

    // 3) Remove duplicates keeping the lowest id for same (feature_tag, email_conseiller)
    await queryInterface.sequelize.query(`
      DELETE FROM feature_flip a
      USING feature_flip b
      WHERE a.id > b.id
        AND a.feature_tag = b.feature_tag
        AND a.email_conseiller = b.email_conseiller
    `)

    // 4) Set NOT NULL on email_conseiller
    await queryInterface.changeColumn('feature_flip', 'email_conseiller', {
      type: Sequelize.STRING,
      allowNull: false
    })

    // 5) Add a unique index to prevent future duplicates on (feature_tag, email_conseiller)
    await queryInterface.addIndex(
      'feature_flip',
      ['feature_tag', 'email_conseiller'],
      {
        unique: true,
        name: 'feature_flip_feature_tag_email_conseiller_unique'
      }
    )

    // 6) Drop id_jeune column (and implicit FK)
    await queryInterface.removeColumn('feature_flip', 'id_jeune')
  },

  down: async (queryInterface, Sequelize) => {
    // 1) Recreate id_jeune (nullable during backfill)
    await queryInterface.addColumn('feature_flip', 'id_jeune', {
      type: Sequelize.STRING,
      allowNull: true,
      references: { model: 'jeune', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    })

    // 2) Backfill id_jeune from email_conseiller -> conseiller.email -> jeune (pick a deterministic jeune if several)
    await queryInterface.sequelize.query(`
      UPDATE feature_flip ff
      SET id_jeune = sub.id
      FROM (
        SELECT DISTINCT ON (c.email, ff.feature_tag)
               ff.id AS feature_flip_id,
               j.id
        FROM feature_flip ff
        JOIN conseiller c ON ff.email_conseiller = c.email
        JOIN jeune j ON j.id_conseiller = c.id
        ORDER BY c.email, ff.feature_tag, j.id
      ) AS sub
      WHERE ff.id = sub.feature_flip_id
    `)

    // 3) Drop the unique index on (feature_tag, email_conseiller)
    await queryInterface.removeIndex(
      'feature_flip',
      'feature_flip_feature_tag_email_conseiller_unique'
    )

    // 4) Make id_jeune NOT NULL
    await queryInterface.changeColumn('feature_flip', 'id_jeune', {
      type: Sequelize.STRING,
      allowNull: false
    })

    // 5) Finally drop email_conseiller
    await queryInterface.removeColumn('feature_flip', 'email_conseiller')
  }
}
