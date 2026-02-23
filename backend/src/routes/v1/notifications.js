const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const notificationController = require('../../controllers/notificationController');

router.get('/', auth, notificationController.list);
router.get('/unread-count', auth, notificationController.unreadCount);
router.patch('/read-all', auth, notificationController.markAllRead);
router.patch('/:id/read', auth, notificationController.markRead);

module.exports = router;
