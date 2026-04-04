const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/orderController');
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');

router.use(auth);
router.get('/', requireRole(ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN), orderController.listOrderCancellationRequests);
router.patch('/:id', requireRole(ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN), orderController.reviewOrderCancellationRequest);

module.exports = router;
