const { Group, User, Project, Promotion } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const emailService = require('./email.service');

//create a new group manually by a teacher
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
  
  if (group.members.length - 1 < project.minGroupSize && !canModify) {
    throw new AppError(`Group would have less than the minimum size of ${project.minGroupSize}`, 400);
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
  
  if (project.groupFormationMethod !== 'free') {
    throw new AppError('Project does not allow free group formation', 400);
  }
  
  const allStudents = await User.findAll({
    where: { 
      promotionId: project.promotionId,
      role: 'student',
      isActive: true
    }
  });
  
  const groups = await Group.findAll({
    where: { projectId },
    include: [
      {
        model: User,
        as: 'members'
      }
    ]
  });
  
  const assignedStudentIds = new Set();
  groups.forEach(group => {
    group.members.forEach(member => {
      assignedStudentIds.add(member.id);
    });
  });
  
  const unassignedStudents = allStudents.filter(student => !assignedStudentIds.has(student.id));
  
  if (unassignedStudents.length === 0) {
    return { message: 'All students are already assigned to groups', groups };
  }
  
  for (let i = unassignedStudents.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unassignedStudents[i], unassignedStudents[j]] = [unassignedStudents[j], unassignedStudents[i]];
  }
  
  groups.sort((a, b) => a.members.length - b.members.length);
  
  const newGroups = [];
  let studentIndex = 0;
  
  for (const group of groups) {
    while (group.members.length < project.maxGroupSize && studentIndex < unassignedStudents.length) {
      await group.addMember(unassignedStudents[studentIndex]);
      
      try {
        await emailService.sendGroupAssignmentNotification(unassignedStudents[studentIndex], group, project);
      } catch (error) {
        console.error(`Failed to send notification to ${unassignedStudents[studentIndex].email}:`, error);
      }
      
      studentIndex++;
    }
  }
  
  if (studentIndex < unassignedStudents.length) {
    let groupCount = groups.length;
    
    while (studentIndex < unassignedStudents.length) {
      const newGroup = await Group.create({
        name: `Group ${groupCount + 1}`,
        projectId
      });
      
      newGroups.push(newGroup);
      groupCount++;
      
      const membersToAdd = [];
      while (membersToAdd.length < project.maxGroupSize && studentIndex < unassignedStudents.length) {
        membersToAdd.push(unassignedStudents[studentIndex]);
        studentIndex++;
      }
      
      await newGroup.addMembers(membersToAdd);
      
      for (const member of membersToAdd) {
        try {
          await emailService.sendGroupAssignmentNotification(member, newGroup, project);
        } catch (error) {
          console.error(`Failed to send notification to ${member.email}:`, error);
        }
      }
    }
  }
  
  return {
    message: `${unassignedStudents.length} students were assigned to groups`,
    newGroups,
    updatedGroups: groups
  };
};

module.exports = {
  createGroup,
  getGroupById,
  getProjectGroups,
  addMemberToGroup,
  removeMemberFromGroup,
  createGroupByStudent,
  assignRemainingStudents
};