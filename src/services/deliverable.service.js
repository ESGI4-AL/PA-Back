const fs = require('fs');
const path = require('path');
const { Deliverable, DeliverableRule, Project, Group, Submission, User } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const emailService = require('./email.service');

const createDeliverable = async (projectId, deliverableData, teacherId) => {
  const project = await Project.findByPk(projectId);
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to add deliverables to this project', 403);
  }
  
  const deliverable = await Deliverable.create({
    ...deliverableData,
    projectId
  });
  
  if (deliverableData.rules && Array.isArray(deliverableData.rules)) {
    const rules = [];
    
    for (const ruleData of deliverableData.rules) {
      const rule = await DeliverableRule.create({
        type: ruleData.type,
        rule: ruleData.rule,
        description: ruleData.description,
        deliverableId: deliverable.id
      });
      
      rules.push(rule);
    }
    
    deliverable.rules = rules;
  }
  
  return deliverable;
};

const getDeliverableById = async (deliverableId) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: DeliverableRule,
        as: 'rules'
      }
    ]
  });
  
  if (!deliverable) {
    throw new AppError('Deliverable not found', 404);
  }
  
  return deliverable;
};

const getProjectDeliverables = async (projectId) => {
  const project = await Project.findByPk(projectId);
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  const deliverables = await Deliverable.findAll({
    where: { projectId },
    include: [
      {
        model: DeliverableRule,
        as: 'rules'
      }
    ],
    order: [['deadline', 'ASC']]
  });
  
  return deliverables;
};

const updateDeliverable = async (deliverableId, updateData, teacherId) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: DeliverableRule,
        as: 'rules'
      }
    ]
  });
  
  if (!deliverable) {
    throw new AppError('Deliverable not found', 404);
  }
  
  if (deliverable.project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to update this deliverable', 403);
  }
  
  await deliverable.update(updateData);
  
  if (updateData.rules && Array.isArray(updateData.rules)) {
    if (deliverable.rules && deliverable.rules.length > 0) {
      await DeliverableRule.destroy({
        where: { deliverableId }
      });
    }
    const newRules = [];
    
    for (const ruleData of updateData.rules) {
      const rule = await DeliverableRule.create({
        type: ruleData.type,
        rule: ruleData.rule,
        description: ruleData.description,
        deliverableId: deliverable.id
      });
      
      newRules.push(rule);
    }
    
    deliverable.rules = newRules;
  }
  
  return deliverable;
};

const deleteDeliverable = async (deliverableId, teacherId) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: Submission,
        as: 'submissions'
      }
    ]
  });
  
  if (!deliverable) {
    throw new AppError('Deliverable not found', 404);
  }
  
  if (deliverable.project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to delete this deliverable', 403);
  }
  
  if (deliverable.submissions && deliverable.submissions.length > 0) {
    throw new AppError('Cannot delete deliverable with existing submissions', 400);
  }
  
  await DeliverableRule.destroy({
    where: { deliverableId }
  });
  
  await deliverable.destroy();
  
  return { success: true, message: 'Deliverable deleted successfully' };
};

const submitDeliverable = async (deliverableId, submissionData, groupId, filePath = null) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: DeliverableRule,
        as: 'rules'
      }
    ]
  });
  
  if (!deliverable) {
    throw new AppError('Deliverable not found', 404);
  }
  
  const group = await Group.findByPk(groupId, {
    include: [
      {
        model: User,
        as: 'members'
      }
    ]
  });
  
  if (!group) {
    throw new AppError('Group not found', 404);
  }
  if (group.projectId !== deliverable.projectId) {
    throw new AppError('Group is not part of the project', 403);
  }
  
  const now = new Date();
  const deadline = new Date(deliverable.deadline);
  let isLate = false;
  let hoursLate = 0;
  
  if (now > deadline) {
    if (!deliverable.allowLateSubmission) {
      throw new AppError('Deadline has passed and late submissions are not allowed', 400);
    }
    
    isLate = true;
    hoursLate = Math.ceil((now - deadline) / (1000 * 60 * 60));
  }
  
  const existingSubmission = await Submission.findOne({
    where: {
      groupId,
      deliverableId
    }
  });
  
  if (existingSubmission) {
    existingSubmission.submissionDate = now;
    existingSubmission.isLate = isLate;
    existingSubmission.hoursLate = hoursLate;
    
    if (filePath) {
      if (existingSubmission.filePath) {
        try {
          fs.unlinkSync(path.join(__dirname, '../../', existingSubmission.filePath));
        } catch (error) {
          console.error('Error deleting old file:', error);
        }
      }
      
      existingSubmission.filePath = filePath;
    }
    
    if (submissionData.gitUrl) {
      existingSubmission.gitUrl = submissionData.gitUrl;
    }
    existingSubmission.validationStatus = 'pending';
    existingSubmission.validationDetails = null;
    
    await existingSubmission.save();
    
    await validateSubmission(existingSubmission, deliverable);
    
    return existingSubmission;
  } else {
    const submission = await Submission.create({
      submissionDate: now,
      isLate,
      hoursLate,
      filePath,
      gitUrl: submissionData.gitUrl || null,
      validationStatus: 'pending',
      groupId,
      deliverableId
    });
    
    await validateSubmission(submission, deliverable);
    
    return submission;
  }
};

