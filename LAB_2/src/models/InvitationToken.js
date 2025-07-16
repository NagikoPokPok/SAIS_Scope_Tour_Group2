const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const InvitationToken = sequelize.define("InvitationToken", {
  token_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  team_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  }
}, {
  tableName: "invitation_token",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: false,
});

module.exports = InvitationToken;
