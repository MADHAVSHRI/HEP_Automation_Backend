/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pass_requests", "approvedBy", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("vendor_pass_requests", "approvedBy", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("Agents", "approvedBy", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("pass_requests", "approvedBy");
    await queryInterface.removeColumn("vendor_pass_requests", "approvedBy");
    await queryInterface.removeColumn("Agents", "approvedBy");
  }
};
