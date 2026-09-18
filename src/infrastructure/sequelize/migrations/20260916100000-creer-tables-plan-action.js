'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('referentiel_plan_action_tache', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      label: {
        type: Sequelize.STRING,
        allowNull: false
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      deeplink: {
        type: Sequelize.STRING,
        allowNull: true
      },
      url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      nom_service: {
        type: Sequelize.STRING,
        allowNull: true
      },
      nom_description: {
        type: Sequelize.STRING,
        allowNull: true
      }
    })

    await queryInterface.createTable('plan_action', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      id_jeune: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'jeune',
          key: 'id'
        }
      },
      date_creation: {
        type: Sequelize.DATE,
        allowNull: false
      },
      date_maj: {
        type: Sequelize.DATE,
        allowNull: false
      }
    })

    await queryInterface.createTable('plan_action_objectif', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      id_plan_action: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'plan_action',
          key: 'id'
        }
      },
      titre: {
        type: Sequelize.STRING,
        allowNull: false
      },
      theme: {
        type: Sequelize.STRING,
        allowNull: false
      }
    })

    await queryInterface.createTable('plan_action_tache', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      id_objectif: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'plan_action_objectif',
          key: 'id'
        }
      },
      id_tache_referentiel: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'referentiel_plan_action_tache',
          key: 'id'
        }
      },
      terminee: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      date_creation: {
        type: Sequelize.DATE,
        allowNull: false
      },
      date_terminee: {
        type: Sequelize.DATE,
        allowNull: true
      }
    })

    await queryInterface.addIndex(
      'plan_action',
      ['id_jeune', 'date_creation'],
      {
        name: 'idx_plan_action_id_jeune_date_creation'
      }
    )

    await queryInterface.addIndex('plan_action_objectif', ['id_plan_action'], {
      name: 'idx_plan_action_objectif_id_plan_action'
    })

    await queryInterface.addIndex('plan_action_tache', ['id_objectif'], {
      name: 'idx_plan_action_tache_id_objectif'
    })
  },

  down: async queryInterface => {
    await queryInterface.dropTable('plan_action_tache')
    await queryInterface.dropTable('plan_action_objectif')
    await queryInterface.dropTable('plan_action')
    await queryInterface.dropTable('referentiel_plan_action_tache')
  }
}
