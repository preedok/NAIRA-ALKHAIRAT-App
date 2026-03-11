const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const businessRuleController = require('../../controllers/businessRuleController');

router.get('/public', businessRuleController.getPublic);
router.use(auth);
router.get('/', businessRuleController.get);
router.put('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING), businessRuleController.set);

module.exports = router;
