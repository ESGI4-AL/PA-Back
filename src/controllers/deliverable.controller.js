const deliverableService = require('../services/deliverable.service');
const { asyncHandler } = require('../middlewares/error.middleware');
const logger = require('../utils/logger');
const { formatFileSize } = require('../utils/fileUtils');

const createDeliverable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deliverableData = req.body;
  const teacherId = req.user.id;

  const deliverable = await deliverableService.createDeliverable(id, deliverableData, teacherId);

  res.status(201).json({
    status: 'success',
    message: 'Deliverable created successfully',
    data: deliverable
  });
});

const getDeliverableById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deliverable = await deliverableService.getDeliverableById(id);

  res.status(200).json({
    status: 'success',
    data: deliverable
  });
});

const getProjectDeliverables = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const deliverables = await deliverableService.getProjectDeliverables(id, userId);

  res.status(200).json({
    status: 'success',
    data: deliverables
  });
});

const updateDeliverable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const teacherId = req.user.id;

  if (req.file && req.file.firebaseUrl) {
    updateData.archiveUrl = req.file.firebaseUrl;
  }

  const deliverable = await deliverableService.updateDeliverable(id, updateData, teacherId);

  res.status(200).json({
    status: 'success',
    message: 'Deliverable updated successfully',
    data: deliverable
  });
});

const deleteDeliverable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.id;

  const result = await deliverableService.deleteDeliverable(id, teacherId);

  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const submitDeliverable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const submissionData = req.body;
  const { groupId } = req.body;

  console.log('🎯 Début soumission livrable:', {
    deliverableId: id,
    groupId: groupId,
    hasFile: !!req.file,
    hasFirebaseUpload: !!req.firebaseUpload,
    hasGitSubmission: !!req.gitSubmission,
    bodyKeys: Object.keys(req.body)
  });

  if (req.file) {
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (req.file.size > maxFileSize) {
      return res.status(400).json({
        status: 'error',
        message: `Fichier trop volumineux. Taille maximum: ${maxFileSize / 1024 / 1024}MB, taille reçue: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`,
        code: 'FILE_TOO_LARGE'
      });
    }

    console.log('✅ Validation taille fichier réussie:', {
      size: req.file.size,
      sizeFormatted: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
      maxSize: `${maxFileSize / 1024 / 1024} MB`
    });
  }

  const fileName = req.body.fileName;
  const fileSize = req.body.fileSize ? parseInt(req.body.fileSize) : null;

  console.log('📋 Données de soumission:', {
    fileName,
    fileSize,
    fileSizeFormatted: fileSize ? formatFileSize(fileSize) : 'N/A'
  });

  if (req.gitSubmission) {
    const deliverable = await deliverableService.getDeliverableById(id);
    if (!deliverable) {
      return res.status(404).json({
        status: 'error',
        message: 'Livrable non trouvé.'
      });
    }

    if (deliverable.type === 'git') {
      const gitUrl = req.gitSubmission.gitUrl;
      const gitUrlRegex = /^https:\/\/(github|gitlab|bitbucket)\.com\/[^/]+\/[^/]+/;

      if (!gitUrlRegex.test(gitUrl)) {
        return res.status(400).json({
          status: 'error',
          message: 'Lien Git invalide pour ce type de livrable.'
        });
      }

      const submission = await deliverableService.submitDeliverable(
        id,
        { gitUrl: gitUrl },
        groupId,
        null,
        `Git: ${gitUrl}`,
        null
      );

      return res.status(200).json({
        status: 'success',
        message: 'Livrable Git soumis avec succès',
        data: {
          submission,
          validation: {
            valid: true,
            details: [
              { rule: 'git_url', valid: true, message: 'URL Git validée' }
            ]
          }
        }
      });
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Ce livrable n\'accepte que les fichiers, pas les liens Git.'
      });
    }
  }

  let fileUrl = null;

  if (req.firebaseUpload) {
    fileUrl = req.firebaseUpload.downloadUrl;
    console.log('✅ Firebase upload détecté:', {
      url: fileUrl,
      fileName: req.firebaseUpload.fileName,
      size: formatFileSize(req.firebaseUpload.size)
    });
  }

  const deliverable = await deliverableService.getDeliverableById(id);

  if (!deliverable) {
    return res.status(404).json({
      status: 'error',
      message: 'Livrable non trouvé.'
    });
  }

  if (deliverable.type === 'archive') {
    if (!fileUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Un fichier est requis pour ce livrable de type archive.'
      });
    }

    const originalName = req.firebaseUpload.originalName.toLowerCase();
    const allowedExtensions = ['.zip', '.tar.gz', '.tgz'];
    const isValidExtension = allowedExtensions.some(ext => originalName.endsWith(ext));

    if (!isValidExtension) {
      return res.status(400).json({
        status: 'error',
        message: 'Le fichier doit être une archive au format .zip, .tar.gz ou .tgz.'
      });
    }
  } else if (deliverable.type === 'git') {
    return res.status(400).json({
      status: 'error',
      message: 'Ce livrable nécessite un lien Git, pas un fichier.'
    });
  }

  try {
    const submission = await deliverableService.submitDeliverable(
      id,
      submissionData,
      groupId,
      fileUrl,
      fileName || req.firebaseUpload?.fileName,
      fileSize || req.firebaseUpload?.size
    );

    console.log('✅ Soumission créée avec succès:', {
      submissionId: submission.id,
      fileName: submission.fileName,
      fileSize: submission.fileSize
    });

    res.status(200).json({
      status: 'success',
      message: 'Livrable soumis avec succès',
      data: {
        submission,
        validation: {
          valid: true,
          details: [
            { rule: 'upload', valid: true, message: 'Archive uploadée sur Firebase' },
            { rule: 'format', valid: true, message: 'Format de fichier accepté' }
          ]
        }
      }
    });

  } catch (error) {
    console.error('❌ Erreur lors de la soumission:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la soumission du livrable',
      error: error.message
    });
  }
});

