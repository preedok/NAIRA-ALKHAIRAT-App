const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES, OWNER_ROLES } = require('../../constants');
const refundController = require('../../controllers/refundController');

router.use(auth);

router.post('/', requireRole(...OWNER_ROLES), refundController.createFromBalance);
router.get('/', requireRole(...OWNER_ROLES, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI), refundController.list);
router.get('/stats', requireRole(...OWNER_ROLES, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI), refundController.getStats);
router.get('/:id', requireRole(...OWNER_ROLES, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING), refundController.getById);
router.patch('/:id', requireRole(ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING), refundController.updateStatus);
router.post('/:id/sync-balance-debit', requireRole(ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING), refundController.syncBalanceDebit);
router.post('/:id/complete-payout', requireRole(ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING), refundController.completePayout);
router.post('/:id/upload-proof', requireRole(ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING), refundController.uploadProof);
router.get('/:id/proof/file', requireRole(...OWNER_ROLES, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI), refundController.getProofFile);

module.exports = router;
