const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');

router.get('/', (req, res) => {
  res.json({
    message: 'Bintang Global Group API v1',
    version: '1.0.0',
    docs: '/docs/MASTER_BUSINESS_PROCESS.md',
    endpoints: {
      auth: '/api/v1/auth (register, otp, login, me)',
      jamaah_profiles: '/api/v1/jamaah-profiles',
      products: '/api/v1/products',
      orders: '/api/v1/orders',
      invoices: '/api/v1/invoices',
      installments: '/api/v1/installments',
      kloters: '/api/v1/kloters',
      flyers: '/api/v1/flyers'
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
router.use('/orders', require('./orders'));
router.use('/invoices', require('./invoices'));
router.use('/products', require('./products'));
router.use('/jamaah-profiles', require('./jamaahProfiles'));
router.use('/installments', require('./installments'));
router.use('/kloters', require('./kloters'));
router.use('/flyers', require('./flyers'));
router.use('/business-rules', require('./businessRules'));
router.use('/reports', require('./reports'));
router.use('/settings', auth, requireRole(ROLES.ADMIN), require('./superAdmin'));

module.exports = router;
