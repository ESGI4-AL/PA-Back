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
  // NOUVEAUX CHAMPS pour WYSIWYG et fonctionnalités avancées
  contentType: {
    type: DataTypes.ENUM('html', 'markdown', 'plain'),
    defaultValue: 'html',
    allowNull: false
  },
  contentMarkdown: {
    type: DataTypes.TEXT, // Version markdown du contenu
    allowNull: true
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  maxLength: {
    type: DataTypes.INTEGER,
    allowNull: true, // Limite de caractères optionnelle
    validate: {
      min: 1
    }
  },
  minLength: {
    type: DataTypes.INTEGER,
    allowNull: true, // Longueur minimale optionnelle
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
    type: DataTypes.JSON, // ['bold', 'italic', 'underline', 'list', etc.]
    allowNull: true
  },
  sectionType: {
    type: DataTypes.ENUM('text', 'image', 'table', 'code', 'mixed'),
    defaultValue: 'text',
    allowNull: false
  },
  // Relations (Foreign Keys)
  reportId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'reports', // ✅ CORRIGÉ : minuscule
      key: 'id'
    },
    onDelete: 'CASCADE' // Supprimer les sections si le rapport est supprimé
  }
}, {
  timestamps: true,
  // TEMPORAIREMENT COMMENTÉ : Index à ajouter après migration
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
  // Validation au niveau du modèle
  validate: {
    minMaxLengthValid() {
      if (this.minLength && this.maxLength && this.minLength > this.maxLength) {
        throw new Error('minLength cannot be greater than maxLength');
      }
    }
  }
});

module.exports = ReportSection;