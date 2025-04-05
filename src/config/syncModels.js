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