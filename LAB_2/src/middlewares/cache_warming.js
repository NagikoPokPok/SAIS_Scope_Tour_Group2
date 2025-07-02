const redisClient = require('../utils/redisClient');
const Task = require('../models/Task');
const { Op } = require('sequelize');

// Cache configuration
const CACHE_TTL = 3600; // 1 hour cache expiration
const CACHE_KEYS = {
  TASK_LIST: (subjectId, teamId, status, page, limit) => 
    `tasks:${subjectId}:${teamId}:${status || 'all'}:page${page}:limit${limit}`,
  TASK_COUNT: (subjectId, teamId, status) => 
    `tasks:count:${subjectId}:${teamId}:${status || 'all'}`
};

// Function to warm up cache for a specific team and subject
async function warmTaskCache(teamId, subjectId) {
  if (!redisClient.isReady) return false;
  
  try {
    console.log(`⏳ Warming cache for team ${teamId}, subject ${subjectId}...`);
    
    // Cache available tasks (page 1)
    const availableWhere = { 
      team_id: teamId, 
      subject_id: subjectId,
      status: { [Op.ne]: "completed" } 
    };
    
    const { count: availableCount, rows: availableTasks } = await Task.findAndCountAll({
      where: availableWhere,
      limit: 5,
      offset: 0,
      order: [['created_at', 'DESC']]
    });
    
    // Cache completed tasks (page 1)
    const completedWhere = { 
      team_id: teamId, 
      subject_id: subjectId,
      status: "completed" 
    };
    
    const { count: completedCount, rows: completedTasks } = await Task.findAndCountAll({
      where: completedWhere,
      limit: 5,
      offset: 0,
      order: [['created_at', 'DESC']]
    });
    
    // Store available tasks in cache
    const availableCacheKey = CACHE_KEYS.TASK_LIST(subjectId, teamId, "not_completed", 1, 5);
    const availableCountKey = CACHE_KEYS.TASK_COUNT(subjectId, teamId, "not_completed");
    await redisClient.setEx(availableCacheKey, CACHE_TTL, JSON.stringify(availableTasks));
    await redisClient.setEx(availableCountKey, CACHE_TTL, availableCount.toString());
    
    // Store completed tasks in cache
    const completedCacheKey = CACHE_KEYS.TASK_LIST(subjectId, teamId, "completed", 1, 5);
    const completedCountKey = CACHE_KEYS.TASK_COUNT(subjectId, teamId, "completed");
    await redisClient.setEx(completedCacheKey, CACHE_TTL, JSON.stringify(completedTasks));
    await redisClient.setEx(completedCountKey, CACHE_TTL, completedCount.toString());
    
    console.log(`✅ Cache warmed for team ${teamId}, subject ${subjectId}`);
    return true;
  } catch (error) {
    console.error("Error warming cache:", error);
    return false;
  }
}

module.exports = {
  warmTaskCache
};