const promotionService = require('../services/promotion.service');
const userService = require('../services/user.service');
const { asyncHandler } = require('../middlewares/error.middleware');
const logger = require('../utils/logger');

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

const getMyPromotion = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await promotionService.getMyPromotion(userId);

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

  if (!req.file) {
    logger.warn(`Aucun fichier reçu pour la promotion ${id}`);
    return res.status(400).json({
      status: 'error',
      message: 'Aucun fichier reçu'
    });
  }

  const { file } = req;

  logger.info(`Import lancé pour promo ${id}`);
  logger.info(`Fichier reçu : ${file.originalname}`);

  const fileType = file.originalname.endsWith('.csv') ? 'csv' :
                   file.originalname.endsWith('.json') ? 'json' : null;

  if (!fileType) {
    logger.warn(`Format non supporté : ${file.originalname}`);
    return res.status(400).json({
      status: 'error',
      message: 'Format de fichier non supporté. Utilisez un fichier CSV ou JSON.'
    });
  }

  try {
    logger.info(`📥 Parsing du fichier en cours... (type : ${fileType})`);
    const parsedStudents = await userService.parseImportFile(file, fileType);
    logger.info(`✅ Parsing terminé. Étudiants extraits : ${parsedStudents.length}`);
    logger.debug(`📦 Contenu extrait : ${JSON.stringify(parsedStudents, null, 2)}`);

    logger.info(`📤 Ajout des étudiants à la promotion ${id}...`);
    const result = await promotionService.addStudentsToPromotionFromFile(id, parsedStudents);

    logger.info(`✅ Import terminé : ${result.created.length} créés, ${result.updated.length} mis à jour, ${result.failed.length} échoués`);

    res.status(200).json({
      status: 'success',
      message: `${result.created.length} students created, ${result.updated.length} updated, ${result.failed.length} failed`,
      data: result
    });

  } catch (err) {
    logger.error(`❌ Erreur lors de l'import : ${err.message}`, err);
    res.status(500).json({
      status: 'error',
      message: 'Erreur lors de l’import des étudiants'
    });
  }
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

const updateStudentInPromotion = asyncHandler(async (req, res) => {
  const { id, studentId } = req.params;
  const updateData = req.body;

  const updatedStudent = await promotionService.updateStudentInPromotion(id, studentId, updateData);

  res.status(200).json({
    status: 'success',
    message: 'Student updated successfully',
    data: updatedStudent
  });
});

module.exports = {
  createPromotion,
  getPromotionById,
  getAllPromotions,
  getMyPromotion,
  updatePromotion,
  deletePromotion,
  addStudentToPromotion,
  importStudentsToPromotion,
  removeStudentFromPromotion,
  getPromotionStudents,
  updateStudentInPromotion
};