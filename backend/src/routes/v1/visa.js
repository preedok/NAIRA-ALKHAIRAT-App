const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const visaController = require('../../controllers/visaController');

router.use(auth);
router.use(requireRole(ROLES.VISA_KOORDINATOR));

router.get('/dashboard', visaController.getDashboard);
router.get('/export-excel', visaController.exportExcel);
router.get('/orders', visaController.listOrders);
router.get('/orders/:id', visaController.getOrder);
router.patch('/order-items/:orderItemId/progress', visaController.updateItemProgress);
router.post('/order-items/:orderItemId/upload-visa', visaController.uploadVisa);

module.exports = router;
