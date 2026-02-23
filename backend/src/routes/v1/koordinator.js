const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const koordinatorController = require('../../controllers/koordinatorController');

router.use(auth);
router.use(requireRole(ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR));

router.get('/dashboard', koordinatorController.getDashboard);

module.exports = router;
