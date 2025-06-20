const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const groupController = require('../controllers/group.controller');
const deliverableController = require('../controllers/deliverable.controller');
const reportController = require('../controllers/report.controller');
const presentationController = require('../controllers/presentation.controller');
const evaluationController = require('../controllers/evaluation.controller');
const { projectValidationRules, validate } = require('../middlewares/validation.middleware');
const { verifyToken, isTeacher } = require('../middlewares/auth.middleware');
const uploadFirebase = require('../middlewares/uploadFirebase');

router.use(verifyToken);

router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);

//handle group
router.get('/:id/groups', groupController.getProjectGroups);
router.post('/:id/groups/student', groupController.createGroupByStudent);
router.get('/promotions/:promotionId/students', groupController.getPromotionStudents);


//for livrable
router.get('/:id/deliverables', deliverableController.getProjectDeliverables);

//for report
router.get('/:id/groups/:groupId/report', reportController.getGroupReport);

//for soutenance - lectures publiques
router.get('/:id/presentations', presentationController.getProjectPresentationSchedule);

//teacher only, handle project
router.use(isTeacher);

// Routes de projet
router.post('/', projectValidationRules.create, validate, projectController.createProject);
router.put('/:id', projectValidationRules.update, validate, projectController.updateProject);
router.delete('/:id', projectController.deleteProject);
router.patch('/:id/status', projectController.updateProjectStatus);
router.patch('/:id/group-formation', projectController.configureGroupFormation);
router.post('/:id/groups/random', projectController.generateRandomGroups);
router.post('/:id/groups/assign-remaining', groupController.assignRemainingStudents);
router.post('/:id/groups', groupController.createGroup);

// Routes de livrables
router.post('/:id/deliverables', deliverableController.createDeliverable);
router.post('/:id/deliverables/:deliverableId/analyze', deliverableController.analyzeSimilarity);
router.get('/:id/deliverables/:deliverableId/summary', deliverableController.getDeliverableSummary);
router.put('/:id/deliverables/:deliverableId', projectController.updateDeliverable);

// Routes de rapports
router.post('/:id/groups/:groupId/report', reportController.createReport);
router.get('/:id/reports', reportController.getProjectReports);
router.get('/:id/groups/:groupId/report', reportController.getGroupReport);
router.post('/:id/groups/:groupId/report/upload', uploadFirebase, reportController.uploadReport);

//Routes de soutenances - teacher only
router.post('/:id/presentations', presentationController.createPresentationSchedule);
router.put('/:id/presentations/reorder', presentationController.reorderPresentationSchedule);
router.delete('/:id/presentations', presentationController.deletePresentationSchedule); // ✅ Déplacé ici
router.get('/:id/presentations/pdf', presentationController.generateSchedulePDF);
router.get('/:id/presentations/attendance-sheet', presentationController.generateAttendanceSheetPDF);
router.put('/:id/presentations', presentationController.updatePresentationSchedule);

//Routes d'évaluation
router.post('/:id/evaluation-criteria', evaluationController.createEvaluationCriteria);
router.get('/:id/evaluation-criteria', evaluationController.getProjectEvaluationCriteria);
router.get('/:id/grades', evaluationController.getProjectGrades);
router.post('/:id/publish-grades', evaluationController.publishProjectGrades);
router.get('/:id/groups/:groupId/final-grade', evaluationController.calculateGroupFinalGrade);

module.exports = router;