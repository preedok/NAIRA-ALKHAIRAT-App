const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const reportsController = require('../../controllers/reportsController');

router.get('/filters', auth, requireRole(ROLES.ADMIN), reportsController.getReportFilters);
router.get('/analytics', auth, requireRole(ROLES.ADMIN), reportsController.getAnalytics);
router.get('/export-excel', auth, requireRole(ROLES.ADMIN), reportsController.exportReportExcel);
router.get('/export-pdf', auth, requireRole(ROLES.ADMIN), reportsController.exportReportPdf);

module.exports = router;
