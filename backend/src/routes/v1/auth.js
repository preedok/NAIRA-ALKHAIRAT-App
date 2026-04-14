const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { auth } = require('../../middleware/auth');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/otp/resend', authController.resendOtp);
router.post('/otp/verify', authController.verifyOtp);
router.get('/me', auth, authController.me);
router.get('/activity', auth, authController.activity);
router.post('/change-password', auth, authController.changePassword);

module.exports = router;
