const rabbitmqClient = require('../utils/rabbitmq_client');
const { QUEUES } = require('../config/rabbitmq');
const taskService = require('../services/task_service');
const TaskCompleted = require('../models/TaskCompleted');
const redisClient = require('../utils/redis_client');
const sequelize = require('../config/database');
const websocketHandler = require('../utils/websocket_handler');

class TaskConsumer {
  constructor() {
    this.isProcessing = false;
    this.retryQueue = new Map();
    this.processedMessages = new Set(); // Track processed messages
  }

  async startConsuming() {
    console.log('🚀 Starting task consumers...');
    
    // Đảm bảo chỉ consume 1 lần
    if (this.isProcessing) {
      console.log('⚠️ Consumer already running, skipping...');
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Consume task operations
      await this.consumeTaskOperations();
      
      // Consume task submissions
      await this.consumeTaskSubmissions();
      
      // Consume cache invalidation
      await this.consumeCacheInvalidation();
    } catch (error) {
      console.error('❌ Error starting consumers:', error);
      this.isProcessing = false;
    }
  }

  // Check database connectivity
  async isDatabaseConnected() {
    try {
      await sequelize.authenticate();
      return true;
    } catch (error) {
      console.log('💔 Database not connected:', error.message);
      return false;
    }
  }

  // Generate unique message ID for deduplication
  getMessageId(message) {
    return `${message.operation}_${JSON.stringify(message.data)}_${message.timestamp}`;
  }

  async consumeTaskOperations() {
    await rabbitmqClient.consumeFromQueue(QUEUES.TASK_OPERATIONS, async (message) => {
      const messageId = this.getMessageId(message);
      
      // Check if already processed
      if (this.processedMessages.has(messageId)) {
        console.log('🛡️ Duplicate message detected, skipping:', messageId);
        return { success: true };
      }

      console.log('⚙️ Processing task operation:', message.operation);
      
      try {
        let result;
        switch (message.operation) {
          case 'CREATE_TASK':
            result = await this.handleTaskCreation(message.data);
            break;
          case 'UPDATE_TASK':
            result = await this.handleTaskUpdate(message.data);
            break;
          case 'DELETE_TASK':
            result = await this.handleTaskDeletion(message.data);
            break;
          default:
            console.warn('Unknown operation:', message.operation);
            return { success: false, error: 'Unknown operation' };
        }
        
        // Mark as processed
        this.processedMessages.add(messageId);
        
        // Clean up old processed messages (keep only last 1000)
        if (this.processedMessages.size > 1000) {
          const entries = Array.from(this.processedMessages);
          this.processedMessages.clear();
          entries.slice(-500).forEach(id => this.processedMessages.add(id));
        }
        
        return { success: true, result };
      } catch (error) {
        console.error('❌ Task operation failed:', error);
        return { success: false, error: error.message };
      }
    });
  }

