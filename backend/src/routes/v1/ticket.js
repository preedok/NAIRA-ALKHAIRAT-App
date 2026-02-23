const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const ticketController = require('../../controllers/ticketController');

router.use(auth);
router.use(requireRole(ROLES.TIKET_KOORDINATOR));

router.get('/dashboard', ticketController.getDashboard);
router.get('/export-excel', ticketController.exportExcel);
router.get('/orders', ticketController.listOrders);
router.get('/orders/:id', ticketController.getOrder);
router.patch('/order-items/:orderItemId/progress', ticketController.updateItemProgress);
router.post('/order-items/:orderItemId/upload-ticket', ticketController.uploadTicket);

module.exports = router;
