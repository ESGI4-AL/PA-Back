const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group.controller');
const { verifyToken, isTeacher } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/project/:projectId/user-group', groupController.getUserGroupForProject);


router.get('/:id', groupController.getGroupById);
router.delete('/:id', isTeacher, groupController.deleteGroup);
router.post('/:id/members/:memberId', groupController.addMemberToGroup);
router.delete('/:id/members/:memberId', groupController.removeMemberFromGroup);
router.get('/:groupId/project', groupController.getGroupProject);
router.put('/:id', isTeacher, groupController.updateGroup);

module.exports = router;