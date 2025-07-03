const { Sequelize } = require('sequelize');
<<<<<<< HEAD
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
console.log('Environment variables loaded:');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    dialectOptions: {
      connectTimeout: 10000,
    },
    logging: false,
  }
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
  } catch (error) {
    console.error('Unable to connect to database:', error);
    process.exit(1);
  }
};

testConnection();

module.exports = sequelize;
