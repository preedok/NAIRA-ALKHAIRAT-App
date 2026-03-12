const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const rekapHotelController = require('../../controllers/rekapHotelController');

router.use(auth);
router.use(requireRole(ROLES.ROLE_REKAP_HOTEL, ROLES.SUPER_ADMIN));

router.get('/options', rekapHotelController.getOptions);
router.get('/', rekapHotelController.list);
router.get('/:id', rekapHotelController.getById);
router.post('/', rekapHotelController.create);
router.post('/bulk', rekapHotelController.bulkCreate);
router.patch('/:id', rekapHotelController.update);
router.delete('/:id', rekapHotelController.remove);

module.exports = router;
