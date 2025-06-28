const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Team = sequelize.define('Team', {
  team_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  group_img: {
    type: DataTypes.STRING(500)
  },
  created_by: {
    type: DataTypes.INTEGER
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'team',
  timestamps: false
});

// Định nghĩa quan hệ
Team.associate = function(models) {
  Team.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  Team.hasMany(models.Message, { foreignKey: 'team_id' });
  Team.hasMany(models.Subject, { foreignKey: 'team_id' });
  Team.hasMany(models.Task, { foreignKey: 'team_id' });
  Team.hasMany(models.TeamMember, { foreignKey: 'team_id' });
};

module.exports = Team;