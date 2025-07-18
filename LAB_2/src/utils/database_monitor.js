const sequelize = require('../config/database');
const EventEmitter = require('events');

class DatabaseMonitor extends EventEmitter {
  constructor() {
    super();
    this.isConnected = false;
    this.checkInterval = null;
    this.retryCount = 0;
    this.maxRetries = 10;
  }

  startMonitoring() {
    this.checkInterval = setInterval(async () => {
      const wasConnected = this.isConnected;
      this.isConnected = await this.checkConnection();
      
      if (!wasConnected && this.isConnected) {
        console.log('✅ Database reconnected');
        this.emit('connected');
        this.retryCount = 0;
      } else if (wasConnected && !this.isConnected) {
        console.log('💔 Database disconnected');
        this.emit('disconnected');
      }
    }, 5000); // Check every 5 seconds
  }

  async checkConnection() {
    try {
      await sequelize.authenticate();
      return true;
    } catch (error) {
      return false;
    }
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

module.exports = new DatabaseMonitor();