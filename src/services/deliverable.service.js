const fs = require('fs');
const path = require('path');
const { Deliverable, DeliverableRule, Project, Group, Submission, User } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const emailService = require('./email.service');
const { bucket } = require('../utils/firebase');

const createDeliverable = async (projectId, deliverableData, teacherId) => {
  const project = await Project.findByPk(projectId);

  if (!project) throw new AppError('Project not found', 404);
  if (project.teacherId !== teacherId)
    throw new AppError('You are not authorized to add deliverables to this project', 403);

  const deliverable = await Deliverable.create({
    ...deliverableData,
    projectId
  });

  if (deliverableData.rules?.length) {
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
    include: ['project', 'rules']
  });
  if (!deliverable) throw new AppError('Deliverable not found', 404);
  return deliverable;
};

const getProjectDeliverables = async (projectId) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw new AppError('Project not found', 404);

  return await Deliverable.findAll({
    where: { projectId },
    include: ['rules'],
    order: [['deadline', 'ASC']]
  });
};

const updateDeliverable = async (deliverableId, updateData, teacherId) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: ['project', 'rules']
  });
  if (!deliverable) throw new AppError('Deliverable not found', 404);
  if (deliverable.project.teacherId !== teacherId) throw new AppError('You are not authorized to update this deliverable', 403);

  await deliverable.update(updateData);

  if (updateData.rules?.length) {
    await DeliverableRule.destroy({ where: { deliverableId } });
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
    include: ['project', 'submissions']
  });
  if (!deliverable) throw new AppError('Deliverable not found', 404);
  if (deliverable.project.teacherId !== teacherId) throw new AppError('You are not authorized to delete this deliverable', 403);
  if (deliverable.submissions?.length) throw new AppError('Cannot delete deliverable with existing submissions', 400);

  await DeliverableRule.destroy({ where: { deliverableId } });
  await deliverable.destroy();

  return { success: true, message: 'Deliverable deleted successfully' };
};

const submitDeliverable = async (deliverableId, submissionData, groupId, filePath = null) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: ['project', 'rules']
  });
  if (!deliverable) throw new AppError('Deliverable not found', 404);

  const group = await Group.findByPk(groupId, { include: ['members'] });
  if (!group) throw new AppError('Group not found', 404);
  if (group.projectId !== deliverable.projectId) throw new AppError('Group is not part of the project', 403);

  const now = new Date();
  const deadline = new Date(deliverable.deadline);
  const isLate = now > deadline;
  const hoursLate = isLate ? Math.ceil((now - deadline) / (1000 * 60 * 60)) : 0;

  if (isLate && !deliverable.allowLateSubmission) {
    throw new AppError('Deadline has passed and late submissions are not allowed', 400);
  }

  let submission = await Submission.findOne({ where: { groupId, deliverableId } });

  if (submission) {
    submission.submissionDate = now;
    submission.isLate = isLate;
    submission.hoursLate = hoursLate;

    if (filePath) {
      submission.filePath = filePath;
    }

    if (submissionData.gitUrl) {
      submission.gitUrl = submissionData.gitUrl;
    }

    submission.validationStatus = 'pending';
    submission.validationDetails = null;
    await submission.save();
  } else {
    submission = await Submission.create({
      submissionDate: now,
      isLate,
      hoursLate,
      filePath,
      gitUrl: submissionData.gitUrl || null,
      validationStatus: 'pending',
      groupId,
      deliverableId
    });
  }

  await validateSubmission(submission, deliverable);
  return submission;
};

