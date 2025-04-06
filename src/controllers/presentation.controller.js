const presentationService = require('../services/presentation.service');
const { asyncHandler } = require('../middlewares/error.middleware');

const createPresentationSchedule = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const scheduleData = req.body;
  const teacherId = req.user.id;
  
  const schedule = await presentationService.createPresentationSchedule(projectId, scheduleData, teacherId);
  
  res.status(201).json({
    status: 'success',
    message: 'Presentation schedule created successfully',
    data: schedule
  });
});

const reorderPresentationSchedule = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { groupOrder } = req.body;
  const teacherId = req.user.id;
  
  const schedules = await presentationService.reorderPresentationSchedule(projectId, groupOrder, teacherId);
  
  res.status(200).json({
    status: 'success',
    message: 'Presentation schedule reordered successfully',
    data: schedules
  });
});

const getProjectPresentationSchedule = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  
  const schedules = await presentationService.getProjectPresentationSchedule(projectId);
  
  res.status(200).json({
    status: 'success',
    data: schedules
  });
});

const generateSchedulePDF = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const teacherId = req.user.id;
  
  const result = await presentationService.generateSchedulePDF(projectId, teacherId);
  
  res.status(200).json({
    status: 'success',
    message: 'Schedule PDF generated successfully',
    data: {
      fileUrl: `${req.protocol}://${req.get('host')}/${result.filePath}`,
      fileName: result.fileName
    }
  });
});

const generateAttendanceSheetPDF = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { sortBy } = req.query;
  const teacherId = req.user.id;
  
  const result = await presentationService.generateAttendanceSheetPDF(projectId, teacherId, sortBy);
  
  res.status(200).json({
    status: 'success',
    message: 'Attendance sheet PDF generated successfully',
    data: {
      fileUrl: `${req.protocol}://${req.get('host')}/${result.filePath}`,
      fileName: result.fileName
    }
  });
});

module.exports = {
  createPresentationSchedule,
  reorderPresentationSchedule,
  getProjectPresentationSchedule,
  generateSchedulePDF,
  generateAttendanceSheetPDF
};