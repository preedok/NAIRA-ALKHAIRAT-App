const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { OWNER_ROLES } = require('../../constants');
const aiChatController = require('../../controllers/aiChatController');

router.use(auth);
router.use(requireRole(...OWNER_ROLES));

router.get('/context', aiChatController.getContext);
router.post('/', aiChatController.chat);

module.exports = router;
