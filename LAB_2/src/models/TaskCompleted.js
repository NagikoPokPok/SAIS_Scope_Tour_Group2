const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TasksCompleted = sequelize.define('TasksCompleted', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  task_id: {
    type: DataTypes.INTEGER,
    allowNull: false
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

// Định nghĩa quan hệ
TasksCompleted.associate = function(models) {
  TasksCompleted.belongsTo(models.Task, { foreignKey: 'task_id' });
  TasksCompleted.belongsTo(models.User, { foreignKey: 'user_id' });
};

module.exports = TasksCompleted;