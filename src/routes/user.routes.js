const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { userValidationRules, validate } = require('../middlewares/validation.middleware');
const { verifyToken, isTeacher } = require('../middlewares/auth.middleware');

router.use(verifyToken);

//authentify users only
router.get('/me/projects', userController.getUserProjects);
router.put('/me/password', userController.changePassword);


router.use(isTeacher);
router.post('/', userValidationRules.create, validate, userController.createUser);
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userValidationRules.update, validate, userController.updateUser);
router.delete('/:id', userController.deactivateUser);
router.post('/:id/activate', userController.activateUser);
router.post('/:id/reset-password', userController.resetUserPassword);
router.get('/:id/grades', userController.getStudentGrades);

module.exports = router;