const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

//the route need an authentification (all of them even the others)
router.use(verifyToken);

router.get('/:id', reportController.getReportById);
router.put('/:id', reportController.updateReport);
router.post('/:id/sections', reportController.addReportSection);
router.put('/:id/sections/reorder', reportController.reorderReportSections);

router.put('/sections/:id', reportController.updateReportSection);
router.delete('/sections/:id', reportController.deleteReportSection);

module.exports = router;