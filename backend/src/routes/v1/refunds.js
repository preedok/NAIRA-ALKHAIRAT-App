const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES, OWNER_ROLES } = require('../../constants');
const refundController = require('../../controllers/refundController');

router.use(auth);

router.post('/', requireRole(ROLES.OWNER), refundController.createFromBalance);
router.get('/', requireRole(ROLES.OWNER, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI), refundController.list);
router.get('/stats', requireRole(ROLES.OWNER, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI), refundController.getStats);
router.get('/:id', requireRole(ROLES.OWNER, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING), refundController.getById);
router.patch('/:id', requireRole(ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING), refundController.updateStatus);
router.post('/:id/upload-proof', requireRole(ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING), refundController.uploadProof);
router.get('/:id/proof/file', requireRole(...OWNER_ROLES, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN, ROLES.ROLE_ACCOUNTING, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI), refundController.getProofFile);

module.exports = router;
