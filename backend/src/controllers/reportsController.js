const { Order, Invoice, User } = require('../models');

async function getReportFilters(_req, res) {
  res.json({ success: true, data: { periods: ['monthly', 'yearly'] } });
}

async function getAnalytics(_req, res) {
  const [orders, invoices, users] = await Promise.all([
    Order.count(),
    Invoice.count(),
    User.count({ where: { role: 'user' } })
  ]);
  res.json({ success: true, data: { total_orders: orders, total_invoices: invoices, total_users: users } });
}

async function exportReportExcel(_req, res) {
  res.json({ success: true, message: 'Export Excel siap diproses' });
}

async function exportReportPdf(_req, res) {
  res.json({ success: true, message: 'Export PDF siap diproses' });
}

module.exports = { getReportFilters, getAnalytics, exportReportExcel, exportReportPdf };
