const rabbitmqClient = require('../utils/rabbitmq_client');
const { QUEUES } = require('../config/rabbitmq');
const taskService = require('../services/task_service');
const TaskCompleted = require('../models/TaskCompleted');
const redisClient = require('../utils/redis_client');
const sequelize = require('../config/database');

class TaskConsumer {
  constructor() {
    this.isProcessing = false;
    this.retryQueue = new Map(); // Track retry attempts
  }

  async startConsuming() {
    console.log('🚀 Starting task consumers...');
    
    // Consume task operations
    await this.consumeTaskOperations();
    
    // Consume task submissions
    await this.consumeTaskSubmissions();
    
    // Consume cache invalidation
    await this.consumeCacheInvalidation();
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
      
      // Check if we're already processing this message
      if (this.retryQueue.has(messageId)) {
        const retryInfo = this.retryQueue.get(messageId);
        if (Date.now() - retryInfo.lastAttempt < 10000) { // 10 second cooldown
          console.log('⏸️ Message still in cooldown, skipping:', messageId);
          return; // Don't ack, don't nack - just skip
        }
      }

      console.log('📥 Processing task operation:', message.operation, 'ID:', messageId);
      
      // Check database connectivity first
      const dbConnected = await this.isDatabaseConnected();
      if (!dbConnected) {
        console.log('💔 Database not available, postponing message processing');
        
        // Track retry attempts
        const currentRetries = this.retryQueue.get(messageId)?.retries || 0;
        if (currentRetries >= 5) {
          console.log('💀 Max retries reached for message, sending to DLQ:', messageId);
          // In production, you'd send to Dead Letter Queue
          // For now, we'll just ack to remove it
          return; // This will ack the message
        }

        // Update retry tracking
        this.retryQueue.set(messageId, {
          retries: currentRetries + 1,
          lastAttempt: Date.now()
        });

        // Don't ack, don't nack - let RabbitMQ redeliver later
        throw new Error('Database not available - message will be retried');
      }

      try {
        // Clear retry tracking on successful connection
        this.retryQueue.delete(messageId);
        
        switch (message.operation) {
          case 'CREATE_TASK':
            await this.handleTaskCreation(message.data);
            break;
          case 'UPDATE_TASK':
            await this.handleTaskUpdate(message.data);
            break;
          case 'DELETE_TASK':
            await this.handleTaskDeletion(message.data);
            break;
          default:
            console.log('❓ Unknown operation:', message.operation);
        }
        
        console.log('✅ Successfully processed:', messageId);
        
      } catch (error) {
        console.error('❌ Error processing task operation:', error.message);
        
        // Only retry if it's not a database connection error
        if (error.name === 'SequelizeConnectionRefusedError' || 
            error.name === 'ConnectionRefusedError' ||
            error.code === 'ECONNREFUSED') {
          
          console.log('💔 Database connection error - will retry later');
          
          // Track retry
          const currentRetries = this.retryQueue.get(messageId)?.retries || 0;
          this.retryQueue.set(messageId, {
            retries: currentRetries + 1,
            lastAttempt: Date.now()
          });
          
          // Don't process retry logic for connection errors
          throw error;
        }
        
        // For other errors, use original retry logic
        if (message.retryCount < 3) {
          message.retryCount++;
          console.log(`🔄 Scheduling retry ${message.retryCount}/3 for message:`, messageId);
          
          setTimeout(() => {
            rabbitmqClient.sendToQueue(QUEUES.TASK_OPERATIONS, message);
          }, 5000 * message.retryCount);
        } else {
          console.error('💀 Max retries reached for message:', messageId);
        }
        
        throw error;
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
    
    // Double-check database connection before attempting operation
    const dbConnected = await this.isDatabaseConnected();
    if (!dbConnected) {
      throw new Error('Database connection lost during task creation');
    }
    
    const task = await taskService.createTask(taskData);
    
    // Invalidate cache
    await this.invalidateTaskCache(task.team_id, task.subject_id);
    
    console.log('✅ Task created successfully:', task.task_id);
    return task;
  }

  async handleTaskUpdate(data) {
    console.log('📝 Updating task:', data.taskId);
    
    const dbConnected = await this.isDatabaseConnected();
    if (!dbConnected) {
      throw new Error('Database connection lost during task update');
    }
    
    const task = await taskService.updateTask(data.taskId, data.updateData);
    
    if (task) {
      // Invalidate cache
      await this.invalidateTaskCache(task.team_id, task.subject_id);
      console.log('✅ Task updated successfully:', task.task_id);
    }
    
    return task;
  }

  async handleTaskDeletion(data) {
    console.log('🗑️ Deleting task:', data.taskId);
    
    const dbConnected = await this.isDatabaseConnected();
    if (!dbConnected) {
      throw new Error('Database connection lost during task deletion');
    }
    
    const result = await taskService.deleteTask(data.taskId);
    
    if (result) {
      // Invalidate cache
      await this.invalidateTaskCache(result.team_id, result.subject_id);
      console.log('✅ Task deleted successfully:', data.taskId);
    }
    
    return result;
  }

  async handleTaskSubmission(data) {
    console.log('📤 Submitting task:', data.taskId, 'by user:', data.userId);
    
    const dbConnected = await this.isDatabaseConnected();
    if (!dbConnected) {
      throw new Error('Database connection lost during task submission');
    }
    
    // Check if already submitted
    const existingSubmission = await TaskCompleted.findOne({
      where: { task_id: data.taskId, user_id: data.userId }
    });
    
    if (existingSubmission) {
      console.log('⚠️ Task already submitted by this user');
      return existingSubmission;
    }
    
    // Create submission
    const submission = await TaskCompleted.create({
      task_id: data.taskId,
      user_id: data.userId,
      completed_date: new Date()
    });
    
    // Get task details for cache invalidation
    const task = await taskService.getTaskById(data.taskId);
    if (task) {
      await this.invalidateTaskCache(task.team_id, task.subject_id);
    }
    
    console.log('✅ Task submitted successfully:', submission.id);
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