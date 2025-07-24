const userService = require('../services/user.service');
const { asyncHandler } = require('../middlewares/error.middleware');

const createUser = asyncHandler(async (req, res) => {
  const userData = req.body;

  const user = await userService.createUser(userData);

  res.status(201).json({
    status: 'success',
    message: 'User created successfully',
    data: user
  });
});

const importUsers = asyncHandler(async (req, res) => {
  const { promotionId } = req.params;
  const { usersList } = req.body;

  const result = await userService.importUsers(usersList, promotionId);

  res.status(200).json({
    status: 'success',
    message: `${result.created.length} users created, ${result.updated.length} users updated, ${result.failed.length} users failed`,
    data: result
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await userService.getUserById(id);

  res.status(200).json({
    status: 'success',
    data: user
  });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const filters = {
    role: req.query.role,
    promotionId: req.query.promotionId,
    search: req.query.search,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 100
  };

  const result = await userService.getAllUsers(filters);

  res.status(200).json({
    status: 'success',
    data: result
  });
});

const getUserProjects = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const projects = await userService.getUserProjects(id);

  res.status(200).json({
    status: 'success',
    data: projects
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const user = await userService.updateUser(id, updateData);

  res.status(200).json({
    status: 'success',
    message: 'User updated successfully',
    data: user
  });
});

const deactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await userService.deactivateUser(id);

  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const activateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await userService.activateUser(id);

  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  const result = await userService.changePassword(id, currentPassword, newPassword);

  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const resetUserPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await userService.resetUserPassword(id);

  res.status(200).json({
    status: 'success',
    message: result.message,
    data: {
      tempPassword: result.tempPassword
    }
  });
});

const getStudentGrades = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const grades = await userService.getStudentGrades(id);

  res.status(200).json({
    status: 'success',
    data: grades
  });
});

module.exports = {
  createUser,
  importUsers,
  getUserById,
  getAllUsers,
  getUserProjects,
  updateUser,
  deactivateUser,
  activateUser,
  changePassword,
  resetUserPassword,
  getStudentGrades
};