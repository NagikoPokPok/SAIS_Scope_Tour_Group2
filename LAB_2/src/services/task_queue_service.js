const rabbitmqClient = require('../utils/rabbitmq_client');
const { QUEUES, EXCHANGES } = require('../config/rabbitmq');

class TaskQueueService {
  // Queue task creation
  async queueTaskCreation(taskData) {
    const message = {
      operation: 'CREATE_TASK',
      data: taskData,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    
    return await rabbitmqClient.sendToQueue(QUEUES.TASK_OPERATIONS, message);
  }

  // Queue task submission
  async queueTaskSubmission(taskId, userId) {
    const message = {
      operation: 'SUBMIT_TASK',
      data: { taskId, userId },
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    
    return await rabbitmqClient.sendToQueue(QUEUES.TASK_SUBMISSIONS, message);
  }

  // Queue task update
  async queueTaskUpdate(taskId, updateData) {
    const message = {
      operation: 'UPDATE_TASK',
      data: { taskId, updateData },
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    
    return await rabbitmqClient.sendToQueue(QUEUES.TASK_OPERATIONS, message);
  }

  // Queue task deletion
  async queueTaskDeletion(taskId) {
    const message = {
      operation: 'DELETE_TASK',
      data: { taskId },
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    
    return await rabbitmqClient.sendToQueue(QUEUES.TASK_OPERATIONS, message);
  }

  // Queue cache invalidation
  async queueCacheInvalidation(cacheKeys) {
    const message = {
      operation: 'INVALIDATE_CACHE',
      data: { cacheKeys },
      timestamp: new Date().toISOString()
    };
    
    return await rabbitmqClient.sendToQueue(QUEUES.CACHE_INVALIDATION, message);
  }

  // Publish task event
  async publishTaskEvent(eventType, taskData) {
    const message = {
      eventType,
      data: taskData,
      timestamp: new Date().toISOString()
    };
    
    const routingKey = `task.${eventType}`;
    return await rabbitmqClient.publishToExchange(EXCHANGES.TASK_EVENTS, routingKey, message);
  }
}

module.exports = new TaskQueueService();