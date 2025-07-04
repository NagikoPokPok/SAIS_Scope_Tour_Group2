const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PetShop = sequelize.define('PetShop', {
  pet_shop_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  pet_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  price: {
    type: DataTypes.INTEGER
  },
  pet_img: {
    type: DataTypes.STRING(500)
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'pet_shop',
  timestamps: false
});

// Định nghĩa quan hệ
PetShop.associate = function(models) {
  PetShop.hasMany(models.Pet, { foreignKey: 'pet_type_id', as: 'pets' });
  PetShop.hasMany(models.PetPurchased, { foreignKey: 'pet_shop_id' });
};

module.exports = PetShop;