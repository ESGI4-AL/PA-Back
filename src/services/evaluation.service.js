const { EvaluationCriteria, Grade, Project, Group, User, Deliverable, Report, PresentationSchedule } = require('../models');
const { AppError } = require('../middlewares/error.middleware');
const emailService = require('./email.service');

const createEvaluationCriteria = async (projectId, criteriaData, teacherId) => {
  const project = await Project.findByPk(projectId);
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to create criteria for this project', 403);
  }
  
  if (!['deliverable', 'report', 'presentation'].includes(criteriaData.evaluationType)) {
    throw new AppError('Evaluation type must be deliverable, report, or presentation', 400);
  }
  
  if (criteriaData.weight <= 0) {
    throw new AppError('Weight must be positive', 400);
  }
  
  const criteria = await EvaluationCriteria.create({
    name: criteriaData.name,
    description: criteriaData.description || null,
    weight: criteriaData.weight,
    type: criteriaData.type || 'group',
    evaluationType: criteriaData.evaluationType,
    projectId
  });
  
  return criteria;
};

const getProjectEvaluationCriteria = async (projectId) => {
  const project = await Project.findByPk(projectId);
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  const criteria = await EvaluationCriteria.findAll({
    where: { projectId },
    order: [
      ['evaluationType', 'ASC'],
      ['type', 'ASC'],
      ['name', 'ASC']
    ]
  });
  
  return criteria;
};

const updateEvaluationCriteria = async (criteriaId, updateData, teacherId) => {
  const criteria = await EvaluationCriteria.findByPk(criteriaId, {
    include: [
      {
        model: Project,
        as: 'project'
      }
    ]
  });
  
  if (!criteria) {
    throw new AppError('Evaluation criteria not found', 404);
  }
  
  if (criteria.project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to update this criteria', 403);
  }
  
  if (updateData.weight !== undefined && updateData.weight <= 0) {
    throw new AppError('Weight must be positive', 400);
  }
  
  await criteria.update({
    name: updateData.name !== undefined ? updateData.name : criteria.name,
    description: updateData.description !== undefined ? updateData.description : criteria.description,
    weight: updateData.weight !== undefined ? updateData.weight : criteria.weight,
    type: updateData.type !== undefined ? updateData.type : criteria.type
  });
  
  return criteria;
};

const deleteEvaluationCriteria = async (criteriaId, teacherId) => {
  const criteria = await EvaluationCriteria.findByPk(criteriaId, {
    include: [
      {
        model: Project,
        as: 'project'
      },
      {
        model: Grade,
        as: 'grades'
      }
    ]
  });
  
  if (!criteria) {
    throw new AppError('Evaluation criteria not found', 404);
  }
  
  if (criteria.project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to delete this criteria', 403);
  }
  
  if (criteria.grades && criteria.grades.length > 0) {
    throw new AppError('Cannot delete criteria with associated grades', 400);
  }
  
  await criteria.destroy();
  
  return { success: true, message: 'Evaluation criteria deleted successfully' };
};

const gradeGroupCriteria = async (criteriaId, groupId, gradeData, teacherId) => {
  const criteria = await EvaluationCriteria.findByPk(criteriaId, {
    include: [
      {
        model: Project,
        as: 'project'
      }
    ]
  });
  
  if (!criteria) {
    throw new AppError('Evaluation criteria not found', 404);
  }
  
  if (criteria.project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to grade this criteria', 403);
  }
  
  if (criteria.type !== 'group') {
    throw new AppError('This criteria is for individual evaluation, not group', 400);
  }
  
  const group = await Group.findByPk(groupId);
  
  if (!group) {
    throw new AppError('Group not found', 404);
  }
  
  if (group.projectId !== criteria.projectId) {
    throw new AppError('Group is not part of the project', 400);
  }
  
  if (gradeData.score < 0) {
    throw new AppError('Score cannot be negative', 400);
  }
  
  const existingGrade = await Grade.findOne({
    where: {
      criteriaId,
      groupId
    }
  });
  
  if (existingGrade) {
    await existingGrade.update({
      score: gradeData.score,
      comment: gradeData.comment || existingGrade.comment,
      isPublished: gradeData.isPublished !== undefined ? gradeData.isPublished : existingGrade.isPublished
    });
    
    return existingGrade;
  } else {
    const grade = await Grade.create({
      score: gradeData.score,
      comment: gradeData.comment || null,
      isPublished: gradeData.isPublished === true,
      criteriaId,
      groupId
    });
    
    if (criteria.evaluationType === 'deliverable' && gradeData.deliverableId) {
      grade.deliverableId = gradeData.deliverableId;
      await grade.save();
    } else if (criteria.evaluationType === 'report' && gradeData.reportId) {
      grade.reportId = gradeData.reportId;
      await grade.save();
    } else if (criteria.evaluationType === 'presentation' && gradeData.presentationId) {
      grade.presentationId = gradeData.presentationId;
      await grade.save();
    }
    
    return grade;
  }
};

