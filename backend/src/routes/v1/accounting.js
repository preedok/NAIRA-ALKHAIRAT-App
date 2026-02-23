const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const accountingController = require('../../controllers/accountingController');
const payrollController = require('../../controllers/payrollController');

router.use(auth);

// Slip gaji saya (semua role kecuali owner boleh akses)
router.get('/payroll/my-slips', payrollController.listMySlips);
router.get('/payroll/my-slips/:itemId/slip', payrollController.getMySlipPdf);

// Export laporan keuangan: boleh diakses super_admin, admin_pusat, role_accounting
router.get('/export-financial-excel', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING), accountingController.exportFinancialExcel);
router.get('/export-financial-pdf', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING), accountingController.exportFinancialPdf);

router.use(requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING));

// Ping untuk cek koneksi modul accounting
router.get('/ping', (req, res) => res.json({ success: true, message: 'Accounting API OK' }));

router.get('/dashboard', accountingController.getDashboard);
router.get('/dashboard-kpi', accountingController.getDashboardKpi);
router.get('/chart-of-accounts', accountingController.getChartOfAccounts);
router.get('/chart-of-accounts/:id', accountingController.getChartOfAccountById);
router.post('/chart-of-accounts', accountingController.createChartOfAccount);
router.patch('/chart-of-accounts/:id', accountingController.updateChartOfAccount);
router.delete('/chart-of-accounts/:id', accountingController.deleteChartOfAccount);
// Fiscal years: specific routes first (with :id)
router.get('/fiscal-years', accountingController.getFiscalYears);
router.get('/fiscal-years/:id', accountingController.getFiscalYearById);
router.post('/fiscal-years', accountingController.createFiscalYear);
router.post('/fiscal-years/:id/lock-all', accountingController.lockAllPeriods);
router.post('/fiscal-years/:id/close', accountingController.closeFiscalYear);
// Periods: specific routes first
router.get('/periods', accountingController.getAccountingPeriods);
router.post('/periods/:id/lock', accountingController.lockPeriod);
router.post('/periods/:id/unlock', accountingController.unlockPeriod);
router.put('/periods/:id/lock', accountingController.lockPeriod);
router.put('/periods/:id/unlock', accountingController.unlockPeriod);
router.get('/account-mappings', accountingController.getAccountMappings);
router.get('/owners', accountingController.listAccountingOwners);
router.get('/aging', accountingController.getAgingReport);
router.get('/export-aging-excel', accountingController.exportAgingExcel);
router.get('/export-aging-pdf', accountingController.exportAgingPdf);
router.get('/payments', accountingController.getPaymentsList);
router.get('/invoices', accountingController.listInvoices);
router.get('/orders', accountingController.listOrders);
router.get('/financial-report', accountingController.getFinancialReport);
router.post('/payments/:id/reconcile', accountingController.reconcilePayment);

// Payroll (penggajian)
router.get('/payroll/settings', payrollController.getSettings);
router.put('/payroll/settings', payrollController.updateSettings);
router.get('/payroll/employees', payrollController.listEligibleEmployees);
router.get('/payroll/employees/:userId/salary', payrollController.getEmployeeSalary);
router.put('/payroll/employees/:userId/salary', payrollController.upsertEmployeeSalary);
router.get('/payroll/runs', payrollController.listPayrollRuns);
router.post('/payroll/runs', payrollController.createPayrollRun);
router.get('/payroll/runs/:id', payrollController.getPayrollRun);
router.patch('/payroll/runs/:id', payrollController.updatePayrollRun);
router.post('/payroll/runs/:id/finalize', payrollController.finalizePayrollRun);
router.get('/payroll/runs/:runId/items/:itemId/slip', payrollController.getSlipPdf);

module.exports = router;