const analyzeSimilarity = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await deliverableService.analyzeSimilarity(id);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

const getDeliverableSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.id;

  const summary = await deliverableService.getDeliverableSummary(id, teacherId);

  res.status(200).json({
    status: 'success',
    data: summary
  });
});

const sendDeadlineReminders = asyncHandler(async (req, res) => {
  const result = await deliverableService.sendDeadlineReminders();

  res.status(200).json({
    status: 'success',
    message: `${result.count} reminders sent`,
    data: result
  });
});

const downloadSubmissionFile = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const result = await deliverableService.downloadSubmissionFile(submissionId, userId, userRole);

    if (result.type === 'file') {
      res.set({
        'Content-Type': result.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Content-Length': result.fileSize || 0,
        'Cache-Control': 'no-cache'
      });

      result.fileStream.on('error', (streamError) => {
        console.error('Erreur lors du streaming du fichier:', streamError);
        if (!res.headersSent) {
          res.status(500).json({
            status: 'error',
            message: 'Erreur lors du téléchargement du fichier'
          });
        }
      });

      result.fileStream.pipe(res);
    } else if (result.type === 'git') {
      return res.status(200).json({
        status: 'success',
        message: 'Soumission Git - redirection vers le dépôt',
        data: {
          type: 'git',
          gitUrl: result.gitUrl,
          repositoryName: result.fileName
        }
      });
    }

  } catch (error) {

    if (error.message.includes('non trouvé')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('non autorisé')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Erreur lors du téléchargement du fichier',
      error: error.message
    });
  }
});

const deleteSubmission = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const result = await deliverableService.deleteSubmission(submissionId, userId, userRole);

    res.status(200).json({
      status: 'success',
      message: result.message,
      data: result.deletedSubmission
    });

  } catch (error) {

    if (error.message.includes('non trouvé')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }

    if (error.message.includes('non autorisé') || error.message.includes('deadline')) {
      return res.status(403).json({
        status: 'error',
        message: error.message
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Erreur lors de la suppression de la soumission',
      error: error.message
    });
  }
});

module.exports = {
  createDeliverable,
  getDeliverableById,
  getProjectDeliverables,
  updateDeliverable,
  deleteDeliverable,
  submitDeliverable,
  analyzeSimilarity,
  getDeliverableSummary,
  sendDeadlineReminders,
  downloadSubmissionFile,
  deleteSubmission
};
