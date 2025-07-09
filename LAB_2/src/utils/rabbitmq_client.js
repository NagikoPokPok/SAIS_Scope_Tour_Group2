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
  }

  async connect() {
    try {
      console.log('🔌 Connecting to RabbitMQ...');
      this.connection = await amqp.connect(RABBITMQ_URL);
      this.channel = await this.connection.createChannel();
      
      // Setup prefetch to limit concurrent message processing
      await this.channel.prefetch(1);
      
      // Setup queues
      await this.setupQueues();
      
      // Setup exchanges
      await this.setupExchanges();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ RabbitMQ connected successfully');
      
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

  async setupQueues() {
    for (const queue of Object.values(QUEUES)) {
      await this.channel.assertQueue(queue, { 
        durable: true,
        arguments: {
          'x-message-ttl': 86400000, // 24 hours TTL
          'x-max-retries': 3
        }
      });
    }
  }

  async setupExchanges() {
    for (const exchange of Object.values(EXCHANGES)) {
      await this.channel.assertExchange(exchange, 'topic', { durable: true });
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

  async consumeFromQueue(queue, callback) {
    try {
      if (!this.isConnected || !this.channel) {
        console.log('⚠️ RabbitMQ not connected, cannot consume from queue');
        return;
      }

      await this.channel.consume(queue, async (message) => {
        if (message) {
          try {
            const content = JSON.parse(message.content.toString());
            await callback(content);
            this.channel.ack(message);
          } catch (error) {
            console.error('❌ Error processing message:', error.message);
            
            // Check if it's a database connection error
            if (error.name === 'SequelizeConnectionRefusedError' || 
                error.name === 'ConnectionRefusedError' ||
                error.code === 'ECONNREFUSED' ||
                error.message.includes('Database not available')) {
              
              console.log('💔 Database connection error detected - message will be requeued');
              // Don't ack, don't nack immediately - let it timeout and requeue
              setTimeout(() => {
                try {
                  this.channel.nack(message, false, true); // Requeue after delay
                } catch (nackError) {
                  console.error('❌ Error nacking message:', nackError.message);
                }
              }, 10000); // 10 second delay before requeue
              
            } else {
              // For other errors, requeue immediately
              this.channel.nack(message, false, true);
            }
          }
        }
      }, {
        noAck: false // Ensure manual acknowledgment
      });
    } catch (error) {
      console.error('❌ Error consuming from queue:', error.message);
      this.isConnected = false;
    }
  }

  async close() {
    try {
      this.isConnected = false;
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