const gradeIndividualCriteria = async (criteriaId, studentId, gradeData, teacherId) => {
  const criteria = await EvaluationCriteria.findByPk(criteriaId, {
    include: [
      {
        model: Project,
        as: 'project'
      }
    ]
  });
  
  if (!criteria) {
    throw new AppError('Evaluation criteria not found', 404);
  }
  
  if (criteria.project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to grade this criteria', 403);
  }
  
  if (criteria.type !== 'individual') {
    throw new AppError('This criteria is for group evaluation, not individual', 400);
  }
  
  const student = await User.findByPk(studentId);
  
  if (!student) {
    throw new AppError('Student not found', 404);
  }
  
  if (student.role !== 'student') {
    throw new AppError('User is not a student', 400);
  }
  
  const project = criteria.project;
  const studentPromotion = await student.getPromotion();
  
  if (!studentPromotion || studentPromotion.id !== project.promotionId) {
    throw new AppError('Student is not part of the project promotion', 400);
  }
  
  if (gradeData.score < 0) {
    throw new AppError('Score cannot be negative', 400);
  }
  
  const existingGrade = await Grade.findOne({
    where: {
      criteriaId,
      studentId
    }
  });
  
  if (existingGrade) {
    await existingGrade.update({
      score: gradeData.score,
      comment: gradeData.comment || existingGrade.comment,
      isPublished: gradeData.isPublished !== undefined ? gradeData.isPublished : existingGrade.isPublished
    });
    
    return existingGrade;
  } else {
    const grade = await Grade.create({
      score: gradeData.score,
      comment: gradeData.comment || null,
      isPublished: gradeData.isPublished === true,
      criteriaId,
      studentId
    });
    
    if (criteria.evaluationType === 'deliverable' && gradeData.deliverableId) {
      grade.deliverableId = gradeData.deliverableId;
      await grade.save();
    } else if (criteria.evaluationType === 'report' && gradeData.reportId) {
      grade.reportId = gradeData.reportId;
      await grade.save();
    } else if (criteria.evaluationType === 'presentation' && gradeData.presentationId) {
      grade.presentationId = gradeData.presentationId;
      await grade.save();
    }
    
    return grade;
  }
};

