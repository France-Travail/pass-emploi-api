'use strict'

const CONTRAINTE_QUESTIONNAIRE_COMPLET = 'plan_action_questionnaire_complet'

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeConstraint(
        'plan_action',
        CONTRAINTE_QUESTIONNAIRE_COMPLET,
        { transaction }
      )
      await queryInterface.sequelize.query(
        `ALTER TABLE plan_action ADD CONSTRAINT ${CONTRAINTE_QUESTIONNAIRE_COMPLET}
         CHECK (
           (structure IS NULL AND situation IS NULL AND besoins IS NULL AND contraintes IS NULL)
           OR (structure IS NOT NULL AND besoins IS NOT NULL AND contraintes IS NOT NULL)
         )`,
        { transaction }
      )
    })
  },

  down: async queryInterface => {
    await queryInterface.sequelize.transaction(async transaction => {
      // L'ancienne contrainte exige une situation : une situation passée
      // redevient AUTRE, la valeur qui ciblait déjà ses solutions
      await queryInterface.sequelize.query(
        `UPDATE plan_action SET situation = 'AUTRE'
         WHERE structure IS NOT NULL AND situation IS NULL`,
        { transaction }
      )
      await queryInterface.removeConstraint(
        'plan_action',
        CONTRAINTE_QUESTIONNAIRE_COMPLET,
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
    })
  }
}
