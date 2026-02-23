const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const businessRuleController = require('../../controllers/businessRuleController');

router.use(auth);
router.get('/', businessRuleController.get);
router.put('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR), businessRuleController.set);

module.exports = router;
