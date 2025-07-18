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
        // Setup main queue with dead letter configuration
        await this.channel.assertQueue(queue, { 
          durable: true,
          arguments: {
            'x-message-ttl': 86400000, // 24 hours TTL
            'x-dead-letter-exchange': 'dlx',
            'x-dead-letter-routing-key': `${queue}.failed`
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
            
            const result = await callback(content);
            
            // Chỉ ack message nếu thành công
            if (result && result.success) {
              this.channel.ack(message);
              console.log(`✅ Message processed and acknowledged from ${queue}`);
            } else {
              console.log(`⚠️ Message processing failed, will be requeued`);
              this.channel.nack(message, false, true); // Requeue
            }
            
          } catch (error) {
            console.error(`❌ Error processing message from ${queue}:`, error.message);
            
            // Kiểm tra nếu là lỗi database
            if (error.name === 'SequelizeConnectionRefusedError' || 
                error.name === 'ConnectionRefusedError' ||
                error.code === 'ECONNREFUSED' ||
                error.message.includes('Database not connected')) {
              
              console.log('💔 Database connection error detected - message will be requeued');
              // Không ack message, để RabbitMQ tự requeue
              this.channel.nack(message, false, true);
              return;
              
            } else {
              // Với các lỗi khác, retry với delay
              const retryCount = message.properties.headers?.retryCount || 0;
              if (retryCount < 3) {
                console.log(`🔄 Retrying message (attempt ${retryCount + 1})`);
                
                // Thêm retry count vào headers
                const newHeaders = { ...message.properties.headers, retryCount: retryCount + 1 };
                
                setTimeout(() => {
                  try {
                    this.channel.nack(message, false, true);
                  } catch (nackError) {
                    console.error('❌ Error nacking message:', nackError.message);
                  }
                }, 5000 * (retryCount + 1));
              } else {
                console.error('💀 Max retries reached, discarding message');
                this.channel.nack(message, false, false);
              }
            }
          }
        }
      }, {
        noAck: false
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
}

module.exports = new RabbitMQClient();