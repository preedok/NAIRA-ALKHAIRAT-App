const express = require('express');
const router = express.Router();
const publicController = require('../../controllers/publicController');

// Public routes (no auth) for landing page search widget
router.get('/products-for-search', publicController.listProductsForSearch);
router.get('/branches', publicController.listBranches);
router.get('/provinces', publicController.listProvinces);
router.get('/wilayahs', publicController.listWilayahs);

module.exports = router;
