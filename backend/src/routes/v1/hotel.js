const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const hotelController = require('../../controllers/hotelController');

router.use(auth);
router.use(requireRole(ROLES.ROLE_HOTEL, ROLES.SUPER_ADMIN));

router.get('/dashboard', hotelController.getDashboard);
router.get('/invoices', hotelController.listInvoices);
router.get('/invoices/:id', hotelController.getInvoice);
router.get('/products', hotelController.listProducts);
router.get('/orders', hotelController.listOrders);
router.get('/orders/:id', hotelController.getOrder);
router.get('/invoices/:id/order-items/:orderItemId/slip', hotelController.getOrderItemSlip);
router.patch('/order-items/:orderItemId/progress', hotelController.updateItemProgress);

module.exports = router;
