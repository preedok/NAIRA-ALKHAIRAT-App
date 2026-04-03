const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const accountingController = require('../../controllers/accountingController');

router.use(auth);

// Export laporan keuangan & daftar invoice: boleh diakses super_admin, admin_pusat, role_accounting
router.get('/export-financial-excel', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING), accountingController.exportFinancialExcel);
router.get('/export-financial-pdf', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING), accountingController.exportFinancialPdf);
router.get('/export-invoices-excel', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING), accountingController.exportInvoicesExcel);

// Daftar bank & rekening bank (read-only): boleh semua user login, untuk dropdown pembayaran invoice
router.get('/banks', accountingController.getBanks);
router.get('/bank-accounts', accountingController.getBankAccounts);
router.get('/bank-accounts/:id', accountingController.getBankAccountById);

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
// Master bank & rekening bank: create/update/delete hanya role accounting
router.post('/bank-accounts', accountingController.createBankAccount);
router.patch('/bank-accounts/:id', accountingController.updateBankAccount);
router.delete('/bank-accounts/:id', accountingController.deleteBankAccount);
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
router.get('/financial-report/period-invoices', accountingController.getFinancialReportPeriodInvoices);
router.get('/financial-report/owner-invoices', accountingController.getFinancialReportOwnerInvoices);
router.get('/financial-report/kota-invoices', accountingController.getFinancialReportKotaInvoices);
router.get('/financial-report/provinsi-invoices', accountingController.getFinancialReportProvinsiInvoices);
router.get('/financial-report/wilayah-invoices', accountingController.getFinancialReportWilayahInvoices);
router.get('/financial-report', accountingController.getFinancialReport);
router.post('/payments/:id/reconcile', accountingController.reconcilePayment);

module.exports = router;
