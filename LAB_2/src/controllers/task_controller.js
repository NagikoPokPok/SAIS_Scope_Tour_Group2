// task_controller.js
const { Op } = require('sequelize');
const Task = require('../models/Task');  // Use Task model

// Create a new task
exports.createTask = async (req, res) => {
  try {
    const { user_id, team_id, subject_id, title, description, start_date, end_date } = req.body;
    
    // Debug log to see what's received
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
    // Xóa cache cho các danh sách task
    const listPattern = `tasks:${subject_id}:${team_id}:*`;
    const countPattern = `tasks:count:${subject_id}:${team_id}:*`;
    
    let deletedCount = 0;
    
    // Xóa cache danh sách
    for await (const key of redisClient.scanIterator(listPattern)) {
      await redisClient.del(key);
      deletedCount++;
      console.log(`🗑️ Invalidated list cache: ${key}`);
    }
    
    // Xóa cache đếm số lượng
    for await (const key of redisClient.scanIterator(countPattern)) {
      await redisClient.del(key);
      deletedCount++;
      console.log(`🗑️ Invalidated count cache: ${key}`);
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

// Fetch tasks by subject and team (with optional search)
exports.getTasks = async (req, res) => {
  try {
    const { subjectId, teamId, search, status, skipCache } = req.query;
    const { page = 1, limit = 5 } = req.query;
    
    // Không sử dụng cache nếu có skipCache=true hoặc đang search
    const useCache = !skipCache && !search && redisClient.isReady;
    
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
    // Thêm lọc status
    if (status === "completed") {
      whereClause.status = "completed";
    } else if (status === "not_completed") {
      whereClause.status = { [Op.ne]: "completed" };
    }
    // const tasks = await Task.findAll({ where: whereClause });
    // return res.status(200).json({ tasks });

    // Pagination parameters
    const { page = 1, limit = 5 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Task.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      tasks: rows,
      total: count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });

  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Get a single task by id
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByPk(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.status(200).json(task);
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
    console.log(`⏳ Invalidating cache after updating task ${id}...`);
    
    // Delete specific task cache
    const taskCacheKey = CACHE_KEYS.TASK_DETAIL(id);
    await redisClient.del(taskCacheKey);
    
    // Delete all list caches for this task's subject and team
    const listPattern = `tasks:${task.subject_id}:${task.team_id}:*`;
    const countPattern = `tasks:count:${task.subject_id}:${task.team_id}:*`;
    
    let deletedCount = 0;
    
    // Delete list caches
    for await (const key of redisClient.scanIterator(listPattern)) {
      await redisClient.del(key);
      deletedCount++;
      console.log(`🗑️ Invalidated list cache: ${key}`);
    }
    
    // Delete count caches
    for await (const key of redisClient.scanIterator(countPattern)) {
      await redisClient.del(key);
      deletedCount++;
      console.log(`🗑️ Invalidated count cache: ${key}`);
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
    await task.destroy();
    
    // Invalidate caches
    if (redisClient.isReady) {
  try {
    console.log(`⏳ Invalidating cache after deleting task ${id}...`);
    
    // Delete specific task cache
    const taskCacheKey = CACHE_KEYS.TASK_DETAIL(id);
    await redisClient.del(taskCacheKey);
    
    // Delete all list caches for this task's subject and team
    const listPattern = `tasks:${subject_id}:${team_id}:*`;
    const countPattern = `tasks:count:${subject_id}:${team_id}:*`;
    
    let deletedCount = 0;
    
    // Delete list caches
    for await (const key of redisClient.scanIterator(listPattern)) {
      await redisClient.del(key);
      deletedCount++;
      console.log(`🗑️ Invalidated list cache: ${key}`);
    }
    
    // Delete count caches
    for await (const key of redisClient.scanIterator(countPattern)) {
      await redisClient.del(key);
      deletedCount++;
      console.log(`🗑️ Invalidated count cache: ${key}`);
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