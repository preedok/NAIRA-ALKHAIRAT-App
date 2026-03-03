const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const handlingController = require('../../controllers/handlingController');

router.use(auth);
router.use(requireRole(ROLES.ROLE_HANDLING, ROLES.SUPER_ADMIN));

router.get('/dashboard', handlingController.getDashboard);
router.patch('/order-items/:orderItemId/progress', handlingController.updateOrderItemProgress);

module.exports = router;
