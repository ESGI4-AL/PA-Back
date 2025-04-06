const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { userValidationRules, validate } = require('../middlewares/validation.middleware');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/register/teacher', userValidationRules.create, validate, authController.registerTeacher);
router.post('/login', userValidationRules.login, validate, authController.login);
router.post('/google', authController.googleLogin);
router.post('/microsoft', authController.microsoftLogin);
router.get('/me', verifyToken, authController.getCurrentUser);

module.exports = router;