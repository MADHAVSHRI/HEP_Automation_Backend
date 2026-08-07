"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const addCol = async (table, col, options) => {
      try {
        await queryInterface.addColumn(table, col, options);
      } catch (err) {
        if (!err.message.includes("already exists")) {
          throw err;
        }
      }
    };

    // Add visaDoc and immigrationDoc columns to pass_persons
    await addCol("pass_persons", "visaDocPath", { type: Sequelize.STRING(500), allowNull: true });
    await addCol("pass_persons", "visaDocName", { type: Sequelize.STRING(255), allowNull: true });
    await addCol("pass_persons", "immigrationDocPath", { type: Sequelize.STRING(500), allowNull: true });
    await addCol("pass_persons", "immigrationDocName", { type: Sequelize.STRING(255), allowNull: true });

    // Add visaDoc and immigrationDoc columns to master_persons
    await addCol("master_persons", "visaDocPath", { type: Sequelize.STRING(500), allowNull: true });
    await addCol("master_persons", "visaDocName", { type: Sequelize.STRING(255), allowNull: true });
    await addCol("master_persons", "immigrationDocPath", { type: Sequelize.STRING(500), allowNull: true });
    await addCol("master_persons", "immigrationDocName", { type: Sequelize.STRING(255), allowNull: true });

    // Add visaDoc and immigrationDoc columns to vendor_pass_persons
    await addCol("vendor_pass_persons", "visaDocPath", { type: Sequelize.STRING(500), allowNull: true });
    await addCol("vendor_pass_persons", "visaDocName", { type: Sequelize.STRING(255), allowNull: true });
    await addCol("vendor_pass_persons", "immigrationDocPath", { type: Sequelize.STRING(500), allowNull: true });
    await addCol("vendor_pass_persons", "immigrationDocName", { type: Sequelize.STRING(255), allowNull: true });
  },

  async down(queryInterface, Sequelize) {
    const removeCol = async (table, col) => {
      try {
        await queryInterface.removeColumn(table, col);
      } catch (err) {
        // Ignore if column doesn't exist
      }
    };

    await removeCol("pass_persons", "visaDocPath");
    await removeCol("pass_persons", "visaDocName");
    await removeCol("pass_persons", "immigrationDocPath");
    await removeCol("pass_persons", "immigrationDocName");

    await removeCol("master_persons", "visaDocPath");
    await removeCol("master_persons", "visaDocName");
    await removeCol("master_persons", "immigrationDocPath");
    await removeCol("master_persons", "immigrationDocName");

    await removeCol("vendor_pass_persons", "visaDocPath");
    await removeCol("vendor_pass_persons", "visaDocName");
    await removeCol("vendor_pass_persons", "immigrationDocPath");
    await removeCol("vendor_pass_persons", "immigrationDocName");
  },
};
