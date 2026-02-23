const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const reportsController = require('../../controllers/reportsController');

router.get('/filters', auth, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING), reportsController.getReportFilters);
router.get('/analytics', auth, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING), reportsController.getAnalytics);
router.get('/export-excel', auth, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING), reportsController.exportReportExcel);
router.get('/export-pdf', auth, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING), reportsController.exportReportPdf);

module.exports = router;
