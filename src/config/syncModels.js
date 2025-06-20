const { sequelize } = require('./database');
const models = require('../models');

const syncModels = async (force = false) => {
  try {
    await sequelize.sync({ force });
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Error synchronizing database:', error);
    process.exit(1);
  }
};

module.exports = syncModels;

/*const { sequelize } = require('./database');
const models = require('../models');

const syncModels = async (force = false) => {
  try {
    // Utilise alter: true pour ajouter les colonnes manquantes sans supprimer les données
    await sequelize.sync({ 
      force, 
      alter: true // ✅ AJOUT : Ceci ajoute les nouvelles colonnes automatiquement
    });
    console.log('✅ Database synchronized successfully.');
  } catch (error) {
    console.error('❌ Error synchronizing database:', error);
    
    // Plus d'infos sur l'erreur pour debug
    if (error.name === 'SequelizeDatabaseError') {
      console.error('SQL Error:', error.original?.message);
      console.error('SQL Query:', error.sql);
    }
    
    process.exit(1);
  }
};

module.exports = syncModels;*/