const admin = require('firebase-admin');
const serviceAccount = require('./kodo-project-management-firebase-adminsdk-fbsvc-bb4a40f8d4.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'kodo-project-management.firebasestorage.app'
});

const bucket = admin.storage().bucket();

module.exports = { admin, bucket };
