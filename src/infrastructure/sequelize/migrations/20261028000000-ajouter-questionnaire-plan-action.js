'use strict'

const COLONNES = {
  structure: Sequelize => Sequelize.STRING,
  situation: Sequelize => Sequelize.STRING,
  besoins: Sequelize => Sequelize.ARRAY(Sequelize.STRING),
  contraintes: Sequelize => Sequelize.ARRAY(Sequelize.STRING),
  date_naissance: Sequelize => Sequelize.DATEONLY,
  code_insee_commune_residence: Sequelize => Sequelize.STRING,
  nom_commune_residence: Sequelize => Sequelize.STRING,
  code_insee_commune_recherche: Sequelize => Sequelize.STRING,
  nom_commune_recherche: Sequelize => Sequelize.STRING,
  domaine_professionnel_vise: Sequelize => Sequelize.TEXT,
  rayon_km: Sequelize => Sequelize.FLOAT
}

const NOMS_COLONNES = Object.keys(COLONNES)

const CONTRAINTE_QUESTIONNAIRE_COMPLET = 'plan_action_questionnaire_complet'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const [colonne, type] of Object.entries(COLONNES)) {
        await queryInterface.addColumn(
          'plan_action',
          colonne,
          { type: type(Sequelize), allowNull: true },
          { transaction }
        )
      }

      await queryInterface.sequelize.query(
        `UPDATE plan_action
         SET ${NOMS_COLONNES.map(c => `${c} = questionnaire.${c}`).join(', ')}
         FROM (
           SELECT DISTINCT ON (id_jeune) id, id_jeune
           FROM plan_action
           ORDER BY id_jeune, date_creation DESC
         ) dernier_plan
         JOIN questionnaire ON questionnaire.id_jeune = dernier_plan.id_jeune
         WHERE plan_action.id = dernier_plan.id`,
        { transaction }
      )

      await queryInterface.sequelize.query(
        `ALTER TABLE plan_action ADD CONSTRAINT ${CONTRAINTE_QUESTIONNAIRE_COMPLET}
         CHECK (
           (structure IS NULL AND situation IS NULL AND besoins IS NULL AND contraintes IS NULL)
           OR (structure IS NOT NULL AND situation IS NOT NULL AND besoins IS NOT NULL AND contraintes IS NOT NULL)
         )`,
        { transaction }
      )

      await queryInterface.dropTable('questionnaire', { transaction })
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        'questionnaire',
        {
          id_jeune: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false,
            references: { model: 'jeune', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          date_creation: { type: Sequelize.DATE, allowNull: false },
          structure: { type: Sequelize.STRING, allowNull: false },
          situation: { type: Sequelize.STRING, allowNull: false },
          besoins: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: false },
          contraintes: {
            type: Sequelize.ARRAY(Sequelize.STRING),
            allowNull: false
          },
          date_naissance: { type: Sequelize.DATEONLY, allowNull: true },
          code_insee_commune_residence: {
            type: Sequelize.STRING,
            allowNull: true
          },
          nom_commune_residence: { type: Sequelize.STRING, allowNull: true },
          code_insee_commune_recherche: {
            type: Sequelize.STRING,
            allowNull: true
          },
          nom_commune_recherche: { type: Sequelize.STRING, allowNull: true },
          domaine_professionnel_vise: { type: Sequelize.TEXT, allowNull: true },
          rayon_km: { type: Sequelize.FLOAT, allowNull: true }
        },
        { transaction }
      )

      await queryInterface.sequelize.query(
        `INSERT INTO questionnaire (id_jeune, date_creation, ${NOMS_COLONNES.join(', ')})
         SELECT DISTINCT ON (id_jeune) id_jeune, date_creation, ${NOMS_COLONNES.join(', ')}
         FROM plan_action
         WHERE situation IS NOT NULL
         ORDER BY id_jeune, date_creation DESC`,
        { transaction }
      )

      await queryInterface.removeConstraint(
        'plan_action',
        CONTRAINTE_QUESTIONNAIRE_COMPLET,
        { transaction }
      )
      for (const colonne of NOMS_COLONNES) {
        await queryInterface.removeColumn('plan_action', colonne, {
          transaction
        })
      }
    })
  }
}
