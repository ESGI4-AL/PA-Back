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

const getReportSections = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { sectionIds } = req.query;
  const userId = req.user.id;
  
  const parsedSectionIds = sectionIds ? sectionIds.split(',').map(id => id.trim()) : null;
  
  const result = await reportService.getReportSections(reportId, parsedSectionIds, userId);
  
  res.status(200).json({
    status: 'success',
    data: result
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
  const { sectionId } = req.params;
  const updateData = req.body;
  const userId = req.user.id;
  
  console.log(' === CONTROLLER updateReportSection ===');
  console.log(' sectionId reçu:', sectionId);
  console.log(' updateData:', updateData);
  console.log(' userId:', userId);
  
  const section = await reportService.updateReportSection(sectionId, updateData, userId);
  
  res.status(200).json({
    status: 'success',
    message: 'Report section updated successfully',
    data: section
  });
});

const deleteReportSection = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;
  const userId = req.user.id;
  
  console.log('CONTROLLER deleteReportSection');
  console.log('sectionId reçu:', sectionId);
  console.log('userId:', userId);
  console.log('req.params complet:', req.params);
  
  const result = await reportService.deleteReportSection(sectionId, userId);
  
  res.status(200).json({
    status: 'success',
    message: result.message || 'Report section deleted successfully'
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

const getReportNavigation = asyncHandler(async (req, res) => {
  const { projectId, reportId } = req.params;
  const userId = req.user.id;
  
  const navigation = await reportService.getReportNavigation(projectId, reportId, userId);
  
  res.status(200).json({
    status: 'success',
    data: navigation
  });
});

const getNextReport = asyncHandler(async (req, res) => {
  const { projectId, reportId } = req.params;
  const userId = req.user.id;
  
  const nextReport = await reportService.getNextReport(reportId, projectId, userId);
  
  res.status(200).json({
    status: 'success',
    message: 'Next report retrieved successfully',
    data: nextReport
  });
});

const getPreviousReport = asyncHandler(async (req, res) => {
  const { projectId, reportId } = req.params;
  const userId = req.user.id;
  
  const previousReport = await reportService.getPreviousReport(reportId, projectId, userId);
  
  res.status(200).json({
    status: 'success',
    message: 'Previous report retrieved successfully',
    data: previousReport
  });
});

const getReportPreview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    sectionsOnly = 'false', 
    sectionIds, 
    includeMetadata = 'true' 
  } = req.query;
  
  const options = {
    sectionsOnly: sectionsOnly === 'true',
    includeMetadata: includeMetadata === 'true'
  };
  
  if (sectionIds) {
    options.sectionIds = sectionIds.split(',').map(id => id.trim());
  }
  
  const preview = await reportService.getReportPreview(id, options);
  
  res.status(200).json({
    status: 'success',
    data: preview
  });
});

const uploadReport = asyncHandler(async (req, res) => {
  const { id: projectId, groupId } = req.params;

  if (!req.file || !req.file.firebaseUrl) {
    return res.status(400).json({ message: 'Aucun fichier PDF reçu.' });
  }

  const fileUrl = req.file.firebaseUrl;

  await Group.update({ reportUrl: fileUrl }, { where: { id: groupId } });

  res.status(200).json({
    status: 'success',
    message: 'Rapport envoyé avec succès.',
    data: { url: fileUrl }
  });
});

module.exports = {
  createReport,
  getReportById,
  getReportSections,
  getGroupReport,
  updateReport,
  addReportSection,
  updateReportSection,
  deleteReportSection,
  reorderReportSections,
  getProjectReports,
  getReportNavigation,
  getNextReport,
  getPreviousReport,
  getReportPreview,
  uploadReport
};