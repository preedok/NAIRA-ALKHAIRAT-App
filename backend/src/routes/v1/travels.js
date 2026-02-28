const express = require('express');
const router = express.Router();
const travelController = require('../../controllers/travelController');
const { auth, requireRole, branchRestriction } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const multer = require('multer');
const uploadConfig = require('../../config/uploads');

const mouDir = uploadConfig.getDir(uploadConfig.SUBDIRS.MOU);
const regPaymentDir = uploadConfig.getDir(uploadConfig.SUBDIRS.REGISTRATION_PAYMENT);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, mouDir),
  filename: (req, file, cb) => {
    const name = uploadConfig.mouFilename(req.user?.id, req.user?.company_name, file.originalname);
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
const regPaymentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, regPaymentDir),
  filename: (req, file, cb) => {
    const name = uploadConfig.registrationPaymentFilename(req.user?.id, file.originalname);
    cb(null, name);
  }
});
const uploadRegPayment = multer({ storage: regPaymentStorage, limits: { fileSize: 10 * 1024 * 1024 } });

const regPaymentAtRegisterStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, regPaymentDir),
  filename: (req, file, cb) => {
    const name = uploadConfig.registrationPaymentFilenameAtRegister(file.originalname);
    cb(null, name);
  }
});
const uploadRegPaymentAtRegister = multer({ storage: regPaymentAtRegisterStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/register', uploadRegPaymentAtRegister.single('registration_payment_file'), travelController.register);

router.use(auth);

router.get('/me', requireRole(ROLES.TRAVEL), travelController.getMyProfile);
router.get('/me/balance', requireRole(ROLES.TRAVEL), travelController.getMyBalance);
router.post('/upload-registration-payment', requireRole(ROLES.TRAVEL), uploadRegPayment.single('file'), travelController.uploadRegistrationPayment);
router.post('/upload-mou', requireRole(ROLES.TRAVEL), upload.single('mou_file'), travelController.uploadMou);

router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR, ROLES.ROLE_ACCOUNTING), travelController.list);
router.get('/stats', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR, ROLES.ROLE_ACCOUNTING), travelController.getStats);
router.get('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR, ROLES.ROLE_ACCOUNTING), travelController.getById);
router.patch('/:id/verify-mou', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), travelController.verifyMou);
router.patch('/:id/verify-registration-payment', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), travelController.verifyRegistrationPayment);
router.patch('/:id/verify-deposit', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR), travelController.verifyDeposit);
router.patch('/:id/assign-branch', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR), travelController.assignBranch);
router.patch('/:id/activate', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR), travelController.activate);

module.exports = router;
