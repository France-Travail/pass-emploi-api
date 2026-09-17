'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        'communication',
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
          destinataire: { type: Sequelize.STRING, allowNull: false },
          type: { type: Sequelize.STRING, allowNull: false },
          date_debut: { type: Sequelize.DATE, allowNull: false },
          date_fin: { type: Sequelize.DATE, allowNull: false },
          titre: { type: Sequelize.STRING, allowNull: false },
          contenu: { type: Sequelize.TEXT, allowNull: false },
          cta_label: { type: Sequelize.STRING, allowNull: true },
          cta_url_android: { type: Sequelize.STRING, allowNull: true },
          cta_url_ios: { type: Sequelize.STRING, allowNull: true }
        },
        { transaction }
      )
      await queryInterface.sequelize.query(
        `ALTER TABLE communication ADD CONSTRAINT communication_dates_check
         CHECK (date_debut < date_fin)`,
        { transaction }
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('communication')
  }
}
