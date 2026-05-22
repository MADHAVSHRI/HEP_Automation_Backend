/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pass_requests", "originType", {
      type: Sequelize.ENUM("AGENT", "VENDOR"),
      defaultValue: "AGENT",
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("pass_requests", "originType");
  }
};
