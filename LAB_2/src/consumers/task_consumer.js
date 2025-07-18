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
    this.processedMessages = new Set();
    this.dbCheckInterval = null;
    this.isDbConnected = false;
    this.retryCleanupInterval = null;
    this.startDatabaseMonitoring();
  }

  // Database monitoring
  startDatabaseMonitoring() {
    this.dbCheckInterval = setInterval(async () => {
      const wasConnected = this.isDbConnected;
      this.isDbConnected = await this.isDatabaseConnected();
      
      if (!wasConnected && this.isDbConnected) {
        console.log('🔄 Database reconnected! Queued messages will be processed now.');
      } else if (wasConnected && !this.isDbConnected) {
        console.log('💔 Database disconnected! New messages will be queued.');
      }
      
      // Log trạng thái chi tiết
      console.log(`💓 Database monitor - Connection: ${this.isDbConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    }, 5000);
  }

  // Check database connectivity
  async isDatabaseConnected() {
    try {
      await sequelize.authenticate();
      return true;
    } catch (error) {
      return false;
    }
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

  // Generate unique message ID for deduplication
  getMessageId(message) {
    return `${message.operation}_${JSON.stringify(message.data)}_${message.timestamp}`;
  }

  async consumeTaskOperations() {
    await rabbitmqClient.consumeFromQueue(QUEUES.TASK_OPERATIONS, async (message) => {
      const messageId = this.getMessageId(message);
      
      console.log('⚙️ Processing task operation:', message.operation, 'Message ID:', messageId);
      
      // Check if already processed
      if (this.processedMessages.has(messageId)) {
        console.log('🛡️ Duplicate message detected, skipping:', messageId);
        return { success: true, reason: 'already_processed' };
      }

      // QUAN TRỌNG: Check database connection trước khi xử lý
      const dbConnected = await this.isDatabaseConnected();
      console.log('💓 Database connection status:', dbConnected ? 'CONNECTED' : 'DISCONNECTED');
      
      if (!dbConnected) {
        console.log('💔 Database not connected, message will be requeued');
        return { success: false, reason: 'database_disconnected' };
      }

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
            console.warn('❓ Unknown operation:', message.operation);
            return { success: false, reason: 'unknown_operation' };
        }
        
        // Đánh dấu đã xử lý thành công
        this.processedMessages.add(messageId);
        
        console.log('✅ Task operation completed successfully:', message.operation);
        return { success: true, result };
        
      } catch (error) {
        console.error('❌ Task operation failed:', error.message);
        
        // Kiểm tra loại lỗi
        if (this.isDatabaseError(error)) {
          console.log('💔 Database error detected - message will be requeued');
          return { success: false, reason: 'database_error', error: error.message };
        }
        
        // Với lỗi khác, đánh dấu đã xử lý để tránh infinite retry
        this.processedMessages.add(messageId);
        return { success: false, reason: 'processing_error', error: error.message };
      }
    });
  }

  async consumeTaskSubmissions() {
    await rabbitmqClient.consumeFromQueue(QUEUES.TASK_SUBMISSIONS, async (message) => {
      const messageId = this.getMessageId(message);
      console.log('📥 Processing task submission:', message.data, 'ID:', messageId);
      
      // Check if already processed
      if (this.processedMessages.has(messageId)) {
        console.log('🛡️ Duplicate submission detected, skipping:', messageId);
        return { success: true, reason: 'already_processed' };
      }
      
      // Check database connection
      if (!this.isDbConnected) {
        console.log('💔 Database not available, postponing submission');
        return { success: false, reason: 'database_disconnected' };
      }
      
      try {
        const result = await this.handleTaskSubmission(message.data);
        
        // Đánh dấu đã xử lý thành công
        this.processedMessages.add(messageId);
        
        console.log('✅ Successfully processed submission:', messageId);
        return { success: true, result };
        
      } catch (error) {
        console.error('❌ Error processing task submission:', error.message);
        
        if (this.isDatabaseError(error)) {
          console.log('💔 Database connection error - submission will be retried');
          return { success: false, reason: 'database_error', error: error.message };
        }
        
        // Với lỗi khác, đánh dấu đã xử lý
        this.processedMessages.add(messageId);
        return { success: false, reason: 'processing_error', error: error.message };
      }
    });
  }

  async consumeCacheInvalidation() {
    await rabbitmqClient.consumeFromQueue(QUEUES.CACHE_INVALIDATION, async (message) => {
      console.log('📥 Processing cache invalidation:', message.data);
      
      try {
        await this.handleCacheInvalidation(message.data);
        return { success: true };
      } catch (error) {
        console.error('❌ Error processing cache invalidation:', error.message);
        return { success: false, error: error.message };
      }
    });
  }

  // Helper method để kiểm tra database error
  isDatabaseError(error) {
    return (
      error.name === 'SequelizeConnectionRefusedError' ||
      error.name === 'ConnectionRefusedError' ||
      error.code === 'ECONNREFUSED' ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('Database not connected') ||
      error.message.includes('Connection refused') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('EHOSTUNREACH')
    );
  }

  async handleTaskCreation(taskData) {
    console.log('🔨 Creating task:', taskData);
    
    // Double check database connection
    if (!this.isDbConnected) {
      throw new Error('Database not connected');
    }
    
    try {
      const task = await taskService.createTask(taskData);
      
      // Invalidate cache after successful creation
      await this.invalidateTaskCache(task.team_id, task.subject_id);
      
      // Emit WebSocket event
      console.log('📡 Emitting task:created event for:', {
        teamId: task.team_id,
        subjectId: task.subject_id,
        taskId: task.task_id
      });
      
      websocketHandler.emitTaskCreated(task.team_id, task.subject_id, task);
      
      console.log('✅ Task created and event emitted');
      return task;
      
    } catch (error) {
      console.error('❌ Error in handleTaskCreation:', error);
      throw error;
    }
  }

  async handleTaskUpdate(data) {
    console.log('📝 Updating task:', data.taskId);
    
    const task = await taskService.updateTask(data.taskId, data.updateData);
    
    if (task) {
      await this.invalidateTaskCache(task.team_id, task.subject_id);
      websocketHandler.emitTaskUpdated(task.team_id, task.subject_id, task);
    }
    
    return task;
  }

  async handleTaskDeletion(data) {
    console.log('🗑️ Deleting task:', data.taskId);
    
    const result = await taskService.deleteTask(data.taskId);
    
    if (result) {
      await this.invalidateTaskCache(result.team_id, result.subject_id);
      websocketHandler.emitTaskDeleted(result.team_id, result.subject_id, data.taskId);
    }
    
    return result;
  }

  async handleTaskSubmission(data) {
    console.log('📤 Submitting task:', data.taskId, 'by user:', data.userId);
    
    const existingSubmission = await TaskCompleted.findOne({
      where: { task_id: data.taskId, user_id: data.userId }
    });

    if (existingSubmission) {
      console.log('⚠️ Task already submitted by this user');
      return { alreadySubmitted: true };
    }

    const task = await taskService.getTaskById(data.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const submission = await TaskCompleted.create({
      task_id: data.taskId,
      user_id: data.userId,
      completed_date: new Date()
    });

    await this.invalidateTaskCache(task.team_id, task.subject_id);
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

  // Thêm phương thức startRetryCleanup
  startRetryCleanup() {
    console.log('🧹 Starting retry cleanup service...');
    
    // Cleanup old processed messages every 10 minutes
    this.retryCleanupInterval = setInterval(() => {
      const oldSize = this.processedMessages.size;
      
      if (oldSize > 1000) {
        // Keep only the last 500 messages
        const entries = Array.from(this.processedMessages);
        this.processedMessages.clear();
        entries.slice(-500).forEach(id => this.processedMessages.add(id));
        
        console.log(`🧹 Cleaned up processed messages: ${oldSize} -> ${this.processedMessages.size}`);
      }
      
      console.log(`📊 Current processed messages count: ${this.processedMessages.size}`);
    }, 10 * 60 * 1000); // 10 minutes
    
    console.log('✅ Retry cleanup service started');
  }

  cleanup() {
    if (this.dbCheckInterval) {
      clearInterval(this.dbCheckInterval);
    }
    
    if (this.retryCleanupInterval) {
      clearInterval(this.retryCleanupInterval);
    }
  }
}

module.exports = new TaskConsumer();