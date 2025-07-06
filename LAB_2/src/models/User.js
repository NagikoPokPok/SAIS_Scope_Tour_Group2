const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255)
  },
  user_name: {
    type: DataTypes.STRING(100)
  },
  phone_number: {
    type: DataTypes.STRING(20)
  },
  user_img: {
    type: DataTypes.STRING(500)
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  //OTP verify
  otp: {
    type: DataTypes.STRING,
    allowNull: true
  },
  otp_expiry: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'user',
  timestamps: false
});

// Định nghĩa quan hệ
User.associate = function(models) {
  User.hasMany(models.Message, { foreignKey: 'sender_id', as: 'sentMessages' });
  User.hasMany(models.Pet, { foreignKey: 'user_id' });
  User.hasMany(models.PetPurchased, { foreignKey: 'user_id' });
  User.hasMany(models.Streak, { foreignKey: 'user_id' });
  User.hasMany(models.Task, { foreignKey: 'user_id' });
  User.hasMany(models.TasksCompleted, { foreignKey: 'user_id' });
  User.hasMany(models.Team, { foreignKey: 'created_by', as: 'createdTeams' });
  User.hasMany(models.TeamMember, { foreignKey: 'user_id' });
};

module.exports = User;