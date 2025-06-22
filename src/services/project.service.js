const { Op } = require('sequelize');
const { Project, User, Promotion, Group, Deliverable } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const emailService = require('./email.service');

const createProject = async (projectData, teacherId) => {
  const promotion = await Promotion.findByPk(projectData.promotionId);

  if (!promotion) {
    throw new AppError('Promotion not found', 404);
  }

  const teacher = await User.findByPk(teacherId);

  if (!teacher || teacher.role !== 'teacher') {
    throw new AppError('Teacher not found', 404);
  }

  const project = await Project.create({
    ...projectData,
    teacherId
  });

  if (project.status === 'visible') {
    await notifyStudentsAboutProject(project);
  }

  return project;
};

const notifyStudentsAboutProject = async (project) => {

  const promotion = await Promotion.findByPk(project.promotionId, {
    include: [{
      model: User,
      as: 'students',
      where: { isActive: true },
      attributes: ['id', 'email', 'firstName', 'lastName']
    }]
  });

  if (!promotion || !promotion.students || promotion.students.length === 0) {
    return;
  }

  const emailPromises = promotion.students.map(student =>
    emailService.sendNewProjectNotification(student, project)
  );

  try {
    await Promise.all(emailPromises);
  } catch (error) {
    console.error('Failed to send project notifications:', error);
  }
};

const updateProjectStatus = async (projectId, status, teacherId) => {
  const project = await Project.findByPk(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to update this project', 403);
  }

  const oldStatus = project.status;
  project.status = status;
  await project.save();

  if (oldStatus === 'draft' && status === 'visible') {
    await notifyStudentsAboutProject(project);
  }

  return project;
};

const getProjectById = async (projectId) => {
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: User,
        as: 'teacher',
        attributes: ['id', 'firstName', 'lastName', 'email']
      },
      {
        model: Promotion,
        as: 'promotion',
        attributes: ['id', 'name', 'year']
      },
      {
        model: Group,
        as: 'groups',
        include: [
          {
            model: User,
            as: 'members',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      },
      {
        model: Deliverable,
        as: 'deliverables'
      }
    ]
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  return project;
};

const getAllProjects = async (filters = {}) => {
  const { teacherId, promotionId, status, search, page = 1, limit = 10 } = filters;

  const whereClause = {};

  if (teacherId) {
    whereClause.teacherId = teacherId;
  }

  if (promotionId) {
    whereClause.promotionId = promotionId;
  }

  if (status) {
    whereClause.status = status;
  }

  if (search) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const { count, rows } = await Project.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'teacher',
        attributes: ['id', 'firstName', 'lastName']
      },
      {
        model: Promotion,
        as: 'promotion',
        attributes: ['id', 'name', 'year']
      }
    ],
    offset: (page - 1) * limit,
    limit,
    order: [['createdAt', 'DESC']]
  });

  return {
    projects: rows,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page)
  };
};

const getMyProjects = async (studentId, filters = {}) => {
  const { search, page = 1, limit = 10 } = filters;

  const projectWhereClause = { status: 'visible' };

  if (search) {
    projectWhereClause[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const { count, rows: groups } = await Group.findAndCountAll({
    include: [
      {
        model: User,
        as: 'members',
        where: { id: studentId },
        attributes: []
      },
      {
        model: Project,
        as: 'project',
        where: projectWhereClause,
        include: [
          {
            model: User,
            as: 'teacher',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            model: Promotion,
            as: 'promotion',
            attributes: ['id', 'name', 'year']
          },
          {
            model: Deliverable,
            as: 'deliverables',
            attributes: ['id', 'name', 'description', 'deadline', 'type']
          }
        ]
      }
    ],
    offset: (page - 1) * limit,
    limit,
  });

  const projectsMap = new Map();

  groups.forEach(group => {
    if (group.project && !projectsMap.has(group.project.id)) {
      projectsMap.set(group.project.id, {
        ...group.project.toJSON(),
        myGroup: {
          id: group.id,
          name: group.name
        }
      });
    }
  });

  const projects = Array.from(projectsMap.values()).sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return {
    projects: projects,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: parseInt(page)
  };
};

const updateProject = async (projectId, updateData, teacherId) => {
  const project = await Project.findByPk(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to update this project', 403);
  }

  if (updateData.promotionId && updateData.promotionId !== project.promotionId) {
    const promotion = await Promotion.findByPk(updateData.promotionId);

    if (!promotion) {
      throw new AppError('Promotion not found', 404);
    }
  }

  const statusChanged = updateData.status && updateData.status !== project.status;
  const becomesVisible = statusChanged && project.status === 'draft' && updateData.status === 'visible';

  await project.update(updateData);

  if (becomesVisible) {
    await notifyStudentsAboutProject(project);
  }

  return project;
};

const deleteProject = async (projectId, teacherId) => {
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: Group,
        as: 'groups'
      },
      {
        model: Deliverable,
        as: 'deliverables'
      }
    ]
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to delete this project', 403);
  }

  if (project.groups.length > 0 || project.deliverables.length > 0) {
    throw new AppError('Cannot delete project with associated groups or deliverables', 400);
  }

  await project.destroy();

  return { success: true, message: 'Project deleted successfully' };
};

