const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'reviewed', 'published'),
    defaultValue: 'draft',
    allowNull: false
  },
  isTemplate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  templateStructure: {
    type: DataTypes.JSON,
    allowNull: true
  },
  lastEditedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'projects',
      key: 'id'
    }
  },
  groupId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'groups',
      key: 'id'
    }
  }
}, {
  timestamps: true

  // indexes: [
  //   {
  //     fields: ['projectId', 'groupId'],
  //     unique: true // Un seul rapport par groupe/projet
  //   },
  //   {
  //     fields: ['projectId', 'status']
  //   },
  //   {
  //     fields: ['isTemplate']
  //   }
  // ]
});

module.exports = Report;