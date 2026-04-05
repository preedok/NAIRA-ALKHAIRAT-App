const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/orderController');
const { auth, requireRole, branchRestriction } = require('../../middleware/auth');
const { ROLES, OWNER_ROLES } = require('../../constants');

router.use(auth);

router.get('/', orderController.list);
router.post('/', requireRole(...OWNER_ROLES, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI), orderController.create);
router.post('/:orderId/items/:itemId/jamaah-data', requireRole(...OWNER_ROLES, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI, ROLES.ROLE_SISKOPATUH, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN), orderController.uploadJamaahData);
router.get('/:orderId/items/:itemId/jamaah-file', orderController.getJamaahFile);
router.post('/:id/cancellation-requests', requireRole(...OWNER_ROLES), orderController.createOrderCancellationRequest);
router.get('/:id', orderController.getById);
router.patch('/:id', requireRole(...OWNER_ROLES, ROLES.INVOICE_KOORDINATOR), orderController.update);
router.delete('/:id', requireRole(...OWNER_ROLES, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN), orderController.destroy);
router.post('/:id/send-result', requireRole(ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR), orderController.sendOrderResult);

module.exports = router;
