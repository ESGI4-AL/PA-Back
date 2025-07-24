const { Group, User, Project, Promotion } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const { Op } = require('sequelize');
const emailService = require('./email.service');

const getPromotionStudents = async (promotionId) => {
  console.log('🔍 Service - Récupération des étudiants pour la promotion:', promotionId);

  const promotion = await Promotion.findByPk(promotionId);
  if (!promotion) {
    throw new AppError('Promotion not found', 404);
  }

  const students = await User.findAll({
    where: {
      promotionId: promotionId,
      role: 'student',
      isActive: true
    },
    attributes: ['id', 'firstName', 'lastName', 'email', 'promotionId'],
    order: [['lastName', 'ASC'], ['firstName', 'ASC']]
  });

  console.log('Service - Étudiants trouvés:', students.length);

  return students;
};

const createGroup = async (projectId, groupData) => {
  const project = await Project.findByPk(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.groupFormationMethod !== 'manual' && project.groupFormationMethod !== 'free') {
    throw new AppError(`Group formation method is set to ${project.groupFormationMethod}`, 400);
  }

  const group = await Group.create({
    name: groupData.name,
    projectId
  });

  if (groupData.memberIds && groupData.memberIds.length > 0) {
    if (groupData.memberIds.length < project.minGroupSize || groupData.memberIds.length > project.maxGroupSize) {
      throw new AppError(`Group size must be between ${project.minGroupSize} and ${project.maxGroupSize}`, 400);
    }

    const members = await User.findAll({
      where: {
        id: groupData.memberIds,
        promotionId: project.promotionId,
        role: 'student',
        isActive: true
      }
    });

    if (members.length !== groupData.memberIds.length) {
      throw new AppError('Some specified members do not exist or are not in the project promotion', 400);
    }
    for (const member of members) {
      const existingGroups = await member.getGroups({
        where: { projectId }
      });

      if (existingGroups.length > 0) {
        throw new AppError(`Student ${member.firstName} ${member.lastName} is already in another group for this project`, 400);
      }
    }

    await group.setMembers(members);

    for (const member of members) {
      try {
        await emailService.sendGroupAssignmentNotification(member, group, project);
      } catch (error) {
        console.error(`Failed to send group assignment notification to ${member.email}:`, error);
      }
    }
  }

  return group;
};

const getGroupById = async (groupId) => {
  const group = await Group.findByPk(groupId, {
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: User,
        as: 'members',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }
    ]
  });

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  return group;
};

const getProjectGroups = async (projectId) => {
  const project = await Project.findByPk(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  const groups = await Group.findAll({
    where: { projectId },
    include: [
      {
        model: User,
        as: 'members',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }
    ],
    order: [['name', 'ASC']]
  });

  return groups;
};

const addMemberToGroup = async (groupId, memberId, canModify = false) => {
  const group = await Group.findByPk(groupId, {
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: User,
        as: 'members'
      }
    ]
  });

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  const project = group.project;

  if (!canModify) {
    if (project.groupFormationMethod !== 'free') {
      throw new AppError('Only teachers can modify groups for this project', 403);
    }

    if (project.groupFormationDeadline && new Date() > new Date(project.groupFormationDeadline)) {
      throw new AppError('Group formation deadline has passed', 400);
    }
  }

  if (group.members.length >= project.maxGroupSize) {
    throw new AppError(`Group has reached its maximum size of ${project.maxGroupSize}`, 400);
  }

  const member = await User.findOne({
    where: {
      id: memberId,
      promotionId: project.promotionId,
      role: 'student',
      isActive: true
    }
  });

  if (!member) {
    throw new AppError('Student not found or not in the project promotion', 404);
  }

  const existingGroups = await member.getGroups({
    where: { projectId: project.id }
  });

  if (existingGroups.length > 0) {
    throw new AppError('Student is already in another group for this project', 400);
  }

  await group.addMember(member);

  try {
    await emailService.sendGroupAssignmentNotification(member, group, project);
  } catch (error) {
    console.error(`Failed to send group assignment notification to ${member.email}:`, error);
  }

  return { success: true, message: 'Member added to group successfully' };
};

