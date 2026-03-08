const express = require('express');
const router = express.Router();
const maskapaiController = require('../../controllers/maskapaiController');
const { auth } = require('../../middleware/auth');

router.get('/', auth, maskapaiController.list);

module.exports = router;
