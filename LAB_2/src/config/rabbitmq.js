const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

const QUEUES = {
  TASK_OPERATIONS: 'task_operations',
  TASK_SUBMISSIONS: 'task_submissions',
  CACHE_INVALIDATION: 'cache_invalidation'
};

const EXCHANGES = {
  TASK_EVENTS: 'task_events'
};

module.exports = {
  RABBITMQ_URL,
  QUEUES,
  EXCHANGES
};