const removeMemberFromGroup = async (groupId, memberId, canModify = false) => {
  const group = await Group.findByPk(groupId, {
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: User,
        as: 'members'
      }
    ]
  });

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  const project = group.project;

  if (!canModify) {
    if (project.groupFormationMethod !== 'free') {
      throw new AppError('Only teachers can modify groups for this project', 403);
    }

    if (project.groupFormationDeadline && new Date() > new Date(project.groupFormationDeadline)) {
      throw new AppError('Group formation deadline has passed', 400);
    }
  }

  const member = group.members.find(m => m.id === memberId);

  if (!member) {
    throw new AppError('Student is not a member of this group', 404);
  }

  await group.removeMember(member);

  return { success: true, message: 'Member removed from group successfully' };
};

const createGroupByStudent = async (projectId, groupData, studentId) => {
  const project = await Project.findByPk(projectId);

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.groupFormationMethod !== 'free') {
    throw new AppError('Project does not allow free group formation', 400);
  }

  if (project.groupFormationDeadline && new Date() > new Date(project.groupFormationDeadline)) {
    throw new AppError('Group formation deadline has passed', 400);
  }

  const student = await User.findOne({
    where: {
      id: studentId,
      promotionId: project.promotionId,
      role: 'student',
      isActive: true
    }
  });

  if (!student) {
    throw new AppError('You are not part of the project promotion', 403);
  }

  const existingGroups = await student.getGroups({
    where: { projectId }
  });

  if (existingGroups.length > 0) {
    throw new AppError('You are already in a group for this project', 400);
  }

  const group = await Group.create({
    name: groupData.name,
    projectId
  });

  await group.addMember(student);

  if (groupData.memberIds && groupData.memberIds.length > 0) {
    const otherMemberIds = groupData.memberIds.filter(id => id !== studentId);

    if (otherMemberIds.length + 1 > project.maxGroupSize) {
      throw new AppError(`Group size cannot exceed ${project.maxGroupSize}`, 400);
    }

    const members = await User.findAll({
      where: {
        id: otherMemberIds,
        promotionId: project.promotionId,
        role: 'student',
        isActive: true
      }
    });

    if (members.length !== otherMemberIds.length) {
      throw new AppError('Some specified members do not exist or are not in the project promotion', 400);
    }
    for (const member of members) {
      const memberGroups = await member.getGroups({
        where: { projectId }
      });

      if (memberGroups.length > 0) {
        throw new AppError(`Student ${member.firstName} ${member.lastName} is already in another group for this project`, 400);
      }
    }

    await group.addMembers(members);

    for (const member of members) {
      try {
        await emailService.sendGroupAssignmentNotification(member, group, project);
      } catch (error) {
        console.error(`Failed to send group assignment notification to ${member.email}:`, error);
      }
    }
  }

  return group;
};

