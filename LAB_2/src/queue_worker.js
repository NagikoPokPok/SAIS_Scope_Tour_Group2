const path = require('path');

require('dotenv').config({ 
  path: path.join(__dirname, '../.env') 
});

const rabbitmqClient = require('./utils/rabbitmq_client');
const taskConsumer = require('./consumers/task_consumer');
const sequelize = require('./config/database');

// Load associations
require('./models/associations');

async function startWorker() {
  console.log('🚀 Starting queue worker...');
  
  try {
    // Try to connect to database
    try {
      await sequelize.authenticate();
      console.log('✅ Database connected successfully');
    } catch (dbError) {
      console.log('⚠️ Database not available at startup:', dbError.message);
      console.log('🔄 Worker will continue and retry database operations when messages arrive');
    }
    
    // Connect to RabbitMQ
    await rabbitmqClient.connect();
    
    // Start consuming messages
    await taskConsumer.startConsuming();
    
    // Start retry cleanup
    taskConsumer.startRetryCleanup();
    
    console.log('✅ Queue worker started successfully');
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('📴 Received SIGTERM, shutting down gracefully...');
      taskConsumer.cleanup();
      await rabbitmqClient.close();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('📴 Received SIGINT, shutting down gracefully...');
      taskConsumer.cleanup();
      await rabbitmqClient.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start queue worker:', error);
    process.exit(1);
  }
}

startWorker();