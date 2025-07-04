const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaskCompleted = sequelize.define('TaskCompleted', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  task_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'task',
      key: 'task_id'
    }
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  completed_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'task_completed',
  timestamps: false
});

module.exports = TaskCompleted;