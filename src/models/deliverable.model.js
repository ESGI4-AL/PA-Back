const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Deliverable = sequelize.define('Deliverable', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('archive', 'git'),
    allowNull: false
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: false
  },
  allowLateSubmission: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  latePenaltyPerHour: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  maxFileSize: {
    type: DataTypes.INTEGER,
    allowNull: true // Taille en bytes
  },
  requiredFiles: {
    type: DataTypes.JSON,
    allowNull: true
  },
  requiredFolderStructure: {
    type: DataTypes.JSON,
    allowNull: true
  },
  fileContentRules: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Deliverable;