const assignRemainingStudents = async (projectId) => {
  const project = await Project.findByPk(projectId, {
    include: [
      {
        model: Promotion,
        as: 'promotion'
      }
    ]
  });

  if (!project) {
    throw new AppError('Project not found', 404);
  }

  if (project.groupFormationMethod === 'automatic') {
    throw new AppError('This project uses automatic group formation. Use the dedicated automatic assignment feature instead.', 400);
  }

  console.log(`Début assignation pour projet: ${project.name} (méthode: ${project.groupFormationMethod})`);
  console.log(`Taille groupes: ${project.minGroupSize}-${project.maxGroupSize} étudiants`);

  const allStudents = await User.findAll({
    where: {
      promotionId: project.promotionId,
      role: 'student',
      isActive: true
    }
  });

  console.log(`👥 Total étudiants dans la promotion: ${allStudents.length}`);

  const groups = await Group.findAll({
    where: { projectId },
    include: [
      {
        model: User,
        as: 'members'
      }
    ]
  });

  console.log(`Groupes existants: ${groups.length}`);

  const assignedStudentIds = new Set();
  groups.forEach(group => {
    group.members.forEach(member => {
      assignedStudentIds.add(member.id);
    });
  });

  const unassignedStudents = allStudents.filter(student => !assignedStudentIds.has(student.id));

  console.log(`Étudiants non assignés: ${unassignedStudents.length}`);

  if (unassignedStudents.length === 0) {
    return {
      message: 'Tous les étudiants sont déjà assignés à des groupes',
      groups: groups,
      newGroups: [],
      updatedGroups: [],
      totalAssigned: 0,
      groupsCreated: 0,
      groupsUpdated: 0
    };
  }

  const shuffledStudents = [...unassignedStudents];
  for (let i = shuffledStudents.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledStudents[i], shuffledStudents[j]] = [shuffledStudents[j], shuffledStudents[i]];
  }

  console.log('Étudiants mélangés:', shuffledStudents.map(s => `${s.firstName} ${s.lastName}`));

  const sortedGroups = groups.sort((a, b) => a.members.length - b.members.length);

  const updatedGroups = [];
  const newGroups = [];
  let studentIndex = 0;

  console.log('Phase 1: Compléter les groupes existants...');
  for (const group of sortedGroups) {
    if (studentIndex >= shuffledStudents.length) break;

    const currentMemberCount = group.members.length;
    const availableSlots = project.maxGroupSize - currentMemberCount;

    if (availableSlots > 0) {
      const studentsToAdd = [];
      const maxToAdd = Math.min(availableSlots, shuffledStudents.length - studentIndex);

      for (let i = 0; i < maxToAdd; i++) {
        studentsToAdd.push(shuffledStudents[studentIndex]);
        studentIndex++;
      }

      if (studentsToAdd.length > 0) {
        console.log(`Ajout de ${studentsToAdd.length} étudiants au groupe "${group.name}" (${currentMemberCount} -> ${currentMemberCount + studentsToAdd.length})`);
        await group.addMembers(studentsToAdd);
        updatedGroups.push(group);

        for (const student of studentsToAdd) {
          try {
            await emailService.sendGroupAssignmentNotification(student, group, project);
          } catch (error) {
            console.error(`Failed to send notification to ${student.email}:`, error);
          }
        }
      }
    }
  }

  const remainingStudentsCount = shuffledStudents.length - studentIndex;
  console.log(`Phase 2: Créer de nouveaux groupes pour ${remainingStudentsCount} étudiants restants...`);

  let groupCounter = groups.length + 1;

  while (studentIndex < shuffledStudents.length) {
    const remainingStudents = shuffledStudents.length - studentIndex;
    let groupSize;

    if (remainingStudents >= project.maxGroupSize) {

      groupSize = project.maxGroupSize;
      console.log(`Création d'un groupe complet de ${groupSize} étudiants`);
    } else if (remainingStudents >= project.minGroupSize) {

      groupSize = remainingStudents;
      console.log(`Création d'un groupe final de ${groupSize} étudiants`);
    } else {

      console.log(`Il reste seulement ${remainingStudents} étudiants (moins que le minimum ${project.minGroupSize})`);

      let distributed = false;


      const allExistingGroups = [...sortedGroups, ...newGroups];

      for (const group of allExistingGroups) {
        if (studentIndex >= shuffledStudents.length) break;


        const currentMemberCount = await group.countMembers();
        const availableSlots = project.maxGroupSize - currentMemberCount;

        if (availableSlots > 0) {
          const studentsToAdd = [];
          const maxToAdd = Math.min(availableSlots, shuffledStudents.length - studentIndex);

          for (let i = 0; i < maxToAdd; i++) {
            studentsToAdd.push(shuffledStudents[studentIndex]);
            studentIndex++;
          }

          if (studentsToAdd.length > 0) {
            console.log(`👥 Répartition de ${studentsToAdd.length} étudiants dans le groupe "${group.name}"`);
            await group.addMembers(studentsToAdd);


            if (!updatedGroups.includes(group) && !newGroups.includes(group)) {
              updatedGroups.push(group);
            }

            for (const student of studentsToAdd) {
              try {
                await emailService.sendGroupAssignmentNotification(student, group, project);
              } catch (error) {
                console.error(`Failed to send notification to ${student.email}:`, error);
              }
            }

            distributed = true;
          }
        }
      }

      if (!distributed && studentIndex < shuffledStudents.length) {

        groupSize = remainingStudents;
        console.log(`Création forcée d'un groupe de ${groupSize} étudiants (en dessous du minimum de ${project.minGroupSize})`);
      } else {

        break;
      }
    }


    if (groupSize && studentIndex < shuffledStudents.length) {
      const newGroup = await Group.create({
        name: `Groupe ${groupCounter}`,
        projectId
      });

      const membersToAdd = [];
      for (let i = 0; i < groupSize && studentIndex < shuffledStudents.length; i++) {
        membersToAdd.push(shuffledStudents[studentIndex]);
        studentIndex++;
      }

      await newGroup.addMembers(membersToAdd);

      console.log(`Nouveau groupe "${newGroup.name}" créé avec ${membersToAdd.length} membres`);
      newGroups.push(newGroup);
      groupCounter++;


      for (const member of membersToAdd) {
        try {
          await emailService.sendGroupAssignmentNotification(member, newGroup, project);
        } catch (error) {
          console.error(`Failed to send notification to ${member.email}:`, error);
        }
      }
    }
  }

  const totalAssigned = unassignedStudents.length;
  console.log(`=============== ASSIGNATION TERMINÉE ===============`);
  console.log(`Total étudiants assignés: ${totalAssigned}`);
  console.log(`Groupes mis à jour: ${updatedGroups.length}`);
  console.log(`Nouveaux groupes créés: ${newGroups.length}`);
  console.log(`===============================================`);

  return {
    message: `${totalAssigned} étudiants ont été assignés automatiquement aux groupes`,
    newGroups,
    updatedGroups,
    totalAssigned,
    groupsCreated: newGroups.length,
    groupsUpdated: updatedGroups.length
  };
};
const getGroupProject = async (groupId) => {
  const group = await Group.findByPk(groupId, {
    include: {
      model: Project,
      as: 'project'
    }
  });

  if (!group || !group.project) {
    throw new Error("Projet non trouvé pour ce groupe.");
  }

  return group.project;
};

