'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('jeune', 'dispositif', {
      type: Sequelize.STRING,
      allowNull: true
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `UPDATE jeune SET dispositif = 'CEJ' WHERE dispositif IS NULL`
    )
    await queryInterface.changeColumn('jeune', 'dispositif', {
      type: Sequelize.STRING,
      allowNull: false
    })
  }
}
