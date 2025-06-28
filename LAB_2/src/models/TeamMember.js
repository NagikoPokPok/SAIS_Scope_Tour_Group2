const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TeamMember = sequelize.define('TeamMember', {
  team_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'member'
  },
  joined_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'team_member',
  timestamps: false
});

// Định nghĩa quan hệ
TeamMember.associate = function(models) {
  TeamMember.belongsTo(models.Team, { foreignKey: 'team_id' });
  TeamMember.belongsTo(models.User, { foreignKey: 'user_id' });
};

module.exports = TeamMember;