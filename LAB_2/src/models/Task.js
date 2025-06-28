const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define('Task', {
  task_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  team_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  subject_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  due_date: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'pending'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'task',
  timestamps: false
});

// Định nghĩa quan hệ
Task.associate = function(models) {
  Task.belongsTo(models.User, { foreignKey: 'user_id' });
  Task.belongsTo(models.Team, { foreignKey: 'team_id' });
  Task.belongsTo(models.Subject, { foreignKey: 'subject_id' });
  Task.hasMany(models.TasksCompleted, { foreignKey: 'task_id' });
};

module.exports = Task;