const validateSubmission = async (submission, deliverable) => {
  if (!deliverable.rules?.length) {
    submission.validationStatus = 'valid';
    await submission.save();
    return submission;
  }

  const validationResults = { valid: true, details: [] };

  for (const rule of deliverable.rules) {
    const ruleResult = await validateRule(submission, rule);
    validationResults.details.push(ruleResult);
    if (!ruleResult.valid) validationResults.valid = false;
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
      if (!submission.filePath?.startsWith('http')) {
        result.message = 'Aucun fichier uploadé ou URL invalide';
        break;
      }

      try {
        const encodedPath = submission.filePath.split('/o/')[1]?.split('?')[0];
        const decodedPath = decodeURIComponent(encodedPath);
        const file = bucket.file(decodedPath);
        const [metadata] = await file.getMetadata();
        const fileSize = parseInt(metadata.size, 10);
        const maxSize = rule.rule.maxSize;

        if (fileSize <= maxSize) {
          result.valid = true;
          result.message = `Taille OK (${fileSize} / ${maxSize} octets)`;
        } else {
          result.message = `Fichier trop volumineux (${fileSize} > ${maxSize} octets)`;
        }
      } catch (error) {
        result.message = `Erreur lors de la vérification de taille : ${error.message}`;
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
      result.message = `Type de règle inconnu : ${rule.type}`;
  }

  return result;
};

const analyzeSimilarity = async (deliverableId) => {
  try {
    const deliverable = await Deliverable.findByPk(deliverableId, {
      include: [{
        model: Submission,
        as: 'submissions',
        include: ['group']
      }]
    });

    if (!deliverable) throw new AppError('Deliverable not found', 404);
    if (deliverable.submissions.length < 2) {
      throw new AppError('Not enough submissions to analyze similarity', 400);
    }

    const submissions = deliverable.submissions.filter(s => s.filePath);
    if (submissions.length < 2) {
      throw new AppError('Not enough file submissions to analyze similarity', 400);
    }

    console.log(`Analyse de similarité pour ${submissions.length} soumissions...`);

    const comparisons = [];
    const similarityMatrix = {};

    //compare chaque pair quand soumi
    for (let i = 0; i < submissions.length; i++) {
      similarityMatrix[submissions[i].id] = {};
      
      for (let j = i + 1; j < submissions.length; j++) {
        console.log(`Comparaison ${i+1}/${submissions.length} avec ${j+1}/${submissions.length}`);
        
        const result = await analyzeFileSimilarity(
          submissions[i].filePath,
          submissions[j].filePath
        );
        
        comparisons.push({
          submission1: submissions[i].id,
          submission2: submissions[j].id,
          group1: submissions[i].group.name,
          group2: submissions[j].group.name,
          similarity: result.finalScore,
          method: result.recommendedMethod,
          details: result
        });

        //matrice de similarité
        similarityMatrix[submissions[i].id][submissions[j].id] = result.finalScore;
        similarityMatrix[submissions[j].id] = similarityMatrix[submissions[j].id] || {};
        similarityMatrix[submissions[j].id][submissions[i].id] = result.finalScore;
      }
    }

    //calcule le score
    for (const submission of submissions) {
      const otherSubmissions = submissions.filter(s => s.id !== submission.id);
      if (otherSubmissions.length > 0) {
        const avgSimilarity = otherSubmissions.reduce((sum, other) => {
          return sum + (similarityMatrix[submission.id][other.id] || 0);
        }, 0) / otherSubmissions.length;
        
        submission.similarityScore = avgSimilarity;
        await submission.save();
      }
    }

    const suspiciousPairs = comparisons.filter(c => c.similarity > SIMILARITY_THRESHOLD);
    
    console.log(`Analyse terminée: ${suspiciousPairs.length} paires suspectes détectées`);

    return {
      deliverableId,
      submissionsCount: submissions.length,
      comparisons,
      similarityMatrix,
      suspiciousPairs,
      threshold: SIMILARITY_THRESHOLD,
      submissions: submissions.map(s => ({
        id: s.id,
        groupName: s.group.name,
        fileName: path.basename(s.filePath),
        avgSimilarityScore: s.similarityScore
      }))
    };

  } catch (error) {
    console.error('Erreur dans analyzeSimilarity:', error);
    throw error;
  }
};

const getDeliverableSummary = async (deliverableId, teacherId) => {
  const deliverable = await Deliverable.findByPk(deliverableId, {
    include: [
      {
        model: Project,
        as: 'project',
        include: [{ model: Group, as: 'groups' }]
      },
      {
        model: Submission,
        as: 'submissions',
        include: ['group']
      },
      { model: DeliverableRule, as: 'rules' }
    ]
  });

  if (!deliverable) throw new AppError('Deliverable not found', 404);
  if (deliverable.project.teacherId !== teacherId) throw new AppError('You are not authorized to view this summary', 403);

  const groupSummaries = deliverable.project.groups.map(group => {
    const submission = deliverable.submissions.find(s => s.groupId === group.id);
    return {
      group: { id: group.id, name: group.name },
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
  });

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
      deadline: { [Op.gt]: now, [Op.lt]: in24Hours }
    },
    include: [{
      model: Project,
      as: 'project',
      include: [{
        model: Promotion,
        as: 'promotion',
        include: [{ model: User, as: 'students', where: { isActive: true } }]
      }]
    }]
  });

  const remindersSent = [];

  for (const deliverable of upcomingDeliverables) {
    const students = deliverable.project.promotion.students;
    for (const student of students) {
      try {
        await emailService.sendDeadlineReminder(student, deliverable, deliverable.project);
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

  return { remindersSent, count: remindersSent.length };
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