const configureGroupFormation = async (projectId, groupConfig, teacherId) => {
  const project = await Project.findByPk(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to configure this project', 403);
  }

  if (groupConfig.minGroupSize > groupConfig.maxGroupSize) {
    throw new AppError('Minimum group size cannot be greater than maximum group size', 400);
  }

  await project.update({
    minGroupSize: groupConfig.minGroupSize,
    maxGroupSize: groupConfig.maxGroupSize,
    groupFormationMethod: groupConfig.groupFormationMethod,
    groupFormationDeadline: groupConfig.groupFormationDeadline
  });

  return project;
};

const generateRandomGroups = async (projectId, teacherId) => {
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: Promotion,
        as: 'promotion',
        include: [
          {
            model: User,
            as: 'students',
            where: { isActive: true }
          }
        ]
      }
    ]
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to configure this project', 403);
  }

  if (project.groupFormationMethod !== 'random') {
    throw new AppError('Project is not configured for random group formation', 400);
  }

  if (!project.promotion || !project.promotion.students || project.promotion.students.length === 0) {
    throw new AppError('No students found in the promotion', 400);
  }

  const students = [...project.promotion.students];
  for (let i = students.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [students[i], students[j]] = [students[j], students[i]];
  }

  const totalStudents = students.length;
  const minSize = project.minGroupSize;
  const maxSize = project.maxGroupSize;
  const optimalSize = Math.min(maxSize, Math.max(minSize, Math.ceil(totalStudents / Math.floor(totalStudents / maxSize))));

  const groups = [];
  let groupIndex = 0;

  for (let i = 0; i < students.length; i += optimalSize) {
    const groupStudents = students.slice(i, i + optimalSize);

    const group = await Group.create({
      name: `Group ${groupIndex + 1}`,
      projectId
    });

    await group.setMembers(groupStudents);

    groups.push(group);
    groupIndex++;
  }

  for (const group of groups) {
    const members = await group.getMembers();

    for (const member of members) {
      try {
        await emailService.sendGroupAssignmentNotification(member, group, project);
      } catch (error) {
        console.error(`Failed to send group assignment notification to ${member.email}:`, error);
      }
    }
  }

  return groups;
};

const updateDeliverable = async (projectId, deliverableId, updates, teacherId) => {
  const project = await Project.findByPk(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.teacherId !== teacherId) {
    throw new AppError('Unauthorized to update this deliverable', 403);
  }

  const deliverable = await Deliverable.findOne({
    where: {
      id: deliverableId,
      projectId
    }
  });

  if (!deliverable) {
    throw new AppError('Deliverable not found', 404);
  }

  await deliverable.update(updates);

  return deliverable;
};

module.exports = {
  createProject,
  updateProjectStatus,
  getProjectById,
  getAllProjects,
  getMyProjects,
  updateProject,
  deleteProject,
  configureGroupFormation,
  generateRandomGroups,
  notifyStudentsAboutProject,
  updateDeliverable
};