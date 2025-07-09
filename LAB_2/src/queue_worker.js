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
  
  // Debug: Check if env variables are loaded
  console.log('Environment variables:');
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_PORT:', process.env.DB_PORT);
  
  try {
    // Try to connect to database, but don't fail if it's not available
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
    
    // Periodically check database connection
    const dbHealthCheck = setInterval(async () => {
      try {
        await sequelize.authenticate();
        console.log('💓 Database health check: OK');
      } catch (error) {
        console.log('💔 Database health check: FAILED -', error.message);
      }
    }, 30000); // Every 30 seconds
    
    // Handle graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down worker gracefully...`);
      
      clearInterval(dbHealthCheck);
      
      try {
        await rabbitmqClient.close();
        console.log('✅ RabbitMQ connection closed');
      } catch (error) {
        console.error('❌ Error closing RabbitMQ:', error);
      }
      
      try {
        await sequelize.close();
        console.log('✅ Database connection closed');
      } catch (error) {
        console.error('❌ Error closing database:', error);
      }
      
      process.exit(0);
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
  } catch (error) {
    console.error('❌ Failed to start queue worker:', error);
    process.exit(1);
  }
}

startWorker();