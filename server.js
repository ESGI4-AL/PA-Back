const app = require('./src/app');
const { testDatabaseConnection } = require('./src/config/database');
const syncModels = require('./src/config/syncModels');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

//start server
const startServer = async () => {
  try {
    // Test connexion
    await testDatabaseConnection();
    
    const forceSync = process.env.NODE_ENV === 'development' && process.env.FORCE_SYNC === 'true';
    await syncModels(forceSync);
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();