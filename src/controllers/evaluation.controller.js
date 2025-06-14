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

module.exports = {
  createEvaluationCriteria,
  getProjectEvaluationCriteria,
  updateEvaluationCriteria,
  deleteEvaluationCriteria,
  gradeGroupCriteria,
  gradeIndividualCriteria,
  getProjectGrades,
  calculateGroupFinalGrade,
  publishProjectGrades
};