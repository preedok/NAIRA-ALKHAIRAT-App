const express = require('express');
const router = express.Router();
const ownerController = require('../../controllers/ownerController');
const { auth, requireRole, branchRestriction } = require('../../middleware/auth');
const { ROLES, OWNER_ROLES } = require('../../constants');
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

router.post('/register', uploadRegPaymentAtRegister.single('registration_payment_file'), ownerController.register);

router.use(auth);

router.get('/me', requireRole(...OWNER_ROLES), ownerController.getMyProfile);
router.get('/me/balance', requireRole(...OWNER_ROLES), ownerController.getMyBalance);
router.post('/upload-registration-payment', requireRole(...OWNER_ROLES), uploadRegPayment.single('file'), ownerController.uploadRegistrationPayment);
router.post('/upload-mou', requireRole(...OWNER_ROLES), upload.single('mou_file'), ownerController.uploadMou);

router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR, ROLES.ROLE_ACCOUNTING), ownerController.list);
router.get('/stats', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR, ROLES.ROLE_ACCOUNTING), ownerController.getStats);
router.get('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR, ROLES.ROLE_ACCOUNTING), ownerController.getById);
router.patch('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), ownerController.updateProfile);
router.patch('/:id/verify-mou', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), ownerController.verifyMou);
router.patch('/:id/verify-registration-payment', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), ownerController.verifyRegistrationPayment);
router.patch('/:id/verify-deposit', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), ownerController.verifyDeposit);
router.patch('/:id/assign-branch', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.INVOICE_KOORDINATOR), ownerController.assignBranch);
router.patch('/:id/activate', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.INVOICE_KOORDINATOR), ownerController.activate);

module.exports = router;
