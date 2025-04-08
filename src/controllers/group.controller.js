const groupService = require('../services/group.service');
const { asyncHandler } = require('../middlewares/error.middleware');

const createGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const groupData = req.body;
  
  const group = await groupService.createGroup(id, groupData);
  
  res.status(201).json({
    status: 'success',
    message: 'Group created successfully',
    data: group
  });
});

const getGroupById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const group = await groupService.getGroupById(id);
  
  res.status(200).json({
    status: 'success',
    data: group
  });
});

const getProjectGroups = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const groups = await groupService.getProjectGroups(id);
  
  res.status(200).json({
    status: 'success',
    data: groups
  });
});

const addMemberToGroup = asyncHandler(async (req, res) => {
  const { id, memberId } = req.params;
  const isTeacher = req.user.role === 'teacher';
  
  const result = await groupService.addMemberToGroup(id, memberId, isTeacher);
  
  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const removeMemberFromGroup = asyncHandler(async (req, res) => {
  const { id, memberId } = req.params;
  const isTeacher = req.user.role === 'teacher';
  
  const result = await groupService.removeMemberFromGroup(id, memberId, isTeacher);
  
  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const createGroupByStudent = asyncHandler(async (req, res) => {
  const { id } = req.params; 
  const groupData = req.body;
  const studentId = req.user.id;
  
  const group = await groupService.createGroupByStudent(id, groupData, studentId);
  
  res.status(201).json({
    status: 'success',
    message: 'Group created successfully',
    data: group
  });
});

const assignRemainingStudents = asyncHandler(async (req, res) => {
  const { id } = req.params; 
  
  const result = await groupService.assignRemainingStudents(id);
  
  res.status(200).json({
    status: 'success',
    message: result.message,
    data: result
  });
});

module.exports = {
  createGroup,
  getGroupById,
  getProjectGroups,
  addMemberToGroup,
  removeMemberFromGroup,
  createGroupByStudent,
  assignRemainingStudents
};