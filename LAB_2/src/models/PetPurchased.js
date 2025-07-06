const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PetPurchased = sequelize.define('PetPurchased', {
  purchase_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  pet_shop_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  purchase_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'pet_purchased',
  timestamps: false
});

// Định nghĩa quan hệ
PetPurchased.associate = function(models) {
  PetPurchased.belongsTo(models.User, { foreignKey: 'user_id' });
  PetPurchased.belongsTo(models.PetShop, { foreignKey: 'pet_shop_id' });
};

module.exports = PetPurchased;