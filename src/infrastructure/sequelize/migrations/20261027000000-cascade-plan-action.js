'use strict'

const CONTRAINTES = [
  {
    table: 'plan_action',
    champ: 'id_jeune',
    nom: 'plan_action_id_jeune_fkey',
    reference: 'jeune'
  },
  {
    table: 'plan_action_objectif',
    champ: 'id_plan_action',
    nom: 'plan_action_objectif_id_plan_action_fkey',
    reference: 'plan_action'
  },
  {
    table: 'plan_action_tache',
    champ: 'id_objectif',
    nom: 'plan_action_tache_id_objectif_fkey',
    reference: 'plan_action_objectif'
  }
]

async function recreerLesContraintes(queryInterface, onDelete) {
  await queryInterface.sequelize.transaction(async transaction => {
    for (const { table, champ, nom, reference } of CONTRAINTES) {
      await queryInterface.removeConstraint(table, nom, { transaction })
      await queryInterface.addConstraint(table, {
        type: 'foreign key',
        fields: [champ],
        name: nom,
        references: { table: reference, field: 'id' },
        ...(onDelete && { onDelete }),
        transaction
      })
    }
  })
}

module.exports = {
  up: async queryInterface => recreerLesContraintes(queryInterface, 'CASCADE'),
  down: async queryInterface => recreerLesContraintes(queryInterface)
}
