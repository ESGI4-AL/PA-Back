const { Notification, User, Project, Group, Deliverable } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const emailService = require('./email.service');

const createNotification = async (userId, notificationData) => {
  const user = await User.findByPk(userId);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  const validTypes = ['account_creation', 'project_visible', 'group_assignment', 'deadline_reminder', 'grade_published', 'other'];
  if (!validTypes.includes(notificationData.type)) {
    throw new AppError('Invalid notification type', 400);
  }
  
  const notification = await Notification.create({
    type: notificationData.type,
    title: notificationData.title,
    message: notificationData.message,
    isRead: false,
    isEmailSent: notificationData.sendEmail === true,
    emailSentAt: notificationData.sendEmail === true ? new Date() : null,
    userId
  });
  
  if (notificationData.sendEmail === true) {
    try {
      await emailService.sendEmail(
        user.email,
        notification.title,
        notification.message
      );
    } catch (error) {
      console.error(`Failed to send email notification to ${user.email}:`, error);
      notification.isEmailSent = false;
      await notification.save();
    }
  }
  
  return notification;
};

const createNotificationsForUsers = async (userIds, notificationData) => {
  const users = await User.findAll({
    where: {
      id: userIds,
      isActive: true
    }
  });
  
  if (users.length === 0) {
    throw new AppError('No active users found', 404);
  }
  
  const notifications = [];
  
  for (const user of users) {
    try {
      const notification = await createNotification(user.id, notificationData);
      notifications.push(notification);
    } catch (error) {
      console.error(`Failed to create notification for user ${user.id}:`, error);
    }
  }
  
  return notifications;
};

const notifyPromotionStudents = async (promotionId, notificationData) => {
  const students = await User.findAll({
    where: {
      promotionId,
      role: 'student',
      isActive: true
    }
  });
  
  if (students.length === 0) {
    throw new AppError('No active students found in the promotion', 404);
  }
  
  const studentIds = students.map(student => student.id);
  return createNotificationsForUsers(studentIds, notificationData);
};

const notifyGroupMembers = async (groupId, notificationData) => {
  const group = await Group.findByPk(groupId, {
    include: [
      {
        model: User,
        as: 'members',
        where: { isActive: true }
      }
    ]
  });
  
  if (!group || !group.members || group.members.length === 0) {
    throw new AppError('No active members found in the group', 404);
  }
  
  const memberIds = group.members.map(member => member.id);
  return createNotificationsForUsers(memberIds, notificationData);
};

const notifyProjectVisible = async (projectId) => {
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: User,
        as: 'teacher'
      }
    ]
  });
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.status !== 'visible') {
    throw new AppError('Project is not visible', 400);
  }
  
  const notificationData = {
    type: 'project_visible',
    title: `New Project: ${project.name}`,
    message: `A new project "${project.name}" has been made visible by ${project.teacher.firstName} ${project.teacher.lastName}. Check it out!`,
    sendEmail: true
  };
  
  return notifyPromotionStudents(project.promotionId, notificationData);
};

const notifyDeadlineReminder = async (deliverableId) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: [
      {
        model: Project,
        as: 'project',
        include: [
          {
            model: Group,
            as: 'groups'
          }
        ]
      }
    ]
  });
  
  if (!deliverable) {
    throw new AppError('Deliverable not found', 404);
  }
  
  const project = deliverable.project;
  const deadline = new Date(deliverable.deadline);
  const formattedDeadline = deadline.toLocaleString();
  
  const notificationData = {
    type: 'deadline_reminder',
    title: `Deadline Reminder: ${deliverable.name}`,
    message: `This is a reminder that the deadline for "${deliverable.name}" in project "${project.name}" is approaching: ${formattedDeadline}`,
    sendEmail: true
  };
  
  const notifications = [];
  
  for (const group of project.groups) {
    try {
      const groupNotifications = await notifyGroupMembers(group.id, notificationData);
      notifications.push(...groupNotifications);
    } catch (error) {
      console.error(`Failed to notify group ${group.id}:`, error);
    }
  }
  
  return notifications;
};

const notifyGradesPublished = async (projectId) => {
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: Group,
        as: 'groups'
      }
    ]
  });
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  const notificationData = {
    type: 'grade_published',
    title: `Grades Published: ${project.name}`,
    message: `The grades for project "${project.name}" have been published. You can now view your results.`,
    sendEmail: true
  };
  
  const notifications = [];
  
  for (const group of project.groups) {
    try {
      const groupNotifications = await notifyGroupMembers(group.id, notificationData);
      notifications.push(...groupNotifications);
    } catch (error) {
      console.error(`Failed to notify group ${group.id}:`, error);
    }
  }
  
  return notifications;
};

const markNotificationAsRead = async (notificationId, userId) => {
  const notification = await Notification.findByPk(notificationId);
  
  if (!notification) {
    throw new AppError('Notification not found', 404);
  }
  
  if (notification.userId !== userId) {
    throw new AppError('You are not authorized to mark this notification as read', 403);
  }
  notification.isRead = true;
  await notification.save();
  
  return notification;
};

const markAllNotificationsAsRead = async (userId) => {
  const result = await Notification.update(
    { isRead: true },
    { where: { userId, isRead: false } }
  );
  
  return {
    success: true,
    count: result[0]
  };
};

const getUserNotifications = async (userId, filters = {}) => {
  const { unreadOnly, types, page = 1, limit = 20 } = filters;
  
  const whereClause = { userId };
  
  if (unreadOnly === true) {
    whereClause.isRead = false;
  }
  
  if (types && Array.isArray(types) && types.length > 0) {
    whereClause.type = types;
  }
  
  const { count, rows } = await Notification.findAndCountAll({
    where: whereClause,
    order: [['createdAt', 'DESC']],
    offset: (page - 1) * limit,
    limit
  });
  
  return {
    notifications: rows,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    unreadCount: await Notification.count({
      where: { userId, isRead: false }
    })
  };
};
const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findByPk(notificationId);
  
  if (!notification) {
    throw new AppError('Notification not found', 404);
  }
  
  if (notification.userId !== userId) {
    throw new AppError('You are not authorized to delete this notification', 403);
  }
  
  await notification.destroy();
  
  return {
    success: true,
    message: 'Notification deleted successfully'
  };
};

module.exports = {
  createNotification,
  createNotificationsForUsers,
  notifyPromotionStudents,
  notifyGroupMembers,
  notifyProjectVisible,
  notifyDeadlineReminder,
  notifyGradesPublished,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUserNotifications,
  deleteNotification
};