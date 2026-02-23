const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const busController = require('../../controllers/busController');

router.use(auth);
router.use(requireRole(ROLES.ROLE_BUS));

router.get('/dashboard', busController.getDashboard);
router.get('/export-excel', busController.exportExcel);
router.get('/export-pdf', busController.exportPdf);
router.get('/orders', busController.listOrders);
router.get('/orders/:id', busController.getOrder);
router.get('/products', busController.listProducts);
router.patch('/order-items/:orderItemId/progress', busController.updateItemProgress);

module.exports = router;
