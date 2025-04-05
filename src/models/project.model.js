const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define('Project', {
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
  status: {
    type: DataTypes.ENUM('draft', 'visible'),
    defaultValue: 'draft'
  },
  minGroupSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  maxGroupSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  groupFormationMethod: {
    type: DataTypes.ENUM('manual', 'random', 'free'),
    defaultValue: 'manual'
  },
  groupFormationDeadline: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Project;