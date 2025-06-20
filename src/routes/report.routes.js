const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);


router.get('/projects/:projectId/:reportId/navigation', reportController.getReportNavigation);
router.get('/projects/:projectId/:reportId/next', reportController.getNextReport);
router.get('/projects/:projectId/:reportId/previous', reportController.getPreviousReport);

router.post('/projects/:projectId/groups/:groupId', reportController.createReport);
router.get('/projects/:projectId/groups/:groupId', reportController.getGroupReport);
router.get('/projects/:projectId', reportController.getProjectReports);


router.put('/sections/:sectionId', reportController.updateReportSection);
router.delete('/sections/:sectionId', reportController.deleteReportSection);

router.get('/:reportId/sections', reportController.getReportSections);
router.post('/:reportId/sections', reportController.addReportSection);
router.put('/:reportId/sections/reorder', reportController.reorderReportSections);

router.get('/:id/preview', reportController.getReportPreview);

router.get('/:id', reportController.getReportById);
router.put('/:id', reportController.updateReport);

module.exports = router;