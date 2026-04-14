const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const productController = require('../../controllers/productController');

router.use(auth);

// Sub-router untuk /prices - path /products/prices dan /products/prices/:id
const pricesRouter = express.Router({ mergeParams: true });
pricesRouter.get('/', productController.listPrices);
pricesRouter.post('/', requireRole(ROLES.ADMIN), productController.createPrice);
pricesRouter.patch('/:id', requireRole(ROLES.ADMIN), productController.updatePrice);
pricesRouter.delete('/:id', requireRole(ROLES.ADMIN), productController.deletePrice);
router.use('/prices', pricesRouter);

// Sub-router untuk /hotels - POST /products/hotels (buat hotel, type & code otomatis)
const hotelsRouter = express.Router({ mergeParams: true });
hotelsRouter.post('/', requireRole(ROLES.ADMIN), productController.createHotel);
router.use('/hotels', hotelsRouter);

// Sub-router untuk /visas - POST /products/visas (buat visa: Visa Only / Visa + Tasreh / Visa Premium)
const visasRouter = express.Router({ mergeParams: true });
visasRouter.post('/', requireRole(ROLES.ADMIN), productController.createVisa);
router.use('/visas', visasRouter);

// Sub-router untuk /tickets - POST /products/tickets (buat tiket, harga & kuota per bandara)
const ticketsRouter = express.Router({ mergeParams: true });
ticketsRouter.post('/', requireRole(ROLES.ADMIN), productController.createTicket);
router.use('/tickets', ticketsRouter);

// Sub-router untuk /bus - POST /products/bus (buat produk bus, rute & tipe perjalanan)
const busRouter = express.Router({ mergeParams: true });
busRouter.post('/', requireRole(ROLES.ADMIN), productController.createBus);
router.use('/bus', busRouter);

router.get('/', productController.list);
// More specific /:id/... routes must come before generic /:id (Express first-match wins)
// Role yang boleh akses baca detail produk (termasuk accounting untuk menu Product)
const PRODUCT_READ_ROLES = [ROLES.ADMIN, ROLES.USER];

router.get('/:id/ticket-calendar', productController.getTicketCalendar);
router.get('/:id/bus-calendar', productController.getBusCalendar);
router.get('/:id/hotel-calendar', productController.getHotelCalendar);
router.get('/:id/visa-calendar', productController.getVisaCalendar);
router.get('/:id/price', productController.getPrice);
router.get('/:id/availability', productController.getAvailability);
router.get('/:id/hotel-stay-quote', productController.getHotelStayQuote);
router.get('/:id/hotel-monthly-prices', productController.listHotelMonthlyPrices);
router.put('/:id/hotel-monthly-prices/bulk', requireRole(ROLES.ADMIN), productController.upsertHotelMonthlyPricesBulk);
router.put('/:id/ticket-bandara', requireRole(ROLES.ADMIN), productController.setTicketBandara);
router.put('/:id/ticket-bandara-bulk', requireRole(ROLES.ADMIN), productController.setTicketBandaraBulk);
router.get('/:id', requireRole(...PRODUCT_READ_ROLES), productController.getById);
router.post('/', requireRole(ROLES.ADMIN), productController.create);
router.patch('/:id', requireRole(ROLES.ADMIN), productController.update);
router.delete('/:id', requireRole(ROLES.ADMIN), productController.remove);

module.exports = router;