const getProjectGrades = async (projectId, teacherId) => {
  const project = await Project.findByPk(projectId);
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to view grades for this project', 403);
  }
  
  const allGroups = await Group.findAll({
    where: { projectId },
    include: [
      {
        model: User,
        as: 'members',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }
    ]
  });
  
  const allStudents = await User.findAll({
    where: { 
      role: 'student',
      promotionId: project.promotionId
    },
    attributes: ['id', 'firstName', 'lastName', 'email']
  });
  
  const criteria = await EvaluationCriteria.findAll({
    where: { projectId }
  });
  
  const criteriaIds = criteria.map(c => c.id);
  
  const grades = await Grade.findAll({
    where: {
      criteriaId: criteriaIds
    },
    include: [
      {
        model: EvaluationCriteria,
        as: 'criteria'
      },
      {
        model: Group,
        as: 'group',
        include: [
          {
            model: User,
            as: 'members',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      },
      {
        model: User,
        as: 'student',
        attributes: ['id', 'firstName', 'lastName', 'email']
      },
      {
        model: Deliverable,
        as: 'deliverable'
      },
      {
        model: Report,
        as: 'report'
      },
      {
        model: PresentationSchedule,
        as: 'presentation'
      }
    ]
  });
  
  const organizedGrades = {
    deliverable: { group: {}, individual: {} },
    report: { group: {}, individual: {} },
    presentation: { group: {}, individual: {} }
  };
  
  for (const group of allGroups) {
    for (const evaluationType of ['deliverable', 'report', 'presentation']) {
      organizedGrades[evaluationType].group[group.id] = {
        group: group,
        grades: []
      };
    }
  }
  
  for (const student of allStudents) {
    for (const evaluationType of ['deliverable', 'report', 'presentation']) {
      organizedGrades[evaluationType].individual[student.id] = {
        student: student,
        grades: []
      };
    }
  }
  
  for (const grade of grades) {
    const evaluationType = grade.criteria.evaluationType;
    const criteriaType = grade.criteria.type;
    
    if (criteriaType === 'group' && grade.group) {
      if (organizedGrades[evaluationType].group[grade.groupId]) {
        organizedGrades[evaluationType].group[grade.groupId].grades.push(grade);
      }
    } else if (criteriaType === 'individual' && grade.student) {
      if (organizedGrades[evaluationType].individual[grade.studentId]) {
        organizedGrades[evaluationType].individual[grade.studentId].grades.push(grade);
      }
    }
  }
  
  return organizedGrades;
};

const calculateGroupFinalGrade = async (projectId, groupId, teacherId) => {
  const project = await Project.findByPk(projectId);
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to calculate grades for this project', 403);
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
  const criteria = await EvaluationCriteria.findAll({
    where: { projectId }
  });
  const groupGrades = await Grade.findAll({
    where: {
      criteriaId: criteria.map(c => c.id),
      groupId
    },
    include: [
      {
        model: EvaluationCriteria,
        as: 'criteria'
      }
    ]
  });
  
  const memberIds = group.members.map(member => member.id);
  const individualGrades = await Grade.findAll({
    where: {
      criteriaId: criteria.map(c => c.id),
      studentId: memberIds
    },
    include: [
      {
        model: EvaluationCriteria,
        as: 'criteria'
      },
      {
        model: User,
        as: 'student'
      }
    ]
  });
  const gradesByType = {
    deliverable: { group: [], individual: {} },
    report: { group: [], individual: {} },
    presentation: { group: [], individual: {} }
  };
  
  for (const grade of groupGrades) {
    const type = grade.criteria.evaluationType;
    gradesByType[type].group.push(grade);
  }
  
  for (const grade of individualGrades) {
    const type = grade.criteria.evaluationType;
    const studentId = grade.studentId;
    
    if (!gradesByType[type].individual[studentId]) {
      gradesByType[type].individual[studentId] = [];
    }
    
    gradesByType[type].individual[studentId].push(grade);
  }
  
  const finalGrades = {
    deliverable: { group: 0, individual: {} },
    report: { group: 0, individual: {} },
    presentation: { group: 0, individual: {} },
    overall: { group: 0, individual: {} }
  };
  
  for (const type in gradesByType) {
    if (gradesByType[type].group.length > 0) {
      const grades = gradesByType[type].group;
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      for (const grade of grades) {
        totalWeightedScore += grade.score * grade.criteria.weight;
        totalWeight += grade.criteria.weight;
      }
      
      finalGrades[type].group = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    }
  }
  
  for (const type in gradesByType) {
    for (const studentId in gradesByType[type].individual) {
      const grades = gradesByType[type].individual[studentId];
      
      if (grades.length > 0) {
        let totalWeightedScore = 0;
        let totalWeight = 0;
        
        for (const grade of grades) {
          totalWeightedScore += grade.score * grade.criteria.weight;
          totalWeight += grade.criteria.weight;
        }
        
        if (!finalGrades[type].individual[studentId]) {
          finalGrades[type].individual[studentId] = 0;
        }
        
        finalGrades[type].individual[studentId] = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
      }
    }
  }
  
  const weights = {
    deliverable: 0.4,
    report: 0.3,
    presentation: 0.3
  };
  
  let totalWeightedScore = 0;
  let totalWeight = 0;
  
  for (const type in weights) {
    if (finalGrades[type].group > 0) {
      totalWeightedScore += finalGrades[type].group * weights[type];
      totalWeight += weights[type];
    }
  }
  
  finalGrades.overall.group = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  
  for (const studentId of memberIds) {
    finalGrades.overall.individual[studentId] = 0;
    let studentTotalWeightedScore = 0;
    let studentTotalWeight = 0;
    
    for (const type in weights) {
      if (finalGrades[type].individual[studentId] > 0) {
        studentTotalWeightedScore += finalGrades[type].individual[studentId] * weights[type];
        studentTotalWeight += weights[type];
      } else if (finalGrades[type].group > 0) {
        studentTotalWeightedScore += finalGrades[type].group * weights[type];
        studentTotalWeight += weights[type];
      }
    }
    
    if (studentTotalWeight > 0) {
      finalGrades.overall.individual[studentId] = studentTotalWeightedScore / studentTotalWeight;
    }
  }
  
  return {
    group,
    finalGrades,
    detail: gradesByType
  };
};

const publishProjectGrades = async (projectId, teacherId) => {
  const project = await Project.findByPk(projectId);
  
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  if (project.teacherId !== teacherId) {
    throw new AppError('You are not authorized to publish grades for this project', 403);
  }
  
  const criteria = await EvaluationCriteria.findAll({
    where: { projectId }
  });
  
  const grades = await Grade.findAll({
    where: {
      criteriaId: criteria.map(c => c.id)
    },
    include: [
      {
        model: Group,
        as: 'group',
        include: [
          {
            model: User,
            as: 'members'
          }
        ]
      },
      {
        model: User,
        as: 'student'
      }
    ]
  });
  
  await Promise.all(grades.map(grade => grade.update({ isPublished: true })));
  
  const studentsToNotify = new Set();
  
  for (const grade of grades) {
    if (grade.group && grade.group.members) {
      for (const member of grade.group.members) {
        studentsToNotify.add(member);
      }
    } else if (grade.student) {
      studentsToNotify.add(grade.student);
    }
  }
  
  for (const student of studentsToNotify) {
    try {
      await emailService.sendGradePublishedNotification(student, project);
    } catch (error) {
      console.error(`Failed to send grade notification to ${student.email}:`, error);
    }
  }
  
  return {
    success: true,
    message: `Grades published for ${project.name}`,
    notificationsCount: studentsToNotify.size
  };
};

const getStudentProjectGrades = async (projectId, studentId) => {
  console.log('=== DÉBUT getStudentProjectGrades SERVICE ===');
  console.log('Project ID:', projectId);
  console.log('Student ID:', studentId);
  
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  const student = await User.findByPk(studentId, {
    attributes: ['id', 'firstName', 'lastName', 'email', 'promotionId']
  });
  
  if (!student) {
    throw new AppError('Student not found', 404);
  }
  
  if (student.promotionId !== project.promotionId) {
    throw new AppError('Student is not part of this project promotion', 403);
  }
  
  const studentGroup = await Group.findOne({
    where: { projectId },
    include: [
      {
        model: User,
        as: 'members',
        where: { id: studentId },
        attributes: ['id', 'firstName', 'lastName', 'email']
      }
    ]
  });
  
  console.log('Groupe trouvé pour l\'étudiant:', studentGroup ? studentGroup.id : 'Aucun');
  
  const criteria = await EvaluationCriteria.findAll({
    where: { projectId },
    order: [['evaluationType', 'ASC'], ['type', 'ASC'], ['name', 'ASC']]
  });
  
  const criteriaIds = criteria.map(c => c.id);
  console.log('Critères trouvés:', criteriaIds.length);
  
  const individualGrades = await Grade.findAll({
    where: {
      criteriaId: criteriaIds,
      studentId: studentId,
      isPublished: true
    },
    include: [
      {
        model: EvaluationCriteria,
        as: 'criteria'
      }
    ],
    order: [['updatedAt', 'DESC']]
  });
  
  console.log('Notes individuelles trouvées:', individualGrades.length);
  
  let groupGrades = [];
  if (studentGroup) {
    groupGrades = await Grade.findAll({
      where: {
        criteriaId: criteriaIds,
        groupId: studentGroup.id,
        isPublished: true
      },
      include: [
        {
          model: EvaluationCriteria,
          as: 'criteria'
        }
      ],
      order: [['updatedAt', 'DESC']]
    });
    
    console.log('Notes de groupe trouvées:', groupGrades.length);
  }
  
  const organizedGrades = {
    deliverable: { group: [], individual: [] },
    report: { group: [], individual: [] },
    presentation: { group: [], individual: [] }
  };
  
  for (const grade of individualGrades) {
    const evaluationType = grade.criteria.evaluationType;
    if (organizedGrades[evaluationType]) {
      organizedGrades[evaluationType].individual.push(grade);
    }
  }
  
  for (const grade of groupGrades) {
    const evaluationType = grade.criteria.evaluationType;
    if (organizedGrades[evaluationType]) {
      organizedGrades[evaluationType].group.push(grade);
    }
  }
  
  console.log('Notes organisées:', {
    deliverable: {
      group: organizedGrades.deliverable.group.length,
      individual: organizedGrades.deliverable.individual.length
    },
    report: {
      group: organizedGrades.report.group.length,
      individual: organizedGrades.report.individual.length
    },
    presentation: {
      group: organizedGrades.presentation.group.length,
      individual: organizedGrades.presentation.individual.length
    }
  });
  
  const result = {
    project: {
      id: project.id,
      name: project.name,
      description: project.description
    },
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      group: studentGroup ? {
        id: studentGroup.id,
        name: studentGroup.name,
        members: studentGroup.members.map(member => 
          `${member.firstName} ${member.lastName}`
        )
      } : null
    },
    grades: organizedGrades
  };
  
  console.log('=== FIN getStudentProjectGrades SERVICE ===');
  return result;
};

