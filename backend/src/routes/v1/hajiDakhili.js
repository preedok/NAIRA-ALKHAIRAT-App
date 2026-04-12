const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const hajiDakhiliController = require('../../controllers/hajiDakhiliController');

router.use(auth);
router.use(requireRole(ROLES.ROLE_HAJI_DAKHILI, ROLES.SUPER_ADMIN));

router.get('/dashboard', hajiDakhiliController.getDashboard);
router.get('/invoices', hajiDakhiliController.listInvoices);
router.get('/invoices/:id', hajiDakhiliController.getInvoice);
router.post('/order-items/:orderItemId/haji-dakhili-document', hajiDakhiliController.uploadHajiDakhiliDocument);
router.patch('/order-items/:orderItemId/progress', hajiDakhiliController.updateOrderItemProgress);

module.exports = router;
