const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EvaluationCriteria = sequelize.define('EvaluationCriteria', {
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
  weight: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 1
  },
  type: {
    type: DataTypes.ENUM('group', 'individual'),
    defaultValue: 'group'
  },
  evaluationType: {
    type: DataTypes.ENUM('deliverable', 'report', 'presentation'),
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = EvaluationCriteria;