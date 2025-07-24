const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotion.controller');
const { promotionValidationRules, validate } = require('../middlewares/validation.middleware');
const { verifyToken, isTeacher } = require('../middlewares/auth.middleware');
const { upload, handleMulterErrors } = require('../middlewares/upload.middleware');


router.use(verifyToken);
router.get('/', promotionController.getAllPromotions);
router.get('/my-promotion', promotionController.getMyPromotion);
router.get('/:id', promotionController.getPromotionById);
router.use(isTeacher);
router.post('/', promotionValidationRules.create, validate, promotionController.createPromotion);
router.put('/:id', promotionValidationRules.update, validate, promotionController.updatePromotion);
router.delete('/:id', promotionController.deletePromotion);
router.post('/:id/students', promotionController.addStudentToPromotion);
router.post('/:id/students/import', upload.single('file'), handleMulterErrors, promotionController.importStudentsToPromotion);
router.delete('/:id/students/:studentId', promotionController.removeStudentFromPromotion);
router.get('/:id/students', promotionController.getPromotionStudents);
router.put('/:id/students/:studentId', promotionController.updateStudentInPromotion);

module.exports = router;