const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const productController = require('../../controllers/productController');

router.use(auth);

// Sub-router untuk /prices - path /products/prices dan /products/prices/:id
const pricesRouter = express.Router({ mergeParams: true });
pricesRouter.get('/', productController.listPrices);
pricesRouter.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR), productController.createPrice);
pricesRouter.patch('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR), productController.updatePrice);
pricesRouter.delete('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR), productController.deletePrice);
router.use('/prices', pricesRouter);

// Sub-router untuk /hotels - POST /products/hotels (buat hotel, type & code otomatis)
const hotelsRouter = express.Router({ mergeParams: true });
hotelsRouter.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), productController.createHotel);
router.use('/hotels', hotelsRouter);

// Sub-router untuk /visas - POST /products/visas (buat visa: Visa Only / Visa + Tasreh / Visa Premium)
const visasRouter = express.Router({ mergeParams: true });
visasRouter.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), productController.createVisa);
router.use('/visas', visasRouter);

// Sub-router untuk /tickets - POST /products/tickets (buat tiket, harga & kuota per bandara)
const ticketsRouter = express.Router({ mergeParams: true });
ticketsRouter.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), productController.createTicket);
router.use('/tickets', ticketsRouter);

// Sub-router untuk /bus - POST /products/bus (buat produk bus, rute & tipe perjalanan)
const busRouter = express.Router({ mergeParams: true });
busRouter.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), productController.createBus);
router.use('/bus', busRouter);

router.get('/', productController.list);
// More specific /:id/... routes must come before generic /:id (Express first-match wins)
router.get('/:id/ticket-calendar', productController.getTicketCalendar);
router.get('/:id/bus-calendar', productController.getBusCalendar);
router.get('/:id/hotel-calendar', productController.getHotelCalendar);
router.get('/:id/visa-calendar', productController.getVisaCalendar);
router.get('/:id/price', productController.getPrice);
router.get('/:id/availability', productController.getAvailability);
router.put('/:id/ticket-bandara', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), productController.setTicketBandara);
router.put('/:id/ticket-bandara-bulk', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), productController.setTicketBandaraBulk);
router.get('/:id', productController.getById);
router.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), productController.create);
router.patch('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ADMIN_KOORDINATOR), productController.update);
router.delete('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT), productController.remove);

module.exports = router;
