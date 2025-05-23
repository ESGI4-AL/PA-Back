const express = require('express');
const router = express.Router();
const deliverableController = require('../controllers/deliverable.controller');
const { verifyToken, isTeacher } = require('../middlewares/auth.middleware');
const uploadFirebase = require('../middlewares/uploadFirebase');

router.use(verifyToken);

router.get('/:id', deliverableController.getDeliverableById);
router.post('/:id/submit', uploadFirebase, deliverableController.submitDeliverable);

router.use(isTeacher);
router.put('/:id', uploadFirebase, deliverableController.updateDeliverable);
router.delete('/:id', deliverableController.deleteDeliverable);
router.post('/send-reminders', deliverableController.sendDeadlineReminders);

module.exports = router;