const { sequelize } = require("../../models");

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL (Sequelize) Connected Successfully");
  } catch (error) {
    console.error("PostgreSQL Connection Failed:", error.message);
    process.exit(1);
  }
};

module.exports = { connectDB, sequelize };

