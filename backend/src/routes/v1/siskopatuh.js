const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const siskopatuhController = require('../../controllers/siskopatuhController');

router.use(auth);
router.use(requireRole(ROLES.ROLE_SISKOPATUH, ROLES.SUPER_ADMIN));

router.get('/dashboard', siskopatuhController.getDashboard);
router.get('/invoices', siskopatuhController.listInvoices);
router.get('/invoices/:id', siskopatuhController.getInvoice);
router.post('/order-items/:orderItemId/siskopatuh-document', siskopatuhController.uploadSiskopatuhDocument);
router.patch('/order-items/:orderItemId/progress', siskopatuhController.updateOrderItemProgress);

module.exports = router;
