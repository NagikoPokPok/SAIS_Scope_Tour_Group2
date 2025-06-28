const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Streak = sequelize.define('Streak', {
  streak_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  current_streak: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  longest_streak: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_completed_date: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'streak',
  timestamps: false
});

// Định nghĩa quan hệ
Streak.associate = function(models) {
  Streak.belongsTo(models.User, { foreignKey: 'user_id' });
};

module.exports = Streak;