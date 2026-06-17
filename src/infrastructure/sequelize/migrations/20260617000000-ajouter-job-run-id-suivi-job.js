'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('suivi_job', 'job_run_id', {
      type: Sequelize.STRING,
      allowNull: true
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('suivi_job', 'job_run_id')
  }
}
