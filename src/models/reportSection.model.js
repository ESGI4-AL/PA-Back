const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReportSection = sequelize.define('ReportSection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  contentType: {
    type: DataTypes.ENUM('html', 'markdown', 'plain'),
    defaultValue: 'html',
    allowNull: false
  },
  contentMarkdown: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  maxLength: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1
    }
  },
  minLength: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0
    }
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lastEditedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  isVisible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  allowedFormats: {
    type: DataTypes.JSON,
    allowNull: true
  },
  sectionType: {
    type: DataTypes.ENUM('text', 'image', 'table', 'code', 'mixed'),
    defaultValue: 'text',
    allowNull: false
  },
  reportId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'reports',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
}, {
  timestamps: true,
  // indexes: [
  //   {
  //     fields: ['reportId', 'order']
  //   },
  //   {
  //     fields: ['reportId', 'isVisible']
  //   },
  //   {
  //     fields: ['contentType']
  //   }
  // ],
  validate: {
    minMaxLengthValid() {
      if (this.minLength && this.maxLength && this.minLength > this.maxLength) {
        throw new Error('minLength cannot be greater than maxLength');
      }
    }
  }
});

module.exports = ReportSection;