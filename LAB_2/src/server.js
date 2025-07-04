const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
// Load associations first
require('./models/associations');
const teamRoutes = require('./routes/team_route');
const subjectRoute = require('./routes/subject_route');
const taskRoutes = require('./routes/task_route');
const path = require('path');
const { warmTaskCache } = require('./middlewares/cache_warming');
const redisClient = require('./utils/redisClient');

const app = express();
const PORT = 3000; // Express server port

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Update your CORS configuration in server.js
app.use(cors({
    origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  methods: ['GET', 'POST', 'PUT','PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));


// Serve static files from "public"
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/team', teamRoutes);
app.use('/api/subject', subjectRoute);
app.use('/api/task', taskRoutes);


// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connection established.');
  })
  .catch(err => {
    console.error('❌ Unable to connect to the database:', err);
  });

// When Redis is ready, warm up cache for important teams and subjects
redisClient.on('connect', async () => {
  console.log('✅ Redis connected - starting cache warming');
  
  // Add your most active teams and subjects here
  const importantData = [
    { teamId: 1, subjectId: 1 },
    { teamId: 2, subjectId: 2 }
    // Add more as needed
  ];
  
  for (const { teamId, subjectId } of importantData) {
    await warmTaskCache(teamId, subjectId);
  }
});

// Periodically rewarm cache
const CACHE_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes
setInterval(async () => {
  if (redisClient.isReady) {
    console.log('⏳ Refreshing cache...');
    const importantData = [
      { teamId: 1, subjectId: 1 },
      { teamId: 2, subjectId: 2 }
      // Add more as needed
    ];
    
    for (const { teamId, subjectId } of importantData) {
      await warmTaskCache(teamId, subjectId);
    }
  }
}, CACHE_REFRESH_INTERVAL);

// Sync Database & Start Server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully');
    
    // Listen on all interfaces
    app.listen(PORT, () => {
      console.log(`Server is running on http://<your-public-ip>:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
