const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const adminPusatController = require('../../controllers/adminPusatController');

router.use(auth);
router.use(requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING));

// Dashboard
router.get('/dashboard', adminPusatController.getDashboard);

// User: list, buat & update akun
router.get('/users', adminPusatController.listUsers);
router.get('/users/:id', adminPusatController.getUserById);
router.post('/users', adminPusatController.createUser);
router.patch('/users/:id', adminPusatController.updateUser);
router.delete('/users/:id', adminPusatController.deleteUser);

// Ketersediaan product (acuan general)
router.put('/products/:id/availability', adminPusatController.setProductAvailability);

// Hotel: pengaturan jumlah kamar (semua bulan vs per musim) + data per musim & inventori
router.get('/products/:productId/hotel-availability-config', adminPusatController.getHotelAvailabilityConfig);
router.put('/products/:productId/hotel-availability-config', adminPusatController.setHotelAvailabilityConfig);
router.get('/products/:productId/seasons', adminPusatController.listSeasons);
router.post('/products/:productId/seasons', adminPusatController.createSeason);
router.patch('/products/:productId/seasons/:seasonId', adminPusatController.updateSeason);
router.delete('/products/:productId/seasons/:seasonId', adminPusatController.deleteSeason);
router.put('/products/:productId/seasons/:seasonId/inventory', adminPusatController.setSeasonInventory);

// Visa: data per periode & kuota (kalender visa)
router.get('/products/:productId/visa-seasons', adminPusatController.listVisaSeasons);
router.post('/products/:productId/visa-seasons', adminPusatController.createVisaSeason);
router.patch('/products/:productId/visa-seasons/:seasonId', adminPusatController.updateVisaSeason);
router.delete('/products/:productId/visa-seasons/:seasonId', adminPusatController.deleteVisaSeason);
router.put('/products/:productId/visa-seasons/:seasonId/quota', adminPusatController.setVisaSeasonQuota);

// Tiket: periode & kuota per periode (Admin Pusat)
router.get('/products/:productId/ticket-seasons', adminPusatController.listTicketSeasons);
router.post('/products/:productId/ticket-seasons', adminPusatController.createTicketSeason);
router.patch('/products/:productId/ticket-seasons/:seasonId', adminPusatController.updateTicketSeason);
router.delete('/products/:productId/ticket-seasons/:seasonId', adminPusatController.deleteTicketSeason);
router.put('/products/:productId/ticket-seasons/:seasonId/quota', adminPusatController.setTicketSeasonQuota);

// Bus Saudi: periode & kuota per periode (Admin Pusat)
router.get('/products/:productId/bus-seasons', adminPusatController.listBusSeasons);
router.post('/products/:productId/bus-seasons', adminPusatController.createBusSeason);
router.patch('/products/:productId/bus-seasons/:seasonId', adminPusatController.updateBusSeason);
router.delete('/products/:productId/bus-seasons/:seasonId', adminPusatController.deleteBusSeason);
router.put('/products/:productId/bus-seasons/:seasonId/quota', adminPusatController.setBusSeasonQuota);

module.exports = router;
