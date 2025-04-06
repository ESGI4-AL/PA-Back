const express = require('express');
const router = express.Router();
const deliverableController = require('../controllers/deliverable.controller');
const { verifyToken, isTeacher } = require('../middlewares/auth.middleware');
const { upload, handleMulterErrors } = require('../middlewares/upload.middleware');

router.use(verifyToken);

router.get('/:id', deliverableController.getDeliverableById);
router.post('/:id/submit', upload.single('file'), handleMulterErrors, deliverableController.submitDeliverable);

//user teacher only
router.use(isTeacher);
router.put('/:id', deliverableController.updateDeliverable);
router.delete('/:id', deliverableController.deleteDeliverable);
router.post('/send-reminders', deliverableController.sendDeadlineReminders);

module.exports = router;