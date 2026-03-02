const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../../middleware/auth');
const { ROLES } = require('../../constants');
const accountingController = require('../../controllers/accountingController');
const bankStatementController = require('../../controllers/bankStatementController');
const payrollController = require('../../controllers/payrollController');
const accurateOnlineController = require('../../controllers/accurateOnlineController');

router.use(auth);

// Slip gaji saya (semua role kecuali owner boleh akses)
router.get('/payroll/my-slips', payrollController.listMySlips);
router.get('/payroll/my-slips/:itemId/slip', payrollController.getMySlipPdf);

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
router.get('/financial-report', accountingController.getFinancialReport);
router.post('/payments/:id/reconcile', accountingController.reconcilePayment);

// Rekening Koran (upload Excel & rekon)
router.post('/bank-statements/upload', bankStatementController.uploadBankStatement);
router.get('/bank-statements/template', bankStatementController.downloadTemplate);
router.get('/bank-statements', bankStatementController.listBankStatements);
router.get('/bank-statements/:id', bankStatementController.getBankStatement);
router.get('/bank-statements/:id/original-file', bankStatementController.getOriginalFile);
router.get('/bank-statements/:id/export-pdf', bankStatementController.exportStatementPdf);
router.get('/bank-statements/:id/reconcile/export', bankStatementController.exportReconciliationExcel);
router.get('/bank-statements/:id/reconcile', bankStatementController.getReconciliation);
router.post('/bank-statements/:id/reconcile/approve', bankStatementController.approveSuggested);
router.post('/bank-statements/:id/reconcile/manual-map', bankStatementController.manualMap);
router.post('/bank-statements/:id/reconcile/finalize', bankStatementController.finalizeReconciliation);
router.delete('/bank-statements/:id', bankStatementController.deleteBankStatement);

// Accurate Online module
router.get('/accurate/dashboard', accurateOnlineController.getDashboard);
router.get('/accurate/quotations', accurateOnlineController.listQuotations);
router.get('/accurate/purchase-orders', accurateOnlineController.listPurchaseOrders);
router.get('/accurate/warehouses', accurateOnlineController.listWarehouses);
router.post('/accurate/warehouses', accurateOnlineController.createWarehouse);
router.get('/accurate/fixed-assets', accurateOnlineController.listFixedAssets);
router.post('/accurate/fixed-assets', accurateOnlineController.createFixedAsset);
router.patch('/accurate/fixed-assets/:id', accurateOnlineController.updateFixedAsset);
router.post('/accurate/fixed-assets/:id/calculate-depreciation', accurateOnlineController.calculateDepreciation);
router.get('/accurate/fixed-assets/:id/depreciation', accurateOnlineController.getDepreciationSchedule);

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
