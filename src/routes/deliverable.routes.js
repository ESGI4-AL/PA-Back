const express = require('express');
const router = express.Router();
const deliverableController = require('../controllers/deliverable.controller');
const { verifyToken, isTeacher } = require('../middlewares/auth.middleware');
const uploadFirebase = require('../middlewares/uploadFirebase');

router.use(verifyToken);

//enseignants et étudiants
router.get('/:id', deliverableController.getDeliverableById);
router.post('/:id/submit', uploadFirebase, deliverableController.submitDeliverable);
router.get('/submissions/:submissionId/download', deliverableController.downloadSubmissionFile);
router.get('/submissions/:submissionId/content', deliverableController.getSubmissionContent);
router.delete('/submissions/:submissionId', deliverableController.deleteSubmission);

//only teacher
router.use(isTeacher);
router.put('/:id', uploadFirebase, deliverableController.updateDeliverable);
router.delete('/:id', deliverableController.deleteDeliverable);
router.post('/:id/analyze', deliverableController.analyzeSimilarity);
router.get('/:id/summary', deliverableController.getDeliverableSummary);
router.get('/:id/integrity-report', deliverableController.getFileIntegrityReport);
router.post('/:id/clean-missing-files', deliverableController.cleanMissingFiles);
router.post('/send-reminders', deliverableController.sendDeadlineReminders);
module.exports = router;