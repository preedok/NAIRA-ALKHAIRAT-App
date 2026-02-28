const express = require('express');
const router = express.Router();
const invoiceController = require('../../controllers/invoiceController');
const paymentProofController = require('../../controllers/paymentProofController');
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');

router.use(auth);

// Route statis harus sebelum /:id agar tidak tertangkap sebagai id (e.g. "draft-orders")
router.get('/summary', invoiceController.getSummary);
router.get('/reallocations', invoiceController.listReallocations);
router.get('/draft-orders', invoiceController.listDraftOrders);
router.get('/', invoiceController.list);
router.post('/', requireRole(ROLES.TRAVEL, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI, ROLES.SUPER_ADMIN), invoiceController.create);
router.post('/reallocate-payments', requireRole(ROLES.TRAVEL, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.SUPER_ADMIN), invoiceController.reallocatePayments);
router.get('/:id/pdf', invoiceController.getPdf);
router.get('/:id/payment-proofs/:proofId/file', paymentProofController.getFile);
router.get('/:id/releasable', invoiceController.getReleasable);
router.get('/:id', invoiceController.getById);
router.patch('/:id/unblock', requireRole(ROLES.INVOICE_KOORDINATOR, ROLES.ADMIN_KOORDINATOR, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN), invoiceController.unblock);
// Verifikasi hanya untuk karyawan (bukan owner/pembeli). invoice_koordinator + role_invoice_saudi + accounting + admin
router.post('/:id/verify-payment', requireRole(ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI, ROLES.ROLE_ACCOUNTING, ROLES.SUPER_ADMIN), invoiceController.verifyPayment);
router.patch('/:id/overpaid', requireRole(ROLES.INVOICE_KOORDINATOR, ROLES.ADMIN_KOORDINATOR, ROLES.SUPER_ADMIN), invoiceController.handleOverpaid);
router.post('/:id/allocate-balance', requireRole(ROLES.TRAVEL, ROLES.INVOICE_KOORDINATOR, ROLES.ROLE_INVOICE_SAUDI, ROLES.ADMIN_PUSAT, ROLES.SUPER_ADMIN), invoiceController.allocateBalance);
router.post('/:id/payment-proofs', paymentProofController.create);

module.exports = router;
