const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pet = sequelize.define('Pet', {
  pet_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  pet_type_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  pet_name: {
    type: DataTypes.STRING(100)
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  experience: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  acquired_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  pet_img: {
    type: DataTypes.STRING(500)
  }
}, {
  tableName: 'pet',
  timestamps: false
});

// Định nghĩa quan hệ
Pet.associate = function(models) {
  Pet.belongsTo(models.User, { foreignKey: 'user_id' });
  Pet.belongsTo(models.PetShop, { foreignKey: 'pet_type_id', as: 'petType' }); // Giả sử pet_type_id trỏ đến PetShop
};

module.exports = Pet;