const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const adminPusatController = require('../../controllers/adminPusatController');

router.get('/', (req, res) => {
  res.json({
    message: 'Bintang Global Group API v1',
    version: '1.0.0',
    docs: '/docs/MASTER_BUSINESS_PROCESS.md',
    endpoints: {
      auth: '/api/v1/auth (POST /login, GET /me)',
      owners: '/api/v1/owners (register, upload-mou, list, verify-mou, verify-deposit, assign-branch, activate)',
      branches: '/api/v1/branches',
      orders: '/api/v1/orders',
      invoices: '/api/v1/invoices'
    }
  });
});

router.get('/i18n/:locale', (req, res, next) => {
  const ctrl = require('../../controllers/superAdminController');
  ctrl.getI18n(req, res).catch(next);
});
router.use('/auth', require('./auth'));
router.use('/public', require('./public'));
router.use('/notifications', require('./notifications'));
router.use('/owners', require('./owners'));
router.use('/ai-chat', require('./aiChat'));
router.use('/branches', require('./branches'));
router.use('/orders', require('./orders'));
router.use('/invoices', require('./invoices'));
router.use('/refunds', require('./refunds'));
router.use('/products', require('./products'));
router.use('/business-rules', require('./businessRules'));
router.use('/hotel', require('./hotel'));
router.use('/ticket', require('./ticket'));
router.use('/visa', require('./visa'));
router.use('/bus', require('./bus'));
router.use('/maskapai', require('./maskapai'));
router.use('/handling', require('./handling'));
router.use('/koordinator', require('./koordinator'));
router.delete('/admin-pusat/users/:id', auth, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), adminPusatController.deleteUser);
router.use('/admin-pusat', require('./adminPusat'));
router.use('/accounting', require('./accounting'));
router.use('/reports', require('./reports'));
router.use('/super-admin', require('./superAdmin'));

module.exports = router;
