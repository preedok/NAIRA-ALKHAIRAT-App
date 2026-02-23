const express = require('express');
const router = express.Router();
const branchController = require('../../controllers/branchController');
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');

router.get('/public', branchController.listPublic);
router.get('/provinces', auth, branchController.listProvinces);
router.get('/wilayah', auth, branchController.listWilayah);
router.get('/kabupaten/:provinceId', auth, branchController.listKabupaten);
router.get('/', auth, branchController.list);
router.get('/:id', auth, branchController.getById);
router.post('/', auth, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), branchController.create);
router.post('/bulk-by-province', auth, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), branchController.createBulkByProvince);
router.patch('/:id', auth, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), branchController.update);

module.exports = router;