const validateSubmission = async (submission, deliverable) => {
  if (!deliverable.rules || deliverable.rules.length === 0) {
    submission.validationStatus = 'valid';
    await submission.save();
    return submission;
  }
  
  const validationResults = {
    valid: true,
    details: []
  };
  
  for (const rule of deliverable.rules) {
    const ruleResult = await validateRule(submission, rule);
    validationResults.details.push(ruleResult);
    
    if (!ruleResult.valid) {
      validationResults.valid = false;
    }
  }
  
  submission.validationStatus = validationResults.valid ? 'valid' : 'invalid';
  submission.validationDetails = validationResults;
  
  await submission.save();
  
  return submission;
};

const validateRule = async (submission, rule) => {
  const result = {
    ruleId: rule.id,
    type: rule.type,
    description: rule.description,
    valid: false,
    message: ''
  };
  
  switch (rule.type) {
    case 'file_size':
      if (!submission.filePath) {
        result.valid = false;
        result.message = 'No file uploaded';
        break;
      }
      
      try {
        const stats = fs.statSync(path.join(__dirname, '../../', submission.filePath));
        const fileSize = stats.size;
        
        if (fileSize <= rule.rule.maxSize) {
          result.valid = true;
          result.message = `File size (${fileSize} bytes) is within the limit (${rule.rule.maxSize} bytes)`;
        } else {
          result.valid = false;
          result.message = `File size (${fileSize} bytes) exceeds the maximum allowed size (${rule.rule.maxSize} bytes)`;
        }
      } catch (error) {
        result.valid = false;
        result.message = `Error checking file size: ${error.message}`;
      }
      break;
      
    case 'file_presence':
      result.valid = true;
      result.message = 'File presence check is not implemented yet';
      break;
      
    case 'folder_structure':
      result.valid = true;
      result.message = 'Folder structure check is not implemented yet';
      break;
      
    case 'file_content':
      result.valid = true;
      result.message = 'File content check is not implemented yet';
      break;
      
    default:
      result.valid = false;
      result.message = `Unknown rule type: ${rule.type}`;
  }
  
  return result;
};

//code similarity
const analyzeSimilarity = async (deliverableId) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: [
      {
        model: Submission,
        as: 'submissions',
        include: [
          {
            model: Group,
            as: 'group'
          }
        ]
      }
    ]
  });
  
  if (!deliverable) {
    throw new AppError('Deliverable not found', 404);
  }
  
  if (!deliverable.submissions || deliverable.submissions.length < 2) {
    throw new AppError('Not enough submissions to analyze similarity', 400);
  }
  //not implemented yet for the moment it's random
  const submissions = deliverable.submissions;
  
  for (const submission of submissions) {
    submission.similarityScore = Math.random();
    await submission.save();
  }
  
  return {
    deliverableId,
    submissionsCount: submissions.length,
    submissions: submissions.map(s => ({
      id: s.id,
      groupName: s.group.name,
      similarityScore: s.similarityScore
    }))
  };
};

const getDeliverableSummary = async (deliverableId, teacherId) => {
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
      },
      {
        model: Submission,
        as: 'submissions',
        include: [
          {
            model: Group,
            as: 'group'
          }
        ]
      },
      {
        model: DeliverableRule,
        as: 'rules'
      }
    ]
  });
  
  if (!deliverable) {
    throw new AppError('Deliverable not found', 404);
  }
  
  if (deliverable.project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to view this summary', 403);
  }
  
  const groupSummaries = [];
  
  for (const group of deliverable.project.groups) {
    const submission = deliverable.submissions.find(s => s.groupId === group.id);
    
    const summary = {
      group: {
        id: group.id,
        name: group.name
      },
      submission: submission ? {
        id: submission.id,
        submissionDate: submission.submissionDate,
        isLate: submission.isLate,
        hoursLate: submission.hoursLate,
        validationStatus: submission.validationStatus,
        validationDetails: submission.validationDetails,
        similarityScore: submission.similarityScore
      } : null
    };
    
    groupSummaries.push(summary);
  }
  
  return {
    deliverable: {
      id: deliverable.id,
      name: deliverable.name,
      description: deliverable.description,
      type: deliverable.type,
      deadline: deliverable.deadline,
      allowLateSubmission: deliverable.allowLateSubmission,
      latePenaltyPerHour: deliverable.latePenaltyPerHour
    },
    rules: deliverable.rules,
    groupSummaries
  };
};

const sendDeadlineReminders = async () => {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  const upcomingDeliverables = await Deliverable.findAll({
    where: {
      deadline: {
        [Op.gt]: now,
        [Op.lt]: in24Hours
      }
    },
    include: [
      {
        model: Project,
        as: 'project',
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
      }
    ]
  });
  
  const remindersSent = [];
  
  for (const deliverable of upcomingDeliverables) {
    const project = deliverable.project;
    const students = project.promotion.students;
    
    for (const student of students) {
      try {
        await emailService.sendDeadlineReminder(student, deliverable, project);
        remindersSent.push({
          deliverableId: deliverable.id,
          deliverableName: deliverable.name,
          studentId: student.id,
          studentEmail: student.email
        });
      } catch (error) {
        console.error(`Failed to send reminder to ${student.email}:`, error);
      }
    }
  }
  
  return {
    remindersSent,
    count: remindersSent.length
  };
};

module.exports = {
  createDeliverable,
  getDeliverableById,
  getProjectDeliverables,
  updateDeliverable,
  deleteDeliverable,
  submitDeliverable,
  validateSubmission,
  analyzeSimilarity,
  getDeliverableSummary,
  sendDeadlineReminders
};