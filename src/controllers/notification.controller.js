const notificationService = require('../services/notification.service');
const { asyncHandler } = require('../middlewares/error.middleware');

const getUserNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const filters = {
    unreadOnly: req.query.unreadOnly === 'true',
    types: req.query.types ? req.query.types.split(',') : null,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20
  };
  
  const result = await notificationService.getUserNotifications(userId, filters);
  
  res.status(200).json({
    status: 'success',
    data: result
  });
});

const markNotificationAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const notification = await notificationService.markNotificationAsRead(id, userId);
  
  res.status(200).json({
    status: 'success',
    message: 'Notification marked as read',
    data: notification
  });
});

const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const result = await notificationService.markAllNotificationsAsRead(userId);
  
  res.status(200).json({
    status: 'success',
    message: `${result.count} notifications marked as read`
  });
});

const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const result = await notificationService.deleteNotification(id, userId);
  
  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const notifyProjectVisible = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  
  const notifications = await notificationService.notifyProjectVisible(projectId);
  
  res.status(200).json({
    status: 'success',
    message: `${notifications.length} notifications sent`,
    data: { count: notifications.length }
  });
});

const notifyDeadlineReminder = asyncHandler(async (req, res) => {
  const { deliverableId } = req.params;
  
  const notifications = await notificationService.notifyDeadlineReminder(deliverableId);
  
  res.status(200).json({
    status: 'success',
    message: `${notifications.length} notifications sent`,
    data: { count: notifications.length }
  });
});

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  notifyProjectVisible,
  notifyDeadlineReminder
};