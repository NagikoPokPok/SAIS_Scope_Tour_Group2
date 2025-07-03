// task_controller.js
const { Op } = require('sequelize');
const Task = require('../models/Task');  // Use Task model
const redisClient = require('../utils/redisClient');

// Cache configuration
const CACHE_TTL = 3600; // 1 hour cache expiration
const CACHE_KEYS = {
  TASK_LIST: (subjectId, teamId, status, page, limit) => 
    `tasks:${subjectId}:${teamId}:${status || 'all'}:page${page}:limit${limit}`,
  TASK_DETAIL: (taskId) => `task:${taskId}`,
  TASK_COUNT: (subjectId, teamId, status) => 
    `tasks:count:${subjectId}:${teamId}:${status || 'all'}`
};


// Create a new task
exports.createTask = async (req, res) => {
  try {
    const { user_id, team_id, subject_id, title, description, start_date, end_date } = req.body;
    
    console.log("Received payload:", req.body);
    
    if (!subject_id || !title) {
      return res.status(400).json({ error: 'subject_id and title are required' });
    }
    
    const newTask = await Task.create({
      user_id,
      team_id,
      subject_id,
      title,
      description,
      start_date,
      end_date,
      status: 'pending'
    });
    
    // Invalidate relevant cache keys when new task is created
    if (redisClient.isReady) {
      // Pattern to match all task list caches for this subject and team
      const pattern = `tasks:${subject_id}:${team_id}:*`;
      
      try {
        // Get all matching keys
        for await (const key of redisClient.scanIterator(pattern)) {
          await redisClient.del(key);
          console.log(`🗑️ Invalidated cache key: ${key}`);
        }
      } catch (cacheError) {
        console.error("Cache invalidation error:", cacheError);
        // Continue execution even if cache invalidation fails
      }
    }
    
    return res.status(201).json({
      message: 'Task created successfully!',
      data: newTask
    });
  } catch (error) {
    console.error("Error creating task:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Fetch tasks by subject and team (with optional search)
exports.getTasks = async (req, res) => {
  try {
    const { subjectId, teamId, search, status } = req.query;
    const { page = 1, limit = 5 } = req.query;
    
    // Don't use cache for search queries as they're less likely to be repeated
    const useCache = !search && redisClient.isReady;
    
    // Create cache keys
    const cacheKey = CACHE_KEYS.TASK_LIST(subjectId, teamId, status, page, limit);
    const countCacheKey = CACHE_KEYS.TASK_COUNT(subjectId, teamId, status);
    
    if (useCache) {
      // Try to get from cache first
      const cachedData = await redisClient.get(cacheKey);
      const cachedCount = await redisClient.get(countCacheKey);
      
      if (cachedData && cachedCount) {
        console.log('✅ Cache hit for tasks');
        const tasks = JSON.parse(cachedData);
        const count = parseInt(cachedCount);
        
        return res.status(200).json({
          tasks,
          total: count,
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          fromCache: true
        });
      }
    }
    
    // Cache miss or no cache, query the database
    let whereClause = {};
    if (subjectId) whereClause.subject_id = subjectId;
    if (teamId) whereClause.team_id = teamId;
    if (search && search.trim()) {
      whereClause.title = { [Op.like]: `%${search.trim()}%` };
    }
    
    // Add status filter
    if (status === "completed") {
      whereClause.status = "completed";
    } else if (status === "not_completed") {
      whereClause.status = { [Op.ne]: "completed" };
    }
    
    // Execute database query
    try {
      const offset = (page - 1) * limit;
      const { count, rows } = await Task.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });
      
      // Store in cache if Redis is ready
      if (useCache) {
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(rows));
        await redisClient.setEx(countCacheKey, CACHE_TTL, count.toString());
        console.log(`✅ Cached tasks data at key: ${cacheKey}`);
      }
      
      return res.status(200).json({
        tasks: rows,
        total: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        fromCache: false
      });
    } catch (dbError) {
      // Database error - try to use cache as fallback
      console.error("Database error:", dbError);
      
      if (redisClient.isReady) {
        const cachedData = await redisClient.get(cacheKey);
        const cachedCount = await redisClient.get(countCacheKey);
        
        if (cachedData && cachedCount) {
          console.log('⚠️ Database error but serving from cache');
          const tasks = JSON.parse(cachedData);
          const count = parseInt(cachedCount);
          
          return res.status(200).json({
            tasks,
            total: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit),
            fromCache: true,
            notice: "Data is served from cache due to database issues"
          });
        }
      }
      
      // No cached data available, must return error
      throw dbError;
    }
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get a single task by id
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = CACHE_KEYS.TASK_DETAIL(id);
    
    // Try cache first if Redis is ready
    if (redisClient.isReady) {
      const cachedTask = await redisClient.get(cacheKey);
      if (cachedTask) {
        console.log(`✅ Cache hit for task ${id}`);
        return res.status(200).json(JSON.parse(cachedTask));
      }
    }
    
    // Cache miss - try database
    try {
      const task = await Task.findByPk(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      
      // Cache the result
      if (redisClient.isReady) {
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(task));
        console.log(`✅ Cached task ${id}`);
      }
      
      return res.status(200).json(task);
    } catch (dbError) {
      console.error("Database error:", dbError);
      
      // If database failed, try cache as last resort
      if (redisClient.isReady) {
        const cachedTask = await redisClient.get(cacheKey);
        if (cachedTask) {
          console.log(`⚠️ Serving task ${id} from cache due to database error`);
          return res.status(200).json({
            ...JSON.parse(cachedTask),
            fromCache: true,
            notice: "Data is served from cache due to database issues"
          });
        }
      }
      
      throw dbError;
    }
  } catch (error) {
    console.error("Error fetching task:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Update a task
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, start_date, end_date, status, completed_at } = req.body;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    // Build update object with only provided fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (start_date !== undefined) updateData.start_date = start_date ? new Date(start_date) : null;
    if (end_date !== undefined) updateData.end_date = end_date ? new Date(end_date) : null;
    if (status !== undefined) updateData.status = status;
    if (completed_at !== undefined) updateData.completed_at = completed_at;
    
    await task.update(updateData);
    
    // Invalidate caches
    if (redisClient.isReady) {
      try {
        // Delete specific task cache
        const taskCacheKey = CACHE_KEYS.TASK_DETAIL(id);
        await redisClient.del(taskCacheKey);
        
        // Delete task list caches for this task's subject and team
        const pattern = `tasks:${task.subject_id}:${task.team_id}:*`;
        for await (const key of redisClient.scanIterator(pattern)) {
          await redisClient.del(key);
          console.log(`🗑️ Invalidated cache key: ${key}`);
        }
      } catch (cacheError) {
        console.error("Cache invalidation error:", cacheError);
      }
    }
    
    return res.status(200).json({
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    console.error("Error updating task:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Delete a task
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    // Store team_id and subject_id before deletion for cache invalidation
    const { team_id, subject_id } = task;
    
    await task.destroy();
    
    // Invalidate caches
    if (redisClient.isReady) {
      try {
        // Delete specific task cache
        const taskCacheKey = CACHE_KEYS.TASK_DETAIL(id);
        await redisClient.del(taskCacheKey);
        
        // Delete task list caches
        const pattern = `tasks:${subject_id}:${team_id}:*`;
        for await (const key of redisClient.scanIterator(pattern)) {
          await redisClient.del(key);
          console.log(`🗑️ Invalidated cache key: ${key}`);
        }
      } catch (cacheError) {
        console.error("Cache invalidation error:", cacheError);
      }
    }
    
    return res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = exports;