const evaluationService = require('../services/evaluation.service');
const { asyncHandler } = require('../middlewares/error.middleware');

const createEvaluationCriteria = asyncHandler(async (req, res) => {

  const { id: projectId } = req.params;
  const criteriaData = req.body;
  const teacherId = req.user.id;
  
  const criteria = await evaluationService.createEvaluationCriteria(projectId, criteriaData, teacherId);
  
  res.status(201).json({
    status: 'success',
    message: 'Evaluation criteria created successfully',
    data: criteria
  });
});

const getProjectEvaluationCriteria = asyncHandler(async (req, res) => {

  const { id: projectId } = req.params;
  
  const criteria = await evaluationService.getProjectEvaluationCriteria(projectId);
  
  res.status(200).json({
    status: 'success',
    data: criteria
  });
});

const updateEvaluationCriteria = asyncHandler(async (req, res) => {
 
  const { id } = req.params; 
  const updateData = req.body;
  const teacherId = req.user.id;
  
  const criteria = await evaluationService.updateEvaluationCriteria(id, updateData, teacherId);
  
  res.status(200).json({
    status: 'success',
    message: 'Evaluation criteria updated successfully',
    data: criteria
  });
});

const deleteEvaluationCriteria = asyncHandler(async (req, res) => {
  
  const { id } = req.params;
  const teacherId = req.user.id;
  
  const result = await evaluationService.deleteEvaluationCriteria(id, teacherId);
  
  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const gradeGroupCriteria = asyncHandler(async (req, res) => {
 
  const { criteriaId, groupId } = req.params;
  const gradeData = req.body;
  const teacherId = req.user.id;
  
  const grade = await evaluationService.gradeGroupCriteria(criteriaId, groupId, gradeData, teacherId);
  
  res.status(200).json({
    status: 'success',
    message: 'Group criteria graded successfully',
    data: grade
  });
});

const gradeIndividualCriteria = asyncHandler(async (req, res) => {
  
  const { criteriaId, studentId } = req.params;
  const gradeData = req.body;
  const teacherId = req.user.id;
  
  const grade = await evaluationService.gradeIndividualCriteria(criteriaId, studentId, gradeData, teacherId);
  
  res.status(200).json({
    status: 'success',
    message: 'Individual criteria graded successfully',
    data: grade
  });
});

const getProjectGrades = asyncHandler(async (req, res) => {
  
  const { id: projectId } = req.params;
  const teacherId = req.user.id;
  
  const grades = await evaluationService.getProjectGrades(projectId, teacherId);
  
  res.status(200).json({
    status: 'success',
    data: grades
  });
});

const calculateGroupFinalGrade = asyncHandler(async (req, res) => {

  const { id: projectId, groupId } = req.params;
  const teacherId = req.user.id;
  
  const result = await evaluationService.calculateGroupFinalGrade(projectId, groupId, teacherId);
  
  res.status(200).json({
    status: 'success',
    data: result
  });
});

const publishProjectGrades = asyncHandler(async (req, res) => {
 
  const { id: projectId } = req.params;
  const teacherId = req.user.id;
  
  const result = await evaluationService.publishProjectGrades(projectId, teacherId);
  
  res.status(200).json({
    status: 'success',
    message: result.message,
    data: result
  });
});

const getStudentProjectGrades = asyncHandler(async (req, res) => {
  console.log('=== DÉBUT getStudentProjectGrades CONTROLLER ===');
  
  const { id: projectId } = req.params;
  const studentId = req.user.id;
  
  console.log('Project ID:', projectId);
  console.log('Student ID:', studentId);
  console.log('User role:', req.user.role);
  
  if (req.user.role !== 'student') {
    return res.status(403).json({
      status: 'error',
      message: 'Only students can access their grades'
    });
  }
  
  const result = await evaluationService.getStudentProjectGrades(projectId, studentId);
  
  res.status(200).json({
    status: 'success',
    data: result
  });
  
  console.log('=== FIN getStudentProjectGrades CONTROLLER ===');
});


const getStudentEvaluationCriteria = asyncHandler(async (req, res) => {
  console.log('=== DÉBUT getStudentEvaluationCriteria CONTROLLER ===');
  
  const { id: projectId } = req.params;
  const studentId = req.user.id;
  
  console.log('Project ID:', projectId);
  console.log('Student ID:', studentId);
  
  if (req.user.role !== 'student') {
    return res.status(403).json({
      status: 'error',
      message: 'Only students can access evaluation criteria'
    });
  }
  
  const criteria = await evaluationService.getStudentEvaluationCriteria(projectId, studentId);
  
  res.status(200).json({
    status: 'success',
    data: criteria
  });
  
  console.log('=== FIN getStudentEvaluationCriteria CONTROLLER ===');
});


const getStudentGradeDetail = asyncHandler(async (req, res) => {
  console.log('=== DÉBUT getStudentGradeDetail CONTROLLER ===');
  
  const { id: projectId, gradeId } = req.params;
  const studentId = req.user.id;
  
  console.log('Project ID:', projectId);
  console.log('Grade ID:', gradeId);
  console.log('Student ID:', studentId);
  
  if (req.user.role !== 'student') {
    return res.status(403).json({
      status: 'error',
      message: 'Only students can access grade details'
    });
  }
  
  const grade = await evaluationService.getStudentGradeDetail(projectId, gradeId, studentId);
  
  res.status(200).json({
    status: 'success',
    data: grade
  });
  
  console.log('=== FIN getStudentGradeDetail CONTROLLER ===');
});

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