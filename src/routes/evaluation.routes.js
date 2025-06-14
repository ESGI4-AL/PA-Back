const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluation.controller');
const { verifyToken, isTeacher } = require('../middlewares/auth.middleware');

router.use(verifyToken);
router.use(isTeacher);


router.put('/criteria/:id', evaluationController.updateEvaluationCriteria);
router.delete('/criteria/:id', evaluationController.deleteEvaluationCriteria);

router.post('/criteria/:criteriaId/group/:groupId', evaluationController.gradeGroupCriteria);
router.post('/criteria/:criteriaId/student/:studentId', evaluationController.gradeIndividualCriteria);

module.exports = router;