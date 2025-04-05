const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DeliverableRule = sequelize.define('DeliverableRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM('file_size', 'file_presence', 'folder_structure', 'file_content'),
    allowNull: false
  },
  rule: {
    type: DataTypes.JSON,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = DeliverableRule;