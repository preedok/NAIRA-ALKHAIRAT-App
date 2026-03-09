const express = require('express');
const router = express.Router();
const branchController = require('../../controllers/branchController');
const { auth } = require('../../middleware/auth');

// Read-only: list, listPublic, provinces, wilayah, kabupaten (untuk filter & Tambah User). Kelola Cabang dihapus.
router.get('/public', branchController.listPublic);
router.get('/provinces', auth, branchController.listProvinces);
router.get('/wilayah', auth, branchController.listWilayah);
router.get('/kabupaten-for-owner', auth, branchController.listKabupatenForOwner);
router.get('/kabupaten/:provinceId', auth, branchController.listKabupaten);
router.get('/location-by-kota', auth, branchController.getLocationByKota);
router.get('/', auth, branchController.list);

module.exports = router;
