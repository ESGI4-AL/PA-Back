const multer = require('multer');
const path = require('path');
const { bucket } = require('../../config/firebase-admin');
const { formatFileSize, sanitizeFileName } = require('../utils/fileUtils');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/gzip',
      'application/x-tar',
      'application/octet-stream'
    ];

    const allowedExtensions = ['.zip', '.tar.gz', '.tgz', '.rar'];
    const hasValidExtension = allowedExtensions.some(ext =>
      file.originalname.toLowerCase().endsWith(ext)
    );

    if (allowedTypes.includes(file.mimetype) || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non supporté: ${file.mimetype}. Extensions acceptées: ${allowedExtensions.join(', ')}`), false);
    }
  }
});

const validateGitUrl = (gitUrl) => {
  if (!gitUrl) return false;

  const gitPatterns = [
    /^https:\/\/github\.com\/[^\/]+\/[^\/]+(?:\.git)?$/,
    /^https:\/\/gitlab\.com\/[^\/]+\/[^\/]+(?:\.git)?$/,
    /^https:\/\/bitbucket\.org\/[^\/]+\/[^\/]+(?:\.git)?$/,
    /^git@github\.com:[^\/]+\/[^\/]+\.git$/,
    /^git@gitlab\.com:[^\/]+\/[^\/]+\.git$/,
    /^https:\/\/.*\.git$/
  ];

  return gitPatterns.some(pattern => pattern.test(gitUrl.trim()));
};

const uploadToFirebase = async (file, deliverable, group, project, customFileName = null) => {
  try {
    let fileName;
    if (customFileName) {
      const originalExt = path.extname(file.originalname);
      const customExt = path.extname(customFileName);
      fileName = customExt ? customFileName : `${customFileName}${originalExt}`;
      fileName = sanitizeFileName(fileName);
    } else {
      const now = new Date();
      const timeString = now.toTimeString().slice(0, 8).replace(/:/g, '');
      fileName = sanitizeFileName(`${timeString}_${file.originalname}`);
    }

    const sanitizedProjectName = sanitizeFileName(project.name);
    const sanitizedDeliverableName = sanitizeFileName(deliverable.name);
    const sanitizedGroupName = sanitizeFileName(group.name);
    const filePath = `projects/${sanitizedProjectName}/deliverables/${sanitizedDeliverableName}/${sanitizedGroupName}/${fileName}`;

    const fileRef = bucket.file(filePath);

    const metadata = {
      contentType: file.mimetype,
      metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
        projectId: project.id,
        projectName: project.name,
        deliverableId: deliverable.id,
        deliverableName: deliverable.name,
        groupId: group.id,
        groupName: group.name,
        fileSize: file.size.toString(),
        hierarchicalPath: filePath
      }
    };

    return new Promise((resolve, reject) => {
      const stream = fileRef.createWriteStream({
        metadata: metadata,
        resumable: false,
      });

      stream.on('error', (error) => {
        reject(new Error(`Upload échoué: ${error.message}`));
      });

      stream.on('finish', async () => {
        try {
          const [downloadUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + (365 * 24 * 60 * 60 * 1000),
          });

          const result = {
            success: true,
            filePath: filePath,
            downloadUrl: downloadUrl,
            fileName: fileName,
            originalName: file.originalname,
            size: file.size,
            contentType: file.mimetype,
            bucket: 'kodo-project-management.firebasestorage.app'
          };

          resolve(result);

        } catch (error) {
          reject(new Error(`Erreur post-upload: ${error.message}`));
        }
      });

      stream.end(file.buffer);
    });

  } catch (error) {
    throw new Error(`Upload échoué: ${error.message}`);
  }
};

const uploadFirebase = (req, res, next) => {
  const uploadSingle = upload.single('file');

  uploadSingle(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        status: 'error',
        message: err.message,
        code: 'UPLOAD_ERROR'
      });
    }

    if (req.file) {
      const maxFileSize = 100 * 1024 * 1024; // 100MB
      if (req.file.size > maxFileSize) {
        return res.status(413).json({
          status: 'error',
          message: `Fichier trop volumineux. Taille maximum: ${formatFileSize(maxFileSize)}, taille reçue: ${formatFileSize(req.file.size)}`,
          code: 'FILE_TOO_LARGE'
        });
      }
    }

    const gitUrl = req.body.gitUrl;

    if (gitUrl && !req.file) {
      if (!validateGitUrl(gitUrl)) {
        return res.status(400).json({
          status: 'error',
          message: 'URL Git invalide. Formats acceptés: GitHub, GitLab, Bitbucket',
          code: 'INVALID_GIT_URL'
        });
      }

      req.gitSubmission = {
        gitUrl: gitUrl.trim(),
        submissionType: 'git'
      };

      return next();
    }

    if (req.file) {
      try {
        const deliverableId = req.params.id;
        const groupId = req.body.groupId;

        if (!deliverableId || !groupId) {
          return res.status(400).json({
            status: 'error',
            message: 'ID du livrable et du groupe requis',
            code: 'MISSING_REQUIRED_PARAMS'
          });
        }

        const { Deliverable, Group, Project } = require('../models');

        const deliverable = await Deliverable.findByPk(deliverableId, {
          include: [{
            model: Project,
            as: 'project'
          }]
        });
        const group = await Group.findByPk(groupId);

        if (!deliverable || !group || !deliverable.project) {
          return res.status(404).json({
            status: 'error',
            message: 'Livrable, groupe ou projet introuvable',
            code: 'NOT_FOUND'
          });
        }

        const customFileName = req.body.fileName;

        const result = await uploadToFirebase(req.file, deliverable, group, deliverable.project, customFileName);

        req.file.firebaseUrl = result.downloadUrl;
        req.firebaseUpload = result;

        return next();

      } catch (error) {
        return res.status(500).json({
          status: 'error',
          message: 'Erreur lors de l\'upload vers Firebase Storage',
          error: error.message,
          code: 'FIREBASE_UPLOAD_ERROR'
        });
      }
    }

    return next();
  });
};

module.exports = uploadFirebase;