const getStudentEvaluationCriteria = async (projectId, studentId) => {
  console.log('=== DÉBUT getStudentEvaluationCriteria SERVICE ===');
  console.log('Project ID:', projectId);
  console.log('Student ID:', studentId);
  
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new AppError('Project not found', 404);
  }
  
  const student = await User.findByPk(studentId, {
    attributes: ['id', 'promotionId']
  });
  
  if (!student) {
    throw new AppError('Student not found', 404);
  }
  
  if (student.promotionId !== project.promotionId) {
    throw new AppError('Student is not part of this project promotion', 403);
  }
  
  const criteria = await EvaluationCriteria.findAll({
    where: { projectId },
    order: [['evaluationType', 'ASC'], ['type', 'ASC'], ['name', 'ASC']]
  });
  
  console.log('Critères trouvés pour l\'étudiant:', criteria.length);
  console.log('=== FIN getStudentEvaluationCriteria SERVICE ===');
  
  return criteria;
};

const getStudentGradeDetail = async (projectId, gradeId, studentId) => {
  console.log('=== DÉBUT getStudentGradeDetail SERVICE ===');
  console.log('Project ID:', projectId);
  console.log('Grade ID:', gradeId);
  console.log('Student ID:', studentId);
  
  const grade = await Grade.findOne({
    where: {
      id: gradeId,
      isPublished: true
    },
    include: [
      {
        model: EvaluationCriteria,
        as: 'criteria',
        where: { projectId },
        required: true
      },
      {
        model: User,
        as: 'student',
        attributes: ['id', 'firstName', 'lastName', 'email']
      },
      {
        model: Group,
        as: 'group',
        include: [
          {
            model: User,
            as: 'members',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      }
    ]
  });
  
  if (!grade) {
    throw new AppError('Grade not found or not published', 404);
  }
  
  let hasAccess = false;
  
  if (grade.studentId === studentId) {
    hasAccess = true;
  }
  
  if (grade.group && grade.group.members) {
    const memberIds = grade.group.members.map(member => member.id);
    if (memberIds.includes(studentId)) {
      hasAccess = true;
    }
  }
  
  if (!hasAccess) {
    throw new AppError('You do not have access to this grade', 403);
  }
  
  console.log('=== FIN getStudentGradeDetail SERVICE ===');
  return grade;
};

module.exports = {
  createEvaluationCriteria,
  getProjectEvaluationCriteria,
  updateEvaluationCriteria,
  deleteEvaluationCriteria,
  gradeGroupCriteria,
  gradeIndividualCriteria,
  getProjectGrades,
  calculateGroupFinalGrade,
  publishProjectGrades,
  getStudentProjectGrades,
  getStudentEvaluationCriteria,
  getStudentGradeDetail
};