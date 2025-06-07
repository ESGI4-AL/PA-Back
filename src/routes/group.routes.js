const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/:id', groupController.getGroupById);
router.post('/:id/members/:memberId', groupController.addMemberToGroup);
router.delete('/:id/members/:memberId', groupController.removeMemberFromGroup);

router.get('/:groupId/project', groupController.getGroupProject);

module.exports = router;