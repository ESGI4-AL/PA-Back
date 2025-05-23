const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { bucket } = require('../utils/firebase');
const logger = require('../utils/logger');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.zip', '.tar.gz'];
    const ext = path.extname(file.originalname);
    logger.info(`🧪 Extension du fichier reçu : ${ext}`);
    if (!allowed.includes(ext)) {
      logger.warn('❌ Fichier refusé : extension non autorisée');
      return cb(new Error('Seuls les fichiers .zip ou .tar.gz sont autorisés'), false);
    }
    cb(null, true);
  }
}).single('archive'); // 👈 clé ici

const uploadFirebase = (req, res, next) => {
  logger.info('🔍 Requête reçue, headers:', req.headers);

  upload(req, res, async (err) => {
    if (err) {
      logger.error('❌ Erreur Multer :', err);
      return next(err);
    }

    if (!req.file) {
      logger.warn('⚠️ Aucun fichier reçu dans le champ "archive"');
      return next();
    }

    try {
      logger.info(`📁 Upload de : ${req.file.originalname}`);
      const fileName = `archives/${Date.now()}-${req.file.originalname}`;
      const file = bucket.file(fileName);
      const uuid = uuidv4();

      const stream = file.createWriteStream({
        metadata: {
          contentType: req.file.mimetype,
          metadata: {
            firebaseStorageDownloadTokens: uuid,
          },
        },
      });

      stream.on('error', (error) => {
        logger.error('🔥 Erreur upload Firebase :', error);
        return next(error);
      });

      stream.on('finish', () => {
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${uuid}`;
        req.file.firebaseUrl = publicUrl;
        logger.info(`✅ Upload terminé. URL Firebase : ${publicUrl}`);
        next();
      });

      stream.end(req.file.buffer);
    } catch (error) {
      logger.error('🔥 Erreur interne lors de l\'upload Firebase :', error);
      next(error);
    }
  });
};

module.exports = uploadFirebase;