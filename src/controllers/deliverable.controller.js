const deliverableService = require('../services/deliverable.service');
const { asyncHandler } = require('../middlewares/error.middleware');  

const createDeliverable = asyncHandler(async (req, res) => {
 const { id } = req.params;
 const deliverableData = req.body;
 const teacherId = req.user.id;
 
 const deliverable = await deliverableService.createDeliverable(id, deliverableData, teacherId);
 
 res.status(201).json({
   status: 'success',
   message: 'Deliverable created successfully',
   data: deliverable
 });
});

const getDeliverableById = asyncHandler(async (req, res) => {
 const { id } = req.params;
 
 const deliverable = await deliverableService.getDeliverableById(id);
 
 res.status(200).json({
   status: 'success',
   data: deliverable
 });
});

const getProjectDeliverables = asyncHandler(async (req, res) => {
 const { id } = req.params;
 
 const deliverables = await deliverableService.getProjectDeliverables(id);
 
 res.status(200).json({
   status: 'success',
   data: deliverables
 });
});

const updateDeliverable = asyncHandler(async (req, res) => {
 const { id } = req.params;
 const updateData = req.body;
 const teacherId = req.user.id;
 
 const deliverable = await deliverableService.updateDeliverable(id, updateData, teacherId);
 
 res.status(200).json({
   status: 'success',
   message: 'Deliverable updated successfully',
   data: deliverable
 });
});

const deleteDeliverable = asyncHandler(async (req, res) => {
 const { id } = req.params;
 const teacherId = req.user.id;
 
 const result = await deliverableService.deleteDeliverable(id, teacherId);
 
 res.status(200).json({
   status: 'success',
   message: result.message
 });
});

const submitDeliverable = asyncHandler(async (req, res) => {
 const { id } = req.params;
 const submissionData = req.body;
 const { groupId } = req.body;
 let filePath = null;
 
 if (req.file) {
   filePath = req.file.path;
 }
 
 const submission = await deliverableService.submitDeliverable(id, submissionData, groupId, filePath);
 
 res.status(200).json({
   status: 'success',
   message: 'Deliverable submitted successfully',
   data: submission
 });
});

const analyzeSimilarity = asyncHandler(async (req, res) => {
 const { id } = req.params;
 
 const result = await deliverableService.analyzeSimilarity(id);
 
 res.status(200).json({
   status: 'success',
   data: result
 });
});

const getDeliverableSummary = asyncHandler(async (req, res) => {
 const { id } = req.params;
 const teacherId = req.user.id;
 
 const summary = await deliverableService.getDeliverableSummary(id, teacherId);
 
 res.status(200).json({
   status: 'success',
   data: summary
 });
});

const sendDeadlineReminders = asyncHandler(async (req, res) => {
 const result = await deliverableService.sendDeadlineReminders();
 
 res.status(200).json({
   status: 'success',
   message: `${result.count} reminders sent`,
   data: result
 });
});

module.exports = {
 createDeliverable,
 getDeliverableById,
 getProjectDeliverables,
 updateDeliverable,
 deleteDeliverable,
 submitDeliverable,
 analyzeSimilarity,
 getDeliverableSummary,
 sendDeadlineReminders
};