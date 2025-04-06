const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { verifyToken, isTeacher } = require('../middlewares/auth.middleware');


router.use(verifyToken);

//notification for connected user
router.get('/', notificationController.getUserNotifications);
router.patch('/:id/read', notificationController.markNotificationAsRead);
router.patch('/read-all', notificationController.markAllNotificationsAsRead);
router.delete('/:id', notificationController.deleteNotification);

//send notification user teacher
router.use(isTeacher);

router.post('/projects/:projectId/visible', notificationController.notifyProjectVisible);
router.post('/deliverables/:deliverableId/reminder', notificationController.notifyDeadlineReminder);

module.exports = router;