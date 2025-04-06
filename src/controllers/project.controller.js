const projectService = require('../services/project.service');
const { asyncHandler } = require('../middlewares/error.middleware');

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
    limit: parseInt(req.query.limit) || 10
  };
  
  const result = await projectService.getAllProjects(filters);
  
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

module.exports = {
  createProject,
  updateProjectStatus,
  getProjectById,
  getAllProjects,
  updateProject,
  deleteProject,
  configureGroupFormation,
  generateRandomGroups
};