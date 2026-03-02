// Fix for redisClient.js to ensure proper cache handling

const redis = require("redis");

// Configure Redis with retry strategy
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls:
      process.env.REDIS_URL?.startsWith("rediss://") ||
      process.env.REDIS_URL?.includes("upstash.io"),
    rejectUnauthorized: false,
    reconnectStrategy: (retries) => {
      const delay = Math.min(retries * 1000, 30000);
      return delay;
    },
  },
});

// Connect and handle connection events
redisClient.connect().catch((err) => {
  console.error("Redis initial connection failed:", err);
  console.log(
    "Application will continue and retry Redis connection automatically",
  );
});

// Handle connected event
redisClient.on("connect", () => {
  console.log("Redis client connected");
  enhancedRedisClient.isReady = true;
});

// Handle connection error
redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
  enhancedRedisClient.isReady = false;
});

// Handle reconnected event
redisClient.on("reconnecting", () => {
  console.log("Redis client reconnecting...");
  enhancedRedisClient.isReady = false;
});

// Handle end event
redisClient.on("end", () => {
  console.log("Redis client connection closed");
  enhancedRedisClient.isReady = false;
});

// Enhanced Redis client with more resilient methods
const enhancedRedisClient = {
  isReady: false,

  // Add event emitter methods to enhanced client
  on(event, callback) {
    return redisClient.on(event, callback);
  },

  off(event, callback) {
    return redisClient.off(event, callback);
  },

  // Get value with fallback
  async get(key) {
    try {
      if (!redisClient.isReady) {
        console.log("Redis not ready when attempting to get", key);
        return null;
      }

      this.isReady = redisClient.isReady;
      const result = await redisClient.get(key);

      return result;
    } catch (err) {
      console.error(`Redis get error for key ${key}:`, err);
      this.isReady = false;
      return null;
    }
  },

  // Redis scan iterator
  scanIterator(pattern) {
    return redisClient.scanIterator(pattern);
  },
  // Delete value
  async del(key) {
    try {
      if (!redisClient.isReady) {
        console.log("Redis not ready when attempting to delete", key);
        return false;
      }
      if (!key || typeof key !== "string" || key.trim() === "") {
        console.error(`⚠️ Attempted to delete with invalid key: "${key}"`);
        return false;
      }
      await redisClient.del(key);
      console.log(`✅ Deleted Redis key: ${key}`);
      return true;
    } catch (err) {
      console.error(`❌ Redis del error for key "${key}":`, err);
      this.isReady = false;
      return false;
    }
  },

  // Set value with error handling
  async setEx(key, ttl, value) {
    try {
      if (!redisClient.isReady) {
        console.log("⚠️ Redis not ready when attempting to set", key);
        return false;
      }

      this.isReady = redisClient.isReady;

      // Validate the value to ensure it's properly formatted
      if (typeof value === "string") {
        try {
          // Check if it's a valid JSON string with data
          if (value.includes('"data"')) {
            const parsed = JSON.parse(value);
            if (
              !parsed.data ||
              !Array.isArray(parsed.data) ||
              parsed.data.length === 0
            ) {
              console.error(
                "⚠️ Attempting to cache invalid data structure:",
                parsed,
              );
              return false;
            }
          }
        } catch (parseErr) {
          console.error("⚠️ Invalid JSON being cached:", parseErr);
          return false;
        }
      } else {
        console.error("⚠️ Non-string value being cached");
        return false;
      }

      await redisClient.setEx(key, ttl, value);
      console.log(`✅ Successfully cached data at key: ${key}`);
      return true;
    } catch (err) {
      console.error(`❌ Redis setEx error for key ${key}:`, err);
      this.isReady = false;
      return false;
    }
  },

  // Clean up resources if needed
  async quit() {
    try {
      if (redisClient.isReady) {
        await redisClient.quit();
      }
    } catch (err) {
      console.error("Error while closing Redis connection:", err);
    }
  },
};

// Use a shorter interval for more responsive status updates
setInterval(() => {
  enhancedRedisClient.isReady = redisClient.isReady;
}, 2000);

module.exports = enhancedRedisClient;
