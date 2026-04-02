'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class hep_rate extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  hep_rate.init({
    hepTypeId: DataTypes.INTEGER,
    dailyRate: DataTypes.DECIMAL,
    monthlyRate: DataTypes.DECIMAL,
    annualRate: DataTypes.DECIMAL,
    auctionRate: DataTypes.DECIMAL,
    isActive: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'hep_rate',
  });
  return hep_rate;
};