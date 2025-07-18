const amqp = require('amqplib');
const { RABBITMQ_URL, QUEUES, EXCHANGES } = require('../config/rabbitmq');

class RabbitMQClient {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.consumers = new Map(); // Track active consumers
  }

  async connect() {
    try {
      console.log('🔌 Connecting to RabbitMQ...');
      this.connection = await amqp.connect(RABBITMQ_URL);
      this.channel = await this.connection.createChannel();
      
      // Setup prefetch to limit concurrent message processing
      await this.channel.prefetch(1);
      
      // Setup queues với error handling
      try {
        await this.setupQueues();
      } catch (queueError) {
        console.error('❌ Queue setup failed:', queueError.message);
        
        if (queueError.message.includes('PRECONDITION_FAILED')) {
          console.log('🔄 Attempting to recreate queues...');
          await this.recreateQueues();
        } else {
          throw queueError;
        }
      }
      
      // Setup exchanges
      await this.setupExchanges();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ RabbitMQ connected successfully');
      
      // Restart consumers after reconnection
      await this.restartConsumers();
      
      // Handle connection events
      this.connection.on('error', (err) => {
        console.error('❌ RabbitMQ connection error:', err.message);
        this.isConnected = false;
      });
      
      this.connection.on('close', () => {
        console.log('⚠️ RabbitMQ connection closed');
        this.isConnected = false;
        this.scheduleReconnect();
      });
      
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error.message);
      this.scheduleReconnect();
    }
  }

  async recreateQueues() {
    console.log('🔄 Recreating all queues...');
    
    // Delete all existing queues
    for (const queue of Object.values(QUEUES)) {
      try {
        await this.channel.deleteQueue(queue);
        await this.channel.deleteQueue(`${queue}.dlq`);
        console.log(`🗑️ Deleted queues for: ${queue}`);
      } catch (deleteError) {
        console.log(`⚠️ Could not delete queue ${queue}: ${deleteError.message}`);
      }
    }
    
    // Wait a bit for RabbitMQ to process deletions
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Setup queues again
    await this.setupQueues();
  }

  async setupQueues() {
    console.log('🔧 Setting up queues...');
    
    try {
      // Setup dead letter exchange first
      await this.channel.assertExchange('dlx', 'direct', { durable: true });
      console.log('✅ Dead letter exchange ready');
      
      for (const queue of Object.values(QUEUES)) {
        // Setup main queue with proper configuration
        await this.channel.assertQueue(queue, { 
          durable: true,
          arguments: {
            'x-message-ttl': 86400000, // 24 hours TTL
            'x-dead-letter-exchange': 'dlx',
            'x-dead-letter-routing-key': `${queue}.failed`,
            // Thêm setting để message không bị mất khi consumer disconnect
            'x-max-retries': 3
          }
        });
        console.log(`✅ Created main queue: ${queue}`);
        
        // Setup dead letter queue
        await this.channel.assertQueue(`${queue}.dlq`, {
          durable: true
        });
        console.log(`✅ Created dead letter queue: ${queue}.dlq`);
        
        // Bind dead letter queue to exchange
        await this.channel.bindQueue(`${queue}.dlq`, 'dlx', `${queue}.failed`);
        console.log(`✅ Bound dead letter queue: ${queue}.dlq`);
      }
      
      console.log('✅ All queues setup completed');
      
    } catch (error) {
      console.error('❌ Error setting up queues:', error.message);
      throw error;
    }
  }

  async setupExchanges() {
    for (const exchange of Object.values(EXCHANGES)) {
      await this.channel.assertExchange(exchange, 'topic', { durable: true });
    }
  }

  async consumeFromQueue(queue, callback) {
    try {
      if (!this.isConnected || !this.channel) {
        console.log('⚠️ RabbitMQ not connected, cannot consume from queue');
        return;
      }

      this.consumers.set(queue, callback);

      const consumerTag = await this.channel.consume(queue, async (message) => {
        if (message) {
          try {
            const content = JSON.parse(message.content.toString());
            console.log(`📥 Processing message from ${queue}:`, content.operation);
            
            // Gọi callback và chờ kết quả
            const result = await callback(content);
            console.log(`🔍 Callback result:`, result);
            
            // Kiểm tra kết quả callback
            if (result && result.success === true) {
              // Chỉ ack khi callback trả về success: true
              this.channel.ack(message);
              console.log(`✅ Message processed successfully and acknowledged from ${queue}`);
            } else {
              // Callback trả về success: false hoặc lỗi
              console.log(`❌ Message processing failed:`, result);
              
              // Kiểm tra lý do thất bại
              if (result && result.reason === 'database_disconnected') {
                console.log('💔 Database disconnected - message will be requeued');
                this.channel.nack(message, false, true); // Requeue
              } else {
                // Với lỗi khác, cũng requeue nhưng có thể limit retry
                console.log('⚠️ Processing failed - message will be requeued');
                this.channel.nack(message, false, true); // Requeue
              }
            }
            
          } catch (error) {
            console.error(`❌ Error processing message from ${queue}:`, error.message);
            
            // Kiểm tra loại lỗi
            if (this.isDatabaseError(error)) {
              console.log('💔 Database connection error detected - message will be requeued');
              this.channel.nack(message, false, true); // Requeue
            } else {
              // Lỗi khác, gửi vào dead letter queue
              console.error('💀 Non-retryable error, sending to dead letter queue');
              this.channel.nack(message, false, false); // Không requeue
            }
          }
        }
      }, {
        noAck: false // Quan trọng: Manual acknowledgment
      });

      console.log(`🔄 Started consuming from queue: ${queue}`);
      return consumerTag;
    } catch (error) {
      console.error('❌ Error consuming from queue:', error.message);
      this.isConnected = false;
    }
  }

  async restartConsumers() {
    console.log('🔄 Restarting consumers after reconnection...');
    
    for (const [queue, callback] of this.consumers) {
      try {
        await this.consumeFromQueue(queue, callback);
        console.log(`✅ Restarted consumer for queue: ${queue}`);
      } catch (error) {
        console.error(`❌ Failed to restart consumer for queue ${queue}:`, error.message);
      }
    }
  }

  async sendToQueue(queue, message) {
    try {
      if (!this.isConnected || !this.channel) {
        console.log('⚠️ RabbitMQ not connected, cannot send message');
        return false;
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));
      const sent = this.channel.sendToQueue(queue, messageBuffer, { 
        persistent: true,
        timestamp: Date.now()
      });
      
      if (sent) {
        console.log('📤 Message sent to queue:', queue);
      }
      
      return sent;
    } catch (error) {
      console.error('❌ Error sending message to queue:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async publishToExchange(exchange, routingKey, message) {
    try {
      if (!this.isConnected || !this.channel) {
        console.log('⚠️ RabbitMQ not connected, cannot publish message');
        return false;
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));
      return this.channel.publish(exchange, routingKey, messageBuffer, { 
        persistent: true,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ Error publishing message to exchange:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('💀 Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  async close() {
    try {
      this.isConnected = false;
      this.consumers.clear();
      
      if (this.channel) {
        await this.channel.close();
        console.log('✅ RabbitMQ channel closed');
      }
      if (this.connection) {
        await this.connection.close();
        console.log('✅ RabbitMQ connection closed');
      }
    } catch (error) {
      console.error('❌ Error closing RabbitMQ connection:', error.message);
    }
  }

  // Helper methods để kiểm tra loại lỗi
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

  isRetryableError(error) {
    return (
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET'
    );
  }
}

module.exports = new RabbitMQClient();