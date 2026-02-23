const express = require('express');
const router = express.Router();
const invoiceController = require('../../controllers/invoiceController');
const paymentProofController = require('../../controllers/paymentProofController');
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');

router.use(auth);

router.get('/', invoiceController.list);
router.get('/summary', invoiceController.getSummary);
router.post('/', requireRole(ROLES.OWNER, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI, ROLES.SUPER_ADMIN), invoiceController.create);
router.get('/:id/pdf', invoiceController.getPdf);
router.get('/:id/payment-proofs/:proofId/file', paymentProofController.getFile);
router.get('/:id', invoiceController.getById);
router.patch('/:id/unblock', requireRole(ROLES.INVOICE_KOORDINATOR, ROLES.ADMIN_KOORDINATOR, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN), invoiceController.unblock);
// Verifikasi hanya untuk karyawan (bukan owner/pembeli). role_invoice + 'invoice' + accounting + admin
router.post('/:id/verify-payment', requireRole(ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI, ROLES.ROLE_INVOICE, 'invoice', ROLES.ROLE_ACCOUNTING, ROLES.SUPER_ADMIN), invoiceController.verifyPayment);
router.patch('/:id/overpaid', requireRole(ROLES.INVOICE_KOORDINATOR, ROLES.ADMIN_KOORDINATOR, ROLES.SUPER_ADMIN), invoiceController.handleOverpaid);
router.post('/:id/payment-proofs', paymentProofController.create);

module.exports = router;
