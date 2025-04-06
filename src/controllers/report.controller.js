const reportService = require('../services/report.service');
const { asyncHandler } = require('../middlewares/error.middleware');

const createReport = asyncHandler(async (req, res) => {
  const { projectId, groupId } = req.params;
  const reportData = req.body;
  
  const report = await reportService.createReport(projectId, groupId, reportData);
  
  res.status(201).json({
    status: 'success',
    message: 'Report created successfully',
    data: report
  });
});

const getReportById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const report = await reportService.getReportById(id);
  
  res.status(200).json({
    status: 'success',
    data: report
  });
});

const getGroupReport = asyncHandler(async (req, res) => {
  const { projectId, groupId } = req.params;
  
  const report = await reportService.getGroupReport(projectId, groupId);
  
  res.status(200).json({
    status: 'success',
    data: report
  });
});

const updateReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userId = req.user.id;
  
  const report = await reportService.updateReport(id, updateData, userId);
  
  res.status(200).json({
    status: 'success',
    message: 'Report updated successfully',
    data: report
  });
});

const addReportSection = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const sectionData = req.body;
  const userId = req.user.id;
  
  const section = await reportService.addReportSection(reportId, sectionData, userId);
  
  res.status(201).json({
    status: 'success',
    message: 'Report section added successfully',
    data: section
  });
});

const updateReportSection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userId = req.user.id;
  
  const section = await reportService.updateReportSection(id, updateData, userId);
  
  res.status(200).json({
    status: 'success',
    message: 'Report section updated successfully',
    data: section
  });
});

const deleteReportSection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const result = await reportService.deleteReportSection(id, userId);
  
  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const reorderReportSections = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { sectionOrder } = req.body;
  const userId = req.user.id;
  
  const report = await reportService.reorderReportSections(reportId, sectionOrder, userId);
  
  res.status(200).json({
    status: 'success',
    message: 'Report sections reordered successfully',
    data: report
  });
});

const getProjectReports = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const teacherId = req.user.id;
  
  const reports = await reportService.getProjectReports(projectId, teacherId);
  
  res.status(200).json({
    status: 'success',
    data: reports
  });
});

module.exports = {
  createReport,
  getReportById,
  getGroupReport,
  updateReport,
  addReportSection,
  updateReportSection,
  deleteReportSection,
  reorderReportSections,
  getProjectReports
};