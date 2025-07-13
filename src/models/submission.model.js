const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Submission = sequelize.define('Submission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  submissionDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isLate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  hoursLate: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  filePath: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  gitUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fileName: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  validationStatus: {
    type: DataTypes.ENUM('pending', 'valid', 'invalid'),
    defaultValue: 'pending'
  },
  validationDetails: {
    type: DataTypes.JSON,
    allowNull: true
  },
  similarityScore: {
    type: DataTypes.FLOAT,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Submission;