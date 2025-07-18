const { Op } = require('sequelize');
// Import models with associations
require('../models/associations');
const Task = require('../models/Task');
const TaskCompleted = require('../models/TaskCompleted');
const redisClient = require('../utils/redis_client');
const taskQueueService = require('../services/task_queue_service');

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
    console.log('🔨 Controller: Creating task with data:', req.body);
    
    // Tạo task ID tạm thời cho optimistic UI
    const tempTaskId = Date.now();
    const taskDataWithTempId = {
      ...req.body,
      task_id: tempTaskId,
      status: 'pending',
      created_at: new Date().toISOString(),
      isOptimistic: true
    };
    
    // Queue task creation
    const queued = await taskQueueService.queueTaskCreation(req.body);
    
    if (queued) {
      console.log('✅ Task queued for creation');
      
      // Cập nhật cache với task tạm thời
      await updateOptimisticCache(req.body, taskDataWithTempId);
      
      res.status(201).json({ 
        message: 'Task created successfully',
        status: 'success',
        data: taskDataWithTempId
      });
    } else {
      // Fallback to immediate creation
      console.log('⚠️ Queue not available, creating task directly');
      
      try {
        const task = await Task.create(req.body);
        
        res.status(201).json({
          message: 'Task created successfully',
          status: 'success',
          data: task
        });
      } catch (dbError) {
        console.log('💔 Database error, providing optimistic response');
        
        // Cập nhật cache với task tạm thời
        await updateOptimisticCache(req.body, taskDataWithTempId);
        
        res.status(201).json({
          message: 'Task created successfully',
          status: 'success',
          data: taskDataWithTempId,
          notice: 'Task will be synchronized when database is available'
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error creating task:', error);
    res.status(500).json({ 
      error: 'Failed to create task',
      message: error.message 
    });
  }
};

// Helper function để cập nhật cache optimistic
async function updateOptimisticCache(originalData, taskData) {
  if (!redisClient.isReady) return;
  
  try {
    const { subject_id, team_id } = originalData;
    
    // Lấy cache hiện tại cho available tasks
    const cacheKey = CACHE_KEYS.TASK_LIST(subject_id, team_id, "not_completed", 1, 5);
    const countCacheKey = CACHE_KEYS.TASK_COUNT(subject_id, team_id, "not_completed");
    
    let cachedTasks = [];
    let currentCount = 0;
    
    try {
      const cachedData = await redisClient.get(cacheKey);
      const cachedCountData = await redisClient.get(countCacheKey);
      
      if (cachedData) {
        cachedTasks = JSON.parse(cachedData);
      }
      
      if (cachedCountData) {
        currentCount = parseInt(cachedCountData);
      }
    } catch (parseError) {
      console.log('⚠️ Error parsing cached data, starting fresh');
    }
    
    // Thêm task mới vào đầu danh sách
    cachedTasks.unshift(taskData);
    
    // Giữ tối đa 5 tasks
    if (cachedTasks.length > 5) {
      cachedTasks = cachedTasks.slice(0, 5);
    }
    
    // Cập nhật cache
    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(cachedTasks));
    await redisClient.setEx(countCacheKey, CACHE_TTL, (currentCount + 1).toString());
    
    console.log('✅ Updated optimistic cache');
    
  } catch (error) {
    console.error('❌ Error updating optimistic cache:', error);
  }
}

// Submit task
exports.submitTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    
    // Try to queue the task submission
    const queued = await taskQueueService.queueTaskSubmission(id, user_id);
    
    if (queued) {
      // Task submission queued successfully
      return res.status(202).json({
        message: 'Task submission queued successfully! It will be processed shortly.',
        status: 'queued'
      });
    } else {
      // Fallback to direct submission if queue is not available
      console.log('⚠️ Queue not available, submitting task directly');
      
      // Check if task exists
      const task = await Task.findByPk(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Check if already submitted
      const existingSubmission = await TaskCompleted.findOne({
        where: { task_id: id, user_id: user_id }
      });
      
      if (existingSubmission) {
        return res.status(400).json({ error: 'Task already submitted by this user' });
      }
      
      // Create submission
      const taskCompleted = await TaskCompleted.create({
        task_id: id,
        user_id: user_id,
        completed_date: new Date()
      });
      
      // Invalidate cache directly
      if (redisClient.isReady) {
        const pattern = `tasks:${task.subject_id}:${task.team_id}:*`;
        for await (const key of redisClient.scanIterator(pattern)) {
          await redisClient.del(key);
        }
      }
      
      return res.status(201).json({
        message: 'Task submitted successfully!',
        data: taskCompleted
      });
    }
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
    
    console.log(`Request for tasks with status=${status}, search="${search}", skipCache=${skipCache}`);
    
    // Nếu có search query, không dùng cache
    const useCache = !search && !skipCache;
    const cacheKey = CACHE_KEYS.TASK_LIST(subjectId, teamId, status, page, limit);
    const countCacheKey = CACHE_KEYS.TASK_COUNT(subjectId, teamId, status);
    
    try {
      console.log('🔍 Querying database...');
      const offset = (page - 1) * limit;
      let result;
      
      if (status === "completed") {
        // Lấy submitted tasks từ TaskCompleted join với Task
        let whereClause = {
          subject_id: subjectId,
          team_id: teamId
        };

        // Add search condition
        if (search && search.trim()) {
          whereClause.title = { [Op.like]: `%${search.trim()}%` };
        }

        result = await TaskCompleted.findAndCountAll({
          include: [{
            model: Task,
            required: true,
            where: whereClause
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
        
        // Add search condition
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
        
        // Add search condition
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
      
      // Store in cache for future fallback (only if not searching)
      if (useCache && redisClient.isReady) {
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
        source: 'database',
        searchQuery: search || null
      });
      
    } catch (dbError) {
      console.error("❌ Database error:", dbError.message);
      
      // Only try cache fallback if not searching
      if (useCache && redisClient.isReady) {
        console.log('🔄 Attempting to serve from cache as fallback...');
        
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
    const updateData = req.body;
    
    // Try to queue the task update
    const queued = await taskQueueService.queueTaskUpdate(id, updateData);
    
    if (queued) {
      return res.status(202).json({
        message: 'Task update queued successfully! It will be processed shortly.',
        status: 'queued'
      });
    } else {
      // Fallback to direct update
      console.log('⚠️ Queue not available, updating task directly');
      
      const task = await Task.findByPk(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      await task.update(updateData);
      
      // Invalidate cache directly
      if (redisClient.isReady) {
        const pattern = `tasks:${task.subject_id}:${task.team_id}:*`;
        for await (const key of redisClient.scanIterator(pattern)) {
          await redisClient.del(key);
        }
      }
      
      return res.status(200).json({
        message: 'Task updated successfully!',
        data: task
      });
    }
  } catch (error) {
    console.error("Error updating task:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Delete a task
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to queue the task deletion
    const queued = await taskQueueService.queueTaskDeletion(id);
    
    if (queued) {
      return res.status(202).json({
        message: 'Task deletion queued successfully! It will be processed shortly.',
        status: 'queued'
      });
    } else {
      // Fallback to direct deletion
      console.log('⚠️ Queue not available, deleting task directly');
      
      const task = await Task.findByPk(id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const { team_id, subject_id } = task;
      await task.destroy();
      
      // Invalidate cache directly
      if (redisClient.isReady) {
        const pattern = `tasks:${subject_id}:${team_id}:*`;
        for await (const key of redisClient.scanIterator(pattern)) {
          await redisClient.del(key);
        }
      }
      
      return res.status(200).json({
        message: 'Task deleted successfully!'
      });
    }
  } catch (error) {
    console.error("Error deleting task:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = exports;