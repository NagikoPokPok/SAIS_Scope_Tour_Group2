const Task = require('./Task');
const TaskCompleted = require('./TaskCompleted');

// Set up associations
Task.hasMany(TaskCompleted, { 
  foreignKey: 'task_id',
  sourceKey: 'task_id'
});

TaskCompleted.belongsTo(Task, { 
  foreignKey: 'task_id',
  targetKey: 'task_id'
});

module.exports = {
  Task,
  TaskCompleted
};