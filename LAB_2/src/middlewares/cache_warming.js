const redisClient = require('../utils/redis_client');
// Import models with associations
require('../models/associations');
const Task = require('../models/Task');
const TaskCompleted = require('../models/TaskCompleted');
const { Op } = require('sequelize');

// Cache configuration
const CACHE_TTL = 3600;
const CACHE_KEYS = {
  TASK_LIST: (subjectId, teamId, status, page, limit) => 
    `tasks:${subjectId}:${teamId}:${status || 'all'}:page${page}:limit${limit}`,
  TASK_COUNT: (subjectId, teamId, status) => 
    `tasks:count:${subjectId}:${teamId}:${status || 'all'}`
};

async function warmTaskCache(teamId, subjectId) {
  if (!redisClient.isReady) return false;
  
  try {
    console.log(`⏳ Warming cache for team ${teamId}, subject ${subjectId}...`);
    
    // Cache available tasks - những task chưa có trong TaskCompleted
    const completedTaskIds = await TaskCompleted.findAll({
      attributes: ['task_id'],
      raw: true
    }).then(results => results.map(r => r.task_id));
    
    const availableWhere = { 
      team_id: teamId, 
      subject_id: subjectId,
      task_id: { [Op.notIn]: completedTaskIds.length > 0 ? completedTaskIds : [-1] }
    };
    
    const { count: availableCount, rows: availableTasks } = await Task.findAndCountAll({
      where: availableWhere,
      limit: 5,
      offset: 0,
      order: [['created_at', 'DESC']]
    });
    
    // Cache completed tasks - từ TaskCompleted join Task
    const { count: completedCount, rows: completedData } = await TaskCompleted.findAndCountAll({
      include: [{
        model: Task,
        required: true,
        where: {
          subject_id: subjectId,
          team_id: teamId
        }
      }],
      limit: 5,
      offset: 0,
      order: [['completed_date', 'DESC']]
    });
    
    // Transform completed data
    const completedTasks = completedData.map(tc => ({
      task_id: tc.Task.task_id,
      title: tc.Task.title,
      description: tc.Task.description,
      start_date: tc.Task.start_date,
      end_date: tc.Task.end_date,
      subject_id: tc.Task.subject_id,
      team_id: tc.Task.team_id,
      user_id: tc.user_id,
      completed_at: tc.completed_date,
      status: 'completed'
    }));
    
    // Store in cache
    const availableCacheKey = CACHE_KEYS.TASK_LIST(subjectId, teamId, "not_completed", 1, 5);
    const availableCountKey = CACHE_KEYS.TASK_COUNT(subjectId, teamId, "not_completed");
    await redisClient.setEx(availableCacheKey, CACHE_TTL, JSON.stringify(availableTasks));
    await redisClient.setEx(availableCountKey, CACHE_TTL, availableCount.toString());
    
    const completedCacheKey = CACHE_KEYS.TASK_LIST(subjectId, teamId, "completed", 1, 5);
    const completedCountKey = CACHE_KEYS.TASK_COUNT(subjectId, teamId, "completed");
    await redisClient.setEx(completedCacheKey, CACHE_TTL, JSON.stringify(completedTasks));
    await redisClient.setEx(completedCountKey, CACHE_TTL, completedCount.toString());
    
    console.log(`✅ Cache warmed for team ${teamId}, subject ${subjectId} - Available: ${availableCount}, Completed: ${completedCount}`);
    return true;
  } catch (error) {
    console.error("Error warming cache:", error);
    return false;
  }
}

module.exports = {
  warmTaskCache
};