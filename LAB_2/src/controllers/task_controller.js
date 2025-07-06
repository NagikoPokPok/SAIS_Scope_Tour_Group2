const { Op } = require('sequelize');
// Import models with associations
require('../models/associations');
const Task = require('../models/Task');
const TaskCompleted = require('../models/TaskCompleted');
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
      console.log('⏳ Invalidating cache after adding new task...');
      
      try {
        const listPattern = `tasks:${subject_id}:${team_id}:*`;
        const countPattern = `tasks:count:${subject_id}:${team_id}:*`;
        
        let deletedCount = 0;
        
        for await (const key of redisClient.scanIterator(listPattern)) {
          await redisClient.del(key);
          deletedCount++;
        }
        
        for await (const key of redisClient.scanIterator(countPattern)) {
          await redisClient.del(key);
          deletedCount++;
        }
        
        console.log(`✅ Total ${deletedCount} cache keys invalidated successfully`);
      } catch (cacheError) {
        console.error("❌ Cache invalidation error:", cacheError);
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

// Submit task
exports.submitTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body; // user_id của người submit
    
    // Kiểm tra task có tồn tại không
    const task = await Task.findByPk(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Kiểm tra xem task đã được submit chưa
    const existingSubmission = await TaskCompleted.findOne({
      where: { task_id: id, user_id: user_id }
    });
    
    if (existingSubmission) {
      return res.status(400).json({ error: 'Task already submitted by this user' });
    }
    
    // Tạo bản ghi trong TaskCompleted
    const taskCompleted = await TaskCompleted.create({
      task_id: id,
      user_id: user_id,
      completed_date: new Date()
    });
    
    // Invalidate cache
    if (redisClient.isReady) {
      try {
        console.log(`⏳ Invalidating cache after submitting task ${id}...`);
        
        const listPattern = `tasks:${task.subject_id}:${task.team_id}:*`;
        const countPattern = `tasks:count:${task.subject_id}:${task.team_id}:*`;
        
        let deletedCount = 0;
        
        for await (const key of redisClient.scanIterator(listPattern)) {
          await redisClient.del(key);
          deletedCount++;
        }
        
        for await (const key of redisClient.scanIterator(countPattern)) {
          await redisClient.del(key);
          deletedCount++;
        }
        
        console.log(`✅ Total ${deletedCount} cache keys invalidated successfully for task submission`);
      } catch (cacheError) {
        console.error("❌ Cache invalidation error:", cacheError);
      }
    }
    
    return res.status(201).json({
      message: 'Task submitted successfully!',
      data: taskCompleted
    });
  } catch (error) {
    console.error("Error submitting task:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Fetch tasks
exports.getTasks = async (req, res) => {
  try {
    const { subjectId, teamId, search, status } = req.query;
    const skipCache = req.query.skipCache === 'true';
    const { page = 1, limit = 5 } = req.query;
    
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    console.log(`Request for tasks with status=${status}, skipCache=${skipCache}`);
    
    const cacheKey = CACHE_KEYS.TASK_LIST(subjectId, teamId, status, page, limit);
    const countCacheKey = CACHE_KEYS.TASK_COUNT(subjectId, teamId, status);
    
    try {
      console.log('🔍 Querying database first...');
      const offset = (page - 1) * limit;
      let result;
      
      if (status === "completed") {
        // Lấy submitted tasks từ TaskCompleted join với Task
        result = await TaskCompleted.findAndCountAll({
          include: [{
            model: Task,
            required: true,
            where: {
              subject_id: subjectId,
              team_id: teamId,
              ...(search && search.trim() ? { title: { [Op.like]: `%${search.trim()}%` } } : {})
            }
          }],
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [['completed_date', 'DESC']]
        });
        
        // Transform data để có cấu trúc giống Task
        const transformedRows = result.rows.map(tc => ({
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
        
        result = { count: result.count, rows: transformedRows };
        
      } else if (status === "not_completed") {
        // Lấy available tasks - những task chưa có trong TaskCompleted
        const completedTaskIds = await TaskCompleted.findAll({
          attributes: ['task_id'],
          raw: true
        }).then(results => results.map(r => r.task_id));
        
        let whereClause = {
          subject_id: subjectId,
          team_id: teamId,
          task_id: { [Op.notIn]: completedTaskIds.length > 0 ? completedTaskIds : [-1] }
        };
        
        if (search && search.trim()) {
          whereClause.title = { [Op.like]: `%${search.trim()}%` };
        }
        
        result = await Task.findAndCountAll({
          where: whereClause,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [['created_at', 'DESC']]
        });
      } else {
        // Lấy tất cả tasks
        let whereClause = {
          subject_id: subjectId,
          team_id: teamId
        };
        
        if (search && search.trim()) {
          whereClause.title = { [Op.like]: `%${search.trim()}%` };
        }
        
        result = await Task.findAndCountAll({
          where: whereClause,
          limit: parseInt(limit),
          offset: parseInt(offset),
          order: [['created_at', 'DESC']]
        });
      }
      
      console.log(`✅ Database query successful - found ${result.count} tasks`);
      
      // Store in cache for future fallback
      if (!search && redisClient.isReady) {
        try {
          await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result.rows));
          await redisClient.setEx(countCacheKey, CACHE_TTL, result.count.toString());
          console.log(`💾 Updated cache at key: ${cacheKey}`);
        } catch (cacheError) {
          console.warn(`⚠️ Cache update failed: ${cacheError.message}`);
        }
      }
      
      return res.status(200).json({
        tasks: result.rows,
        total: result.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(result.count / limit),
        source: 'database'
      });
      
    } catch (dbError) {
      console.error("❌ Database error:", dbError.message);
      console.log('🔄 Attempting to serve from cache as fallback...');
      
      if (redisClient.isReady && !search) {
        try {
          const cachedData = await redisClient.get(cacheKey);
          const cachedCount = await redisClient.get(countCacheKey);
          
          if (cachedData && cachedCount) {
            console.log('✅ Cache fallback successful');
            const tasks = JSON.parse(cachedData);
            const count = parseInt(cachedCount);
            
            return res.status(200).json({
              tasks,
              total: count,
              currentPage: parseInt(page),
              totalPages: Math.ceil(count / limit),
              source: 'cache_fallback',
              notice: "Data is served from cache due to database issues"
            });
          } else {
            console.log('⚠️ No cache data available for fallback');
          }
        } catch (cacheError) {
          console.error("❌ Cache fallback also failed:", cacheError.message);
        }
      } else {
        console.log('⚠️ Cache not available (Redis not ready or search query)');
      }
      
      console.error("💥 Both database and cache failed");
      throw new Error(`Service temporarily unavailable: ${dbError.message}`);
    }
    
  } catch (error) {
    console.error("Error in getTasks:", error);
    return res.status(500).json({ 
      error: error.message,
      message: "Unable to fetch tasks at this time"
    });
  }
};
// Get a single task by id
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = CACHE_KEYS.TASK_DETAIL(id);
    
    if (redisClient.isReady) {
      const cachedTask = await redisClient.get(cacheKey);
      if (cachedTask) {
        console.log(`✅ Cache hit for task ${id}`);
        return res.status(200).json(JSON.parse(cachedTask));
      }
    }
    
    try {
      const task = await Task.findByPk(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      
      // Kiểm tra xem task có được submit chưa
      const taskCompleted = await TaskCompleted.findOne({
        where: { task_id: id }
      });
      
      const taskWithStatus = {
        ...task.toJSON(),
        isCompleted: !!taskCompleted,
        completed_date: taskCompleted?.completed_date || null
      };
      
      if (redisClient.isReady) {
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(taskWithStatus));
        console.log(`✅ Cached task ${id}`);
      }
      
      return res.status(200).json(taskWithStatus);
    } catch (dbError) {
      console.error("Database error:", dbError);
      
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
    const { title, description, start_date, end_date } = req.body;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (start_date !== undefined) updateData.start_date = start_date ? new Date(start_date) : null;
    if (end_date !== undefined) updateData.end_date = end_date ? new Date(end_date) : null;
    
    await task.update(updateData);
    
    // Invalidate caches
    if (redisClient.isReady) {
      try {
        console.log(`⏳ Invalidating cache after updating task ${id}...`);
        
        const taskCacheKey = CACHE_KEYS.TASK_DETAIL(id);
        await redisClient.del(taskCacheKey);
        
        const listPattern = `tasks:${task.subject_id}:${task.team_id}:*`;
        const countPattern = `tasks:count:${task.subject_id}:${task.team_id}:*`;
        
        let deletedCount = 0;
        
        for await (const key of redisClient.scanIterator(listPattern)) {
          await redisClient.del(key);
          deletedCount++;
        }
        
        for await (const key of redisClient.scanIterator(countPattern)) {
          await redisClient.del(key);
          deletedCount++;
        }
        
        console.log(`✅ Total ${deletedCount} cache keys invalidated successfully for task update`);
      } catch (cacheError) {
        console.error("❌ Cache invalidation error:", cacheError);
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
    
    const { team_id, subject_id } = task;
    
    // Xóa task completion record nếu có
    await TaskCompleted.destroy({
      where: { task_id: id }
    });
    
    // Xóa task
    await task.destroy();
    
    // Invalidate caches
    if (redisClient.isReady) {
      try {
        console.log(`⏳ Invalidating cache after deleting task ${id}...`);
        
        const taskCacheKey = CACHE_KEYS.TASK_DETAIL(id);
        await redisClient.del(taskCacheKey);
        
        const listPattern = `tasks:${subject_id}:${team_id}:*`;
        const countPattern = `tasks:count:${subject_id}:${team_id}:*`;
        
        let deletedCount = 0;
        
        for await (const key of redisClient.scanIterator(listPattern)) {
          await redisClient.del(key);
          deletedCount++;
        }
        
        for await (const key of redisClient.scanIterator(countPattern)) {
          await redisClient.del(key);
          deletedCount++;
        }
        
        console.log(`✅ Total ${deletedCount} cache keys invalidated successfully for task deletion`);
      } catch (cacheError) {
        console.error("❌ Cache invalidation error:", cacheError);
      }
    }
    
    return res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = exports;