'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class State extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      State.belongsTo(models.Country, { foreignKey: 'countryId', as: 'country' });
      State.hasMany(models.City, { foreignKey: 'stateId', as: 'cities' });
    }
  }

  State.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    iso2: {
      type: DataTypes.STRING,
      allowNull: true
    },
    countryId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'State',
    tableName: 'states',
  });

  return State;
};
