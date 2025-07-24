const projectService = require('../services/project.service');
const { asyncHandler } = require('../middlewares/error.middleware');

const logger = require('../utils/logger');

const createProject = asyncHandler(async (req, res) => {
  const projectData = req.body;
  const teacherId = req.user.id;

  const project = await projectService.createProject(projectData, teacherId);

  res.status(201).json({
    status: 'success',
    message: 'Project created successfully',
    data: project
  });
});

const updateProjectStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const teacherId = req.user.id;

  const project = await projectService.updateProjectStatus(id, status, teacherId);

  res.status(200).json({
    status: 'success',
    message: `Project status updated to ${status} successfully`,
    data: project
  });
});

const getProjectById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const project = await projectService.getProjectById(id);

  res.status(200).json({
    status: 'success',
    data: project
  });
});

const getAllProjects = asyncHandler(async (req, res) => {
  const filters = {
    teacherId: req.query.teacherId,
    promotionId: req.query.promotionId,
    status: req.query.status,
    search: req.query.search,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 100
  };

  const result = await projectService.getAllProjects(filters);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

const getMyProjects = asyncHandler(async (req, res) => {
  const studentId = req.user.id;

  const filters = {
    teacherId: req.query.teacherId,
    promotionId: req.query.promotionId,
    status: req.query.status,
    search: req.query.search,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 100
  };

  const result = await projectService.getMyProjects(studentId, filters);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

const updateProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const teacherId = req.user.id;

  const project = await projectService.updateProject(id, updateData, teacherId);

  res.status(200).json({
    status: 'success',
    message: 'Project updated successfully',
    data: project
  });
});

const deleteProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.id;

  const result = await projectService.deleteProject(id, teacherId);

  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const configureGroupFormation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const groupConfig = req.body;
  const teacherId = req.user.id;

  const project = await projectService.configureGroupFormation(id, groupConfig, teacherId);

  res.status(200).json({
    status: 'success',
    message: 'Group formation configuration updated successfully',
    data: project
  });
});

const generateRandomGroups = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.id;

  const groups = await projectService.generateRandomGroups(id, teacherId);

  res.status(200).json({
    status: 'success',
    message: 'Random groups generated successfully',
    data: groups
  });
});

const updateDeliverable = asyncHandler(async (req, res) => {
  const { id: projectId, deliverableId } = req.params;
  const updates = req.body;
  const teacherId = req.user.id;

  logger.info('update receive : ', updates)

  const updatedDeliverable = await projectService.updateDeliverable(
    projectId,
    deliverableId,
    updates,
    teacherId
  );

  res.status(200).json({
    status: 'success',
    message: 'Deliverable updated successfully',
    data: updatedDeliverable
  });
});

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
  updateDeliverable
};