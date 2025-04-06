const promotionService = require('../services/promotion.service');
const userService = require('../services/user.service');
const { asyncHandler } = require('../middlewares/error.middleware');

const createPromotion = asyncHandler(async (req, res) => {
  const promotionData = req.body;
  
  const promotion = await promotionService.createPromotion(promotionData);
  
  res.status(201).json({
    status: 'success',
    message: 'Promotion created successfully',
    data: promotion
  });
});

const getPromotionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const promotion = await promotionService.getPromotionById(id);
  
  res.status(200).json({
    status: 'success',
    data: promotion
  });
});

const getAllPromotions = asyncHandler(async (req, res) => {
  const filters = {
    year: req.query.year,
    search: req.query.search,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10
  };
  
  const result = await promotionService.getAllPromotions(filters);
  
  res.status(200).json({
    status: 'success',
    data: result
  });
});

const updatePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  
  const promotion = await promotionService.updatePromotion(id, updateData);
  
  res.status(200).json({
    status: 'success',
    message: 'Promotion updated successfully',
    data: promotion
  });
});

const deletePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await promotionService.deletePromotion(id);
  
  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const addStudentToPromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userData = req.body;
  
  userData.role = 'student';
  userData.promotionId = id;
  
  const student = await promotionService.addStudentToPromotion(id, userData);
  
  res.status(201).json({
    status: 'success',
    message: 'Student added to promotion successfully',
    data: student
  });
});

const importStudentsToPromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { file } = req;
  
  if (!file) {
    return res.status(400).json({
      status: 'error',
      message: 'No file uploaded'
    });
  }
  
  const fileType = file.originalname.endsWith('.csv') ? 'csv' : 
                  file.originalname.endsWith('.json') ? 'json' : null;
  
  if (!fileType) {
    return res.status(400).json({
      status: 'error',
      message: 'Unsupported file format. Please upload CSV or JSON file'
    });
  }
  
  const parsedStudents = await userService.parseImportFile(file, fileType);
  
  const result = await promotionService.addStudentsToPromotionFromFile(id, parsedStudents);
  
  res.status(200).json({
    status: 'success',
    message: `${result.created.length} students created, ${result.updated.length} students updated, ${result.failed.length} students failed`,
    data: result
  });
});

const removeStudentFromPromotion = asyncHandler(async (req, res) => {
  const { id, studentId } = req.params;
  
  const result = await promotionService.removeStudentFromPromotion(id, studentId);
  
  res.status(200).json({
    status: 'success',
    message: result.message
  });
});

const getPromotionStudents = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const filters = {
    search: req.query.search,
    isActive: req.query.isActive === 'true',
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10
  };
  
  const result = await promotionService.getPromotionStudents(id, filters);
  
  res.status(200).json({
    status: 'success',
    data: result
  });
});

module.exports = {
  createPromotion,
  getPromotionById,
  getAllPromotions,
  updatePromotion,
  deletePromotion,
  addStudentToPromotion,
  importStudentsToPromotion,
  removeStudentFromPromotion,
  getPromotionStudents
};