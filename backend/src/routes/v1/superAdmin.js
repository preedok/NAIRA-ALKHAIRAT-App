const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const superAdminController = require('../../controllers/superAdminController');

// Public (for banner and theme)
router.get('/maintenance/active', superAdminController.getActiveMaintenance);
router.get('/settings/public', superAdminController.getSettings);

// All below: Super Admin only
router.use(auth);
router.use(requireRole(ROLES.SUPER_ADMIN));

router.get('/monitoring', superAdminController.getMonitoring);
router.get('/logs', superAdminController.getLogs);
router.post('/logs', superAdminController.createLog);
router.get('/maintenance', superAdminController.listMaintenance);
router.post('/maintenance', superAdminController.createMaintenance);
router.patch('/maintenance/:id', superAdminController.updateMaintenance);
router.delete('/maintenance/:id', superAdminController.deleteMaintenance);
router.get('/settings', superAdminController.getSettings);
router.put('/settings', superAdminController.updateSettings);
router.get('/export-monitoring-excel', superAdminController.exportMonitoringExcel);
router.get('/export-monitoring-pdf', superAdminController.exportMonitoringPdf);
router.get('/export-logs-excel', superAdminController.exportLogsExcel);
router.get('/export-logs-pdf', superAdminController.exportLogsPdf);

module.exports = router;
