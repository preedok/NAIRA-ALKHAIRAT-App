const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const hotelController = require('../../controllers/hotelController');

router.use(auth);
router.use(requireRole(ROLES.ROLE_HOTEL));

router.get('/dashboard', hotelController.getDashboard);
router.get('/products', hotelController.listProducts);
router.get('/orders', hotelController.listOrders);
router.get('/orders/:id', hotelController.getOrder);
router.patch('/order-items/:orderItemId/progress', hotelController.updateItemProgress);

module.exports = router;
