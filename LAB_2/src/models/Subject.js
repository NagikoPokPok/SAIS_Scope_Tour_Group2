const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subject = sequelize.define('Subject', {
  subject_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  team_id: {                     // Add this field
    type: DataTypes.INTEGER,
    allowNull: false             // Change to true if subjects can be created without a team
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Subject',
  timestamps: false
});

// Define associations if needed
Subject.associate = function(models) {
  Subject.belongsTo(models.Team, { foreignKey: 'team_id' });
  Subject.hasMany(models.Task, { foreignKey: 'subject_id' });
};

module.exports = Subject;