  async consumeTaskSubmissions() {
    await rabbitmqClient.consumeFromQueue(QUEUES.TASK_SUBMISSIONS, async (message) => {
      const messageId = this.getMessageId(message);
      console.log('📥 Processing task submission:', message.data, 'ID:', messageId);
      
      // Check database connectivity first
      const dbConnected = await this.isDatabaseConnected();
      if (!dbConnected) {
        console.log('💔 Database not available, postponing submission');
        throw new Error('Database not available - submission will be retried');
      }
      
      try {
        await this.handleTaskSubmission(message.data);
        console.log('✅ Successfully processed submission:', messageId);
      } catch (error) {
        console.error('❌ Error processing task submission:', error.message);
        
        if (error.name === 'SequelizeConnectionRefusedError' || 
            error.name === 'ConnectionRefusedError' ||
            error.code === 'ECONNREFUSED') {
          console.log('💔 Database connection error - will retry later');
          throw error;
        }
        
        // For other errors, use retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          setTimeout(() => {
            rabbitmqClient.sendToQueue(QUEUES.TASK_SUBMISSIONS, message);
          }, 5000 * message.retryCount);
        } else {
          console.error('💀 Max retries reached for submission:', messageId);
        }
        
        throw error;
      }
    });
  }

  async consumeCacheInvalidation() {
    await rabbitmqClient.consumeFromQueue(QUEUES.CACHE_INVALIDATION, async (message) => {
      console.log('📥 Processing cache invalidation:', message.data);
      
      try {
        await this.handleCacheInvalidation(message.data);
      } catch (error) {
        console.error('❌ Error processing cache invalidation:', error);
        // Cache invalidation failures are not critical, so we won't retry
      }
    });
  }

  async handleTaskCreation(taskData) {
    console.log('🔨 Creating task:', taskData);
    
    const task = await taskService.createTask(taskData);
    
    // Invalidate cache
    await this.invalidateTaskCache(task.team_id, task.subject_id);
    
    // Emit WebSocket event với debug
    console.log('📡 Emitting task:created event for:', {
      teamId: task.team_id,
      subjectId: task.subject_id,
      taskId: task.task_id
    });
    
    websocketHandler.emitTaskCreated(task.team_id, task.subject_id, task);
    
    console.log('✅ Task created and event emitted');
    return task;
  }

  async handleTaskUpdate(data) {
    console.log('📝 Updating task:', data.taskId);
    
    const dbConnected = await this.isDatabaseConnected();
    if (!dbConnected) {
      throw new Error('Database not connected');
    }
    
    const task = await taskService.updateTask(data.taskId, data.updateData);
    
    if (task) {
      await this.invalidateTaskCache(task.team_id, task.subject_id);
      // Emit WebSocket event
      websocketHandler.emitTaskUpdated(task.team_id, task.subject_id, task);
    }
    
    return task;
  }

  async handleTaskDeletion(data) {
    console.log('🗑️ Deleting task:', data.taskId);
    
    const dbConnected = await this.isDatabaseConnected();
    if (!dbConnected) {
      throw new Error('Database not connected');
    }
    
    const result = await taskService.deleteTask(data.taskId);
    
    if (result) {
      await this.invalidateTaskCache(result.team_id, result.subject_id);
      // Emit WebSocket event
      websocketHandler.emitTaskDeleted(result.team_id, result.subject_id, data.taskId);
    }
    
    return result;
  }

  async handleTaskSubmission(data) {
    console.log('📤 Submitting task:', data.taskId, 'by user:', data.userId);
    
    const dbConnected = await this.isDatabaseConnected();
    if (!dbConnected) {
      throw new Error('Database not connected');
    }
    
    // Check if already submitted
    const existingSubmission = await TaskCompleted.findOne({
      where: { task_id: data.taskId, user_id: data.userId }
    });

    if (existingSubmission) {
      console.log('⚠️ Task already submitted by this user');
      return { alreadySubmitted: true };
    }

    // Get task details first
    const task = await taskService.getTaskById(data.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Create submission
    const submission = await TaskCompleted.create({
      task_id: data.taskId,
      user_id: data.userId,
      submitted_at: new Date()
    });

    // Invalidate cache
    await this.invalidateTaskCache(task.team_id, task.subject_id);
    
    // Emit WebSocket event
    websocketHandler.emitTaskSubmitted(task.team_id, task.subject_id, data.taskId, data.userId);

    console.log('✅ Task submitted successfully');
    return submission;
  }

  async handleCacheInvalidation(data) {
    console.log('🗑️ Invalidating cache keys:', data.cacheKeys);
    
    if (redisClient.isReady) {
      for (const key of data.cacheKeys) {
        await redisClient.del(key);
      }
      console.log('✅ Cache invalidated successfully');
    } else {
      console.log('⚠️ Redis not available, skipping cache invalidation');
    }
  }

  async invalidateTaskCache(teamId, subjectId) {
    if (redisClient.isReady) {
      const pattern = `tasks:${subjectId}:${teamId}:*`;
      
      try {
        for await (const key of redisClient.scanIterator(pattern)) {
          await redisClient.del(key);
        }
        console.log('✅ Task cache invalidated for team:', teamId, 'subject:', subjectId);
      } catch (error) {
        console.error('❌ Error invalidating task cache:', error);
      }
    }
  }

  // Cleanup retry tracking periodically
  startRetryCleanup() {
    setInterval(() => {
      const now = Date.now();
      const expiredMessages = [];
      
      for (const [messageId, retryInfo] of this.retryQueue.entries()) {
        if (now - retryInfo.lastAttempt > 60000) { // 1 minute
          expiredMessages.push(messageId);
        }
      }
      
      expiredMessages.forEach(messageId => {
        this.retryQueue.delete(messageId);
      });
      
      if (expiredMessages.length > 0) {
        console.log('🧹 Cleaned up', expiredMessages.length, 'expired retry entries');
      }
    }, 30000); // Every 30 seconds
  }
}

module.exports = new TaskConsumer();