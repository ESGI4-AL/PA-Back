const deliverableService = require('../services/deliverable.service');
const { asyncHandler } = require('../middlewares/error.middleware');  
const logger = require('../utils/logger');

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

  const deliverables = await deliverableService.getProjectDeliverables(id);

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

  let fileUrl = null;

  logger.info(req.file);

  if (req.file && req.file.firebaseUrl) {
    fileUrl = req.file.firebaseUrl;
  }

  const deliverable = await deliverableService.getDeliverableById(id);

  if (!deliverable) {
    return res.status(404).json({ message: 'Livrable non trouvé.' });
  }

  if (deliverable.type === 'archive') {
    if (!fileUrl || !req.file || !req.file.originalname) {
      return res.status(400).json({ message: 'Un fichier est requis pour ce livrable de type archive.' });
    }

    const allowedExtensions = ['.zip', '.tar.gz'];
    const originalName = req.file.originalname.toLowerCase();
    const isValidExtension = allowedExtensions.some(ext => originalName.endsWith(ext));

    if (!isValidExtension) {
      return res.status(400).json({
        message: 'Le fichier doit être une archive au format .zip ou .tar.gz.'
      });
    }
  } else if (deliverable.type === 'git') {
    const { gitUrl } = submissionData;

    const gitUrlRegex = /^https:\/\/(github|gitlab|bitbucket)\.com\/[^/]+\/[^/]+/;

    if (!gitUrl || !gitUrlRegex.test(gitUrl)) {
      return res.status(400).json({
        message: 'Lien Git invalide ou manquant. Il doit pointer vers un dépôt GitHub, GitLab ou Bitbucket.'
      });
    }

    submissionData.gitUrl = gitUrl;
  }

  const submission = await deliverableService.submitDeliverable(
    id,
    submissionData,
    groupId,
    fileUrl
  );

  res.status(200).json({
    status: 'success',
    message: 'Deliverable submitted successfully',
    data: submission
  });
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

module.exports = {
  createDeliverable,
  getDeliverableById,
  getProjectDeliverables,
  updateDeliverable,
  deleteDeliverable,
  submitDeliverable,
  analyzeSimilarity,
  getDeliverableSummary,
  sendDeadlineReminders
};