const express = require('express');
const router = express.Router();
const invoiceController = require('../../controllers/invoiceController');
const paymentProofController = require('../../controllers/paymentProofController');
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES, OWNER_ROLES } = require('../../constants');

router.use(auth);

// Route statis harus sebelum /:id agar tidak tertangkap sebagai id (e.g. "draft-orders")
router.get('/summary', invoiceController.getSummary);
router.get('/reallocations', invoiceController.listReallocations);
router.get('/draft-orders', invoiceController.listDraftOrders);
router.get('/export-pdf', invoiceController.exportListPdf);
router.get('/', invoiceController.list);
router.post('/', requireRole(ROLES.USER, ROLES.ADMIN), invoiceController.create);
router.get('/:id/pdf', invoiceController.getPdf);
router.get('/:id/archive', invoiceController.getArchive);
router.get('/:id/status-history', invoiceController.getStatusHistory);
router.get('/:id/order-revisions', invoiceController.getOrderRevisions);
router.get('/:id/payment-proofs/:proofId/file', paymentProofController.getFile);
router.get('/:id/order-items/:orderItemId/ticket-file', invoiceController.getTicketFile);
router.get('/:id/order-items/:orderItemId/visa-file', invoiceController.getVisaFile);
router.get('/:id/order-items/:orderItemId/siskopatuh-file', invoiceController.getSiskopatuhFile);
router.get('/:id/order-items/:orderItemId/haji-dakhili-file', invoiceController.getHajiDakhiliFile);
router.get('/:id/order-items/:orderItemId/manifest-file', invoiceController.getManifestFile);
router.get('/:id', invoiceController.getById);
router.patch('/:id/unblock', requireRole(ROLES.ADMIN), invoiceController.unblock);
router.post('/:id/verify-payment', requireRole(ROLES.ADMIN), invoiceController.verifyPayment);
router.patch('/:id/overpaid', requireRole(ROLES.ADMIN), invoiceController.handleOverpaid);
router.post('/:id/allocate-balance', requireRole(ROLES.USER, ROLES.ADMIN), invoiceController.allocateBalance);
router.post('/:id/payment-proofs', paymentProofController.create);
router.delete('/:id/payment-proofs/:proofId', paymentProofController.destroyRejected);

module.exports = router;