const deleteGroup = async (groupId, isTeacher) => {
  const group = await Group.findByPk(groupId, {
    include: [
      {
        model: User,
        as: 'members',
        through: { attributes: [] }
      }
    ]
  });

  if (!group) {
    throw new Error('Group not found');
  }

  if (!isTeacher) {
    throw new Error('Only teachers can delete groups');
  }

  await group.setMembers([]);

  await group.destroy();

  return {
    message: 'Group deleted successfully'
  };
};

const updateGroup = async (groupId, updateData, isTeacher) => {
  const group = await Group.findByPk(groupId, {
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: User,
        as: 'members'
      }
    ]
  });

  if (!group) {
    throw new AppError('Group not found', 404);
  }

  if (!isTeacher) {
    throw new AppError('Only teachers can update groups', 403);
  }

  if (updateData.name) {
    group.name = updateData.name;
    await group.save();
  }

  if (updateData.memberIds) {
    const project = group.project;

    if (updateData.memberIds.length < project.minGroupSize ||
        updateData.memberIds.length > project.maxGroupSize) {
      throw new AppError(`Group size must be between ${project.minGroupSize} and ${project.maxGroupSize}`, 400);
    }

    const members = await User.findAll({
      where: {
        id: updateData.memberIds,
        promotionId: project.promotionId,
        role: 'student',
        isActive: true
      }
    });

    if (members.length !== updateData.memberIds.length) {
      throw new AppError('Some specified members do not exist or are not in the project promotion', 400);
    }

    for (const member of members) {
      const existingGroups = await member.getGroups({
        where: {
          projectId: project.id,
          id: { [Op.ne]: groupId }
        }
      });

      if (existingGroups.length > 0) {
        throw new AppError(`Student ${member.firstName} ${member.lastName} is already in another group for this project`, 400);
      }
    }

    await group.setMembers(members);
  }

  const updatedGroup = await Group.findByPk(groupId, {
    include: [
      {
        model: User,
        as: 'members',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }
    ]
  });

  return updatedGroup;
};

const getUserGroupForProject = async (projectId, userId) => {
  console.log(`🔍 Service - Recherche du groupe pour l'utilisateur ${userId} dans le projet ${projectId}`);

  try {
    // Vérifier que le projet existe
    const project = await Project.findByPk(projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Rechercher le groupe contenant cet utilisateur pour ce projet
    const userGroup = await Group.findOne({
      where: {
        projectId: projectId
      },
      include: [
        {
          model: User,
          as: 'members',
          where: {
            id: userId
          },
          attributes: ['id', 'firstName', 'lastName', 'email'],
          required: true // INNER JOIN pour s'assurer que l'utilisateur est membre
        }
      ]
    });

    if (!userGroup) {
      console.log(`ℹ️ Service - Utilisateur ${userId} non assigné à un groupe pour le projet ${projectId}`);
      return null;
    }

    console.log(`✅ Service - Groupe trouvé: ${userGroup.name} (ID: ${userGroup.id})`);
    return userGroup;

  } catch (error) {
    console.error('❌ Service - Erreur lors de la récupération du groupe utilisateur:', error);
    throw error;
  }
};


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