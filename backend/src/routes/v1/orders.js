const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/orderController');
const { auth, requireRole, branchRestriction } = require('../../middleware/auth');
const { ROLES } = require('../../constants');

router.use(auth);

router.get('/', orderController.list);
router.post('/', requireRole(ROLES.USER, ROLES.ADMIN), orderController.create);
router.post('/:orderId/items/:itemId/jamaah-data', requireRole(ROLES.USER, ROLES.ADMIN), orderController.uploadJamaahData);
router.get('/:orderId/items/:itemId/jamaah-file', orderController.getJamaahFile);
router.post('/:id/cancellation-requests', requireRole(ROLES.USER), orderController.createOrderCancellationRequest);
router.get('/:id', orderController.getById);
router.patch('/:id', requireRole(ROLES.USER, ROLES.ADMIN), orderController.update);
router.delete('/:id', requireRole(ROLES.USER, ROLES.ADMIN), orderController.destroy);
router.post('/:id/send-result', requireRole(ROLES.ADMIN), orderController.sendOrderResult);

module.exports = router;
