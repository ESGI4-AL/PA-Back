const groupService = require('../services/group.service');
const { asyncHandler } = require('../middlewares/error.middleware');
const { Group, Project, User } = require('../models'); // Ajout de User ici !

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

// Version corrigée qui utilise le service au lieu de faire la requête directement
const getUserGroupForProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  console.log(`🔍 Contrôleur - Recherche du groupe pour l'utilisateur ${userId} dans le projet ${projectId}`);

  try {
    // Utiliser le service au lieu de faire la requête directement
    const userGroup = await groupService.getUserGroupForProject(projectId, userId);

    if (!userGroup) {
      console.log(`ℹ️ Contrôleur - Utilisateur ${userId} non assigné à un groupe pour le projet ${projectId}`);
      return res.status(404).json({
        status: 'error',
        message: 'Utilisateur non assigné à un groupe pour ce projet',
        data: null
      });
    }

    console.log(`✅ Contrôleur - Groupe trouvé: ${userGroup.name} (ID: ${userGroup.id})`);

    res.status(200).json({
      status: 'success',
      data: userGroup,
      message: 'Groupe utilisateur récupéré avec succès'
    });

  } catch (error) {
    console.error('❌ Contrôleur - Erreur lors de la récupération du groupe utilisateur:', error);
    throw error; // asyncHandler va gérer l'erreur
  }
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

const getGroupProject = asyncHandler(async (req, res) => {
  const { groupId } = req.params;

  const project = await groupService.getGroupProject(groupId);

  res.status(200).json({
    status: 'success',
    data: project
  });
});

const deleteGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isTeacher = req.user.role === 'teacher';
  
  const result = await groupService.deleteGroup(id, isTeacher);
  
  res.status(200).json({
    status: 'success',
    message: result.message || 'Group deleted successfully'
  });
});

const updateGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const isTeacher = req.user.role === 'teacher';
  
  const updatedGroup = await groupService.updateGroup(id, updateData, isTeacher);
  
  res.status(200).json({
    status: 'success',
    message: 'Group updated successfully',
    data: updatedGroup
  });
});

const getPromotionStudents = asyncHandler(async (req, res) => {
  const { promotionId } = req.params;
  
  const students = await groupService.getPromotionStudents(promotionId);
  
  res.status(200).json({
    success: true,
    data: {
      students: students
    },
    message: `${students.length} étudiants trouvés dans la promotion`
  });
});

module.exports = {
  createGroup,
  getGroupById,
  getProjectGroups,
  addMemberToGroup,
  removeMemberFromGroup,
  createGroupByStudent,
  assignRemainingStudents,
  getGroupProject,
  deleteGroup,
  updateGroup,
  getPromotionStudents,
  getUserGroupForProject
};