const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Invoice, Order, OrderItem, User, Branch, PaymentProof, ChartOfAccount, AccountingFiscalYear, AccountingPeriod, AccountMapping, JournalEntryLine, Wilayah, Provinsi } = require('../models');
const { INVOICE_STATUS } = require('../constants');

// Role accounting bekerja di pusat: filter cabang untuk lihat order/invoice per cabang atau seluruh cabang.
const isAccountingPusat = (user) => user && user.role === 'role_accounting';

/**
 * GET /api/v1/accounting/dashboard
 * Rekapitulasi seluruh perusahaan: piutang, terbayar, per status, per cabang, per wilayah, per provinsi.
 * Filter: branch_id, provinsi_id, wilayah_id, date_from, date_to.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const { branch_id, provinsi_id, wilayah_id, date_from, date_to } = req.query;
  const where = {};
  const branchFilter = await resolveBranchFilter(branch_id, provinsi_id, wilayah_id, req.user);
  if (Object.keys(branchFilter).length) Object.assign(where, branchFilter);
  if (date_from || date_to) {
    where.created_at = where.created_at || {};
    if (date_from) where.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = d;
    }
  }

  const branchInclude = {
    model: Branch,
    as: 'Branch',
    attributes: ['id', 'code', 'name', 'provinsi_id'],
    required: false,
    include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }]
  };

  const invoices = await Invoice.findAll({
    where,
    include: [
      { model: Order, as: 'Order', attributes: ['id', 'order_number', 'status'] },
      { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] },
      branchInclude
    ],
    order: [['created_at', 'DESC']]
  });

  let totalReceivable = 0;
  let totalPaid = 0;
  const byStatus = {};
  const byBranch = {};
  const byProvinsi = {};
  const byWilayah = {};
  invoices.forEach(inv => {
    const j = inv.toJSON();
    byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    const bid = j.branch_id;
    if (bid) {
      byBranch[bid] = byBranch[bid] || { branch_name: j.Branch?.name, code: j.Branch?.code, count: 0, receivable: 0, paid: 0 };
      byBranch[bid].count += 1;
      byBranch[bid].receivable += parseFloat(j.remaining_amount || 0);
      byBranch[bid].paid += parseFloat(j.paid_amount || 0);
      const pid = j.Branch?.Provinsi?.id || j.Branch?.provinsi_id;
      const pname = j.Branch?.Provinsi?.name;
      if (pid) {
        byProvinsi[pid] = byProvinsi[pid] || { provinsi_name: pname, count: 0, receivable: 0, paid: 0 };
        byProvinsi[pid].count += 1;
        byProvinsi[pid].receivable += parseFloat(j.remaining_amount || 0);
        byProvinsi[pid].paid += parseFloat(j.paid_amount || 0);
      }
      const wid = j.Branch?.Provinsi?.Wilayah?.id;
      const wname = j.Branch?.Provinsi?.Wilayah?.name;
      if (wid) {
        byWilayah[wid] = byWilayah[wid] || { wilayah_name: wname, count: 0, receivable: 0, paid: 0 };
        byWilayah[wid].count += 1;
        byWilayah[wid].receivable += parseFloat(j.remaining_amount || 0);
        byWilayah[wid].paid += parseFloat(j.paid_amount || 0);
      }
    }
    totalReceivable += parseFloat(j.remaining_amount || 0);
    totalPaid += parseFloat(j.paid_amount || 0);
  });

  const branches = await Branch.findAll({
    where: { is_active: true },
    attributes: ['id', 'code', 'name', 'provinsi_id'],
    include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'wilayah_id'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }],
    order: [['code', 'ASC']]
  });

  res.json({
    success: true,
    data: {
      branches,
      summary: {
        total_invoices: invoices.length,
        total_receivable: totalReceivable,
        total_paid: totalPaid,
        by_status: byStatus,
        by_branch: Object.entries(byBranch).map(([id, v]) => ({ branch_id: id, ...v })),
        by_provinsi: Object.entries(byProvinsi).map(([id, v]) => ({ provinsi_id: id, ...v })),
        by_wilayah: Object.entries(byWilayah).map(([id, v]) => ({ wilayah_id: id, ...v }))
      },
      invoices_recent: invoices.slice(0, 15)
    }
  });
});

/** Resolve branch_id filter: branch_id > provinsi_id > wilayah_id */
async function resolveBranchFilter(branch_id, provinsi_id, wilayah_id, user) {
  if (!isAccountingPusat(user) && user.branch_id && !['super_admin', 'admin_pusat'].includes(user.role)) {
    return { branch_id: user.branch_id };
  }
  if (branch_id) return { branch_id };
  if (provinsi_id) {
    const branches = await Branch.findAll({ where: { provinsi_id, is_active: true }, attributes: ['id'] });
    const ids = branches.map(b => b.id);
    if (ids.length) return { branch_id: { [Op.in]: ids } };
    return { branch_id: { [Op.in]: [] } };
  }
  if (wilayah_id) {
    const branches = await Branch.findAll({
      where: { is_active: true },
      attributes: ['id'],
      include: [{ model: Provinsi, as: 'Provinsi', attributes: [], required: true, where: { wilayah_id } }]
    });
    const ids = branches.map(b => b.id);
    if (ids.length) return { branch_id: { [Op.in]: ids } };
    return { branch_id: { [Op.in]: [] } };
  }
  return {};
}

/**
 * GET /api/v1/accounting/owners
 * Daftar owner/partner yang punya invoice (untuk filter). Filter: branch_id, provinsi_id, wilayah_id
 */
const listAccountingOwners = asyncHandler(async (req, res) => {
  const { branch_id, provinsi_id, wilayah_id } = req.query;
  const where = {};
  const branchFilter = await resolveBranchFilter(branch_id, provinsi_id, wilayah_id, req.user);
  if (Object.keys(branchFilter).length) Object.assign(where, branchFilter);

  const invoices = await Invoice.findAll({
    where,
    attributes: ['owner_id'],
    include: [{ model: User, as: 'User', attributes: ['id', 'name', 'company_name'], required: true }]
  });
  const seen = new Set();
  const owners = [];
  for (const inv of invoices) {
    const uid = inv.owner_id;
    if (uid && !seen.has(uid)) {
      seen.add(uid);
      const j = inv.toJSON();
      owners.push({
        id: uid,
        name: j.User?.name || j.User?.company_name || 'Owner'
      });
    }
  }
  owners.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  res.json({ success: true, data: owners });
});

/**
 * GET /api/v1/accounting/aging
 * Laporan aging piutang: current, 1-30, 31-60, 61+ hari.
 * Filter: branch_id, provinsi_id, wilayah_id, owner_id, status, order_status, date_from, date_to, due_from, due_to, search
 * Pagination: page, limit, bucket (all|current|days_1_30|days_31_60|days_61_plus)
 */
const getAgingReport = asyncHandler(async (req, res) => {
  const { branch_id, provinsi_id, wilayah_id, owner_id, status, order_status, date_from, date_to, due_from, due_to, search, page, limit, bucket } = req.query;
  const where = { status: { [Op.in]: [INVOICE_STATUS.TENTATIVE, INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.OVERDUE] } };
  if (status) {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) where.status = { [Op.in]: statuses };
  }
  const branchFilter = await resolveBranchFilter(branch_id, provinsi_id, wilayah_id, req.user);
  if (Object.keys(branchFilter).length) Object.assign(where, branchFilter);
  if (owner_id) where.owner_id = owner_id;
  if (date_from || date_to) {
    where.created_at = where.created_at || {};
    if (date_from) where.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = d;
    }
  }
  if (due_from || due_to) {
    where.due_date_dp = where.due_date_dp || {};
    if (due_from) where.due_date_dp[Op.gte] = new Date(due_from);
    if (due_to) {
      const d = new Date(due_to);
      d.setHours(23, 59, 59, 999);
      where.due_date_dp[Op.lte] = d;
    }
  }

  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    const orders = await Order.findAll({ where: { order_number: { [Op.iLike]: q } }, attributes: ['id'], raw: true });
    const users = await User.findAll({
      where: { [Op.or]: [{ name: { [Op.iLike]: q } }, { company_name: { [Op.iLike]: q } }] },
      attributes: ['id'],
      raw: true
    });
    const orderIds = orders.map(o => o.id);
    const userIds = users.map(u => u.id);
    if (orderIds.length || userIds.length) {
      where[Op.or] = [];
      if (orderIds.length) where[Op.or].push({ order_id: { [Op.in]: orderIds } });
      if (userIds.length) where[Op.or].push({ owner_id: { [Op.in]: userIds } });
    } else {
      where.id = { [Op.in]: [] }; // no match
    }
  }

  const orderInclude = {
    model: Order,
    as: 'Order',
    attributes: ['id', 'order_number', 'status'],
    required: !!order_status
  };
  if (order_status) {
    const statuses = String(order_status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) orderInclude.where = { status: { [Op.in]: statuses } };
  }

  const invoices = await Invoice.findAll({
    where,
    include: [
      orderInclude,
      { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      { model: PaymentProof, as: 'PaymentProofs', required: false, attributes: ['id', 'amount', 'payment_type', 'verified_at', 'verified_status', 'proof_file_url'] }
    ],
    order: [['due_date_dp', 'ASC'], ['created_at', 'ASC']]
  });

  const now = new Date();
  const buckets = { current: [], days_1_30: [], days_31_60: [], days_61_plus: [] };
  let totalCurrent = 0;
  let total1_30 = 0;
  let total31_60 = 0;
  let total61Plus = 0;

  invoices.forEach(inv => {
    const due = inv.due_date_dp ? new Date(inv.due_date_dp) : new Date(inv.created_at);
    const daysOverdue = Math.floor((now - due) / (24 * 60 * 60 * 1000));
    const remaining = parseFloat(inv.remaining_amount || 0);
    if (remaining <= 0) return;
    const row = { ...inv.toJSON(), days_overdue: daysOverdue };
    if (daysOverdue <= 0) {
      buckets.current.push(row);
      totalCurrent += remaining;
    } else if (daysOverdue <= 30) {
      buckets.days_1_30.push(row);
      total1_30 += remaining;
    } else if (daysOverdue <= 60) {
      buckets.days_31_60.push(row);
      total31_60 += remaining;
    } else {
      buckets.days_61_plus.push(row);
      total61Plus += remaining;
    }
  });

  const bucketKey = bucket && ['all', 'current', 'days_1_30', 'days_31_60', 'days_61_plus'].includes(String(bucket)) ? String(bucket) : 'all';
  let items = bucketKey === 'all'
    ? [...buckets.current, ...buckets.days_1_30, ...buckets.days_31_60, ...buckets.days_61_plus]
    : buckets[bucketKey] || [];

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 25));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limitNum));
  const offset = (pageNum - 1) * limitNum;
  items = items.slice(offset, offset + limitNum);

  res.json({
    success: true,
    data: {
      buckets,
      bucket_counts: {
        current: buckets.current.length,
        days_1_30: buckets.days_1_30.length,
        days_31_60: buckets.days_31_60.length,
        days_61_plus: buckets.days_61_plus.length
      },
      items,
      pagination: {
        total: totalItems,
        page: pageNum,
        limit: limitNum,
        totalPages
      },
      totals: { current: totalCurrent, days_1_30: total1_30, days_31_60: total31_60, days_61_plus: total61Plus },
      total_outstanding: totalCurrent + total1_30 + total31_60 + total61Plus
    }
  });
});

/**
 * GET /api/v1/accounting/export-aging-excel
 */
const exportAgingExcel = asyncHandler(async (req, res) => {
  const { branch_id, provinsi_id, wilayah_id, owner_id, status, order_status, date_from, date_to, due_from, due_to, search } = req.query;
  const where = { status: { [Op.in]: [INVOICE_STATUS.TENTATIVE, INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.OVERDUE] } };
  if (status) {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) where.status = { [Op.in]: statuses };
  }
  const branchFilter = await resolveBranchFilter(branch_id, provinsi_id, wilayah_id, req.user);
  if (Object.keys(branchFilter).length) Object.assign(where, branchFilter);
  if (owner_id) where.owner_id = owner_id;
  if (date_from || date_to) {
    where.created_at = where.created_at || {};
    if (date_from) where.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = d;
    }
  }
  if (due_from || due_to) {
    where.due_date_dp = where.due_date_dp || {};
    if (due_from) where.due_date_dp[Op.gte] = new Date(due_from);
    if (due_to) {
      const d = new Date(due_to);
      d.setHours(23, 59, 59, 999);
      where.due_date_dp[Op.lte] = d;
    }
  }
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    const orders = await Order.findAll({ where: { order_number: { [Op.iLike]: q } }, attributes: ['id'], raw: true });
    const users = await User.findAll({
      where: { [Op.or]: [{ name: { [Op.iLike]: q } }, { company_name: { [Op.iLike]: q } }] },
      attributes: ['id'],
      raw: true
    });
    const orderIds = orders.map(o => o.id);
    const userIds = users.map(u => u.id);
    if (orderIds.length || userIds.length) {
      where[Op.or] = [];
      if (orderIds.length) where[Op.or].push({ order_id: { [Op.in]: orderIds } });
      if (userIds.length) where[Op.or].push({ owner_id: { [Op.in]: userIds } });
    } else {
      where.id = { [Op.in]: [] };
    }
  }

  const orderIncludeExp = {
    model: Order,
    as: 'Order',
    attributes: ['id', 'order_number', 'status'],
    required: !!order_status
  };
  if (order_status) {
    const statuses = String(order_status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) orderIncludeExp.where = { status: { [Op.in]: statuses } };
  }

  const invoices = await Invoice.findAll({
    where,
    include: [
      orderIncludeExp,
      { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] }
    ],
    order: [['due_date_dp', 'ASC'], ['created_at', 'ASC']]
  });

  const now = new Date();
  const allRows = [];
  invoices.forEach(inv => {
    const due = inv.due_date_dp ? new Date(inv.due_date_dp) : new Date(inv.created_at);
    const daysOverdue = Math.floor((now - due) / (24 * 60 * 60 * 1000));
    const remaining = parseFloat(inv.remaining_amount || 0);
    if (remaining <= 0) return;
    const j = inv.toJSON();
    allRows.push({
      invoice_number: j.invoice_number,
      order_number: j.Order?.order_number,
      partner: j.User?.name || j.User?.company_name,
      branch: j.Branch?.name,
      total_amount: parseFloat(j.total_amount || 0),
      paid_amount: parseFloat(j.paid_amount || 0),
      remaining_amount: remaining,
      status: j.status,
      due_date: j.due_date_dp,
      days_overdue: daysOverdue,
      bucket: daysOverdue <= 0 ? 'Current' : daysOverdue <= 30 ? '1-30' : daysOverdue <= 60 ? '31-60' : '61+'
    });
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Piutang Usaha', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'No. Invoice', width: 18 },
    { header: 'No. Order', width: 14 },
    { header: 'Partner', width: 22 },
    { header: 'Cabang', width: 14 },
    { header: 'Total', width: 14 },
    { header: 'Dibayar', width: 14 },
    { header: 'Sisa', width: 14 },
    { header: 'Status', width: 12 },
    { header: 'Jatuh Tempo', width: 12 },
    { header: 'Terlambat (hr)', width: 10 },
    { header: 'Bucket', width: 8 }
  ];
  sheet.getRow(1).font = { bold: true };
  allRows.forEach(r => {
    sheet.addRow([
      r.invoice_number,
      r.order_number,
      r.partner,
      r.branch,
      r.total_amount,
      r.paid_amount,
      r.remaining_amount,
      r.status,
      r.due_date ? new Date(r.due_date).toLocaleDateString('id-ID') : '-',
      r.days_overdue,
      r.bucket
    ]);
  });
  const buf = await workbook.xlsx.writeBuffer();
  const filename = `piutang-usaha-${now.toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buf));
});

/**
 * GET /api/v1/accounting/export-aging-pdf
 */
const exportAgingPdf = asyncHandler(async (req, res) => {
  const { branch_id, provinsi_id, wilayah_id, owner_id, status, order_status, date_from, date_to, due_from, due_to, search } = req.query;
  const where = { status: { [Op.in]: [INVOICE_STATUS.TENTATIVE, INVOICE_STATUS.PARTIAL_PAID, INVOICE_STATUS.OVERDUE] } };
  if (status) {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) where.status = { [Op.in]: statuses };
  }
  const branchFilter = await resolveBranchFilter(branch_id, provinsi_id, wilayah_id, req.user);
  if (Object.keys(branchFilter).length) Object.assign(where, branchFilter);
  if (owner_id) where.owner_id = owner_id;
  if (date_from || date_to) {
    where.created_at = where.created_at || {};
    if (date_from) where.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = d;
    }
  }
  if (due_from || due_to) {
    where.due_date_dp = where.due_date_dp || {};
    if (due_from) where.due_date_dp[Op.gte] = new Date(due_from);
    if (due_to) {
      const d = new Date(due_to);
      d.setHours(23, 59, 59, 999);
      where.due_date_dp[Op.lte] = d;
    }
  }
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    const orders = await Order.findAll({ where: { order_number: { [Op.iLike]: q } }, attributes: ['id'], raw: true });
    const users = await User.findAll({
      where: { [Op.or]: [{ name: { [Op.iLike]: q } }, { company_name: { [Op.iLike]: q } }] },
      attributes: ['id'],
      raw: true
    });
    const orderIds = orders.map(o => o.id);
    const userIds = users.map(u => u.id);
    if (orderIds.length || userIds.length) {
      where[Op.or] = [];
      if (orderIds.length) where[Op.or].push({ order_id: { [Op.in]: orderIds } });
      if (userIds.length) where[Op.or].push({ owner_id: { [Op.in]: userIds } });
    } else {
      where.id = { [Op.in]: [] };
    }
  }

  const orderIncludePdf = {
    model: Order,
    as: 'Order',
    attributes: ['id', 'order_number', 'status'],
    required: !!order_status
  };
  if (order_status) {
    const statuses = String(order_status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) orderIncludePdf.where = { status: { [Op.in]: statuses } };
  }

  const invoices = await Invoice.findAll({
    where,
    include: [
      orderIncludePdf,
      { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] }
    ],
    order: [['due_date_dp', 'ASC'], ['created_at', 'ASC']]
  });

  const now = new Date();
  let totalOutstanding = 0;
  const buckets = { current: [], days_1_30: [], days_31_60: [], days_61_plus: [] };
  invoices.forEach(inv => {
    const due = inv.due_date_dp ? new Date(inv.due_date_dp) : new Date(inv.created_at);
    const daysOverdue = Math.floor((now - due) / (24 * 60 * 60 * 1000));
    const remaining = parseFloat(inv.remaining_amount || 0);
    if (remaining <= 0) return;
    totalOutstanding += remaining;
    const j = inv.toJSON();
    const row = { order_number: j.Order?.order_number, partner: j.User?.name || j.User?.company_name, remaining_amount: remaining, days_overdue: daysOverdue };
    if (daysOverdue <= 0) buckets.current.push(row);
    else if (daysOverdue <= 30) buckets.days_1_30.push(row);
    else if (daysOverdue <= 60) buckets.days_31_60.push(row);
    else buckets.days_61_plus.push(row);
  });

  const doc = new PDFDocument({ margin: 50 });
  const filename = `piutang-usaha-${now.toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.fontSize(16).text('Laporan Piutang Usaha (Aging)', { align: 'center' });
  doc.fontSize(9).text(`Generated: ${now.toLocaleString('id-ID')}`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).text(`Total Piutang: Rp ${totalOutstanding.toLocaleString('id-ID')}`, { align: 'left' });
  doc.moveDown(0.5);
  const bucketLabels = [
    { key: 'current', label: 'Belum Jatuh Tempo' },
    { key: 'days_1_30', label: 'Terlambat 1-30 Hari' },
    { key: 'days_31_60', label: 'Terlambat 31-60 Hari' },
    { key: 'days_61_plus', label: 'Terlambat 61+ Hari' }
  ];
  bucketLabels.forEach(({ key, label }) => {
    const arr = buckets[key];
    const sum = arr.reduce((s, r) => s + r.remaining_amount, 0);
    doc.fontSize(10).text(`${label}: ${arr.length} invoice, Rp ${sum.toLocaleString('id-ID')}`, { continued: false });
    arr.slice(0, 15).forEach((r, i) => {
      doc.fontSize(8).text(`  ${i + 1}. ${r.order_number} - ${r.partner} - Rp ${r.remaining_amount.toLocaleString('id-ID')} (${r.days_overdue} hr)`, { continued: false });
    });
    if (arr.length > 15) doc.fontSize(8).text(`  ... dan ${arr.length - 15} lainnya`, { continued: false });
    doc.moveDown(0.3);
  });
  doc.end();
});

/**
 * GET /api/v1/accounting/payments
 * Daftar pembayaran (payment proofs) untuk rekonsiliasi.
 */
const getPaymentsList = asyncHandler(async (req, res) => {
  const { branch_id, verified, date_from, date_to } = req.query;
  const invWhere = {};
  if (!isAccountingPusat(req.user) && req.user.branch_id && !['super_admin', 'admin_pusat'].includes(req.user.role)) {
    invWhere.branch_id = req.user.branch_id;
  } else if (branch_id) invWhere.branch_id = branch_id;

  const invoices = await Invoice.findAll({
    where: invWhere,
    attributes: ['id'],
    raw: true
  });
  const invoiceIds = invoices.map(i => i.id);

  const ppWhere = { invoice_id: invoiceIds };
  if (verified !== undefined) {
    if (verified === 'true') ppWhere.verified_at = { [Op.ne]: null };
    else ppWhere.verified_at = null;
  }
  if (date_from || date_to) {
    ppWhere.created_at = {};
    if (date_from) ppWhere.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      ppWhere.created_at[Op.lte] = d;
    }
  }

  const payments = await PaymentProof.findAll({
    where: ppWhere,
    include: [
      { model: Invoice, as: 'Invoice', include: [{ model: Order, as: 'Order' }, { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] }] }
    ],
    order: [['created_at', 'DESC']],
    limit: 100
  });

  res.json({ success: true, data: payments });
});

/**
 * GET /api/v1/accounting/invoices
 * List invoice dengan filter cabang. Query: branch_id (opsional), status. Tanpa branch_id = semua cabang (order terbaru).
 */
const listInvoices = asyncHandler(async (req, res) => {
  const { status, branch_id } = req.query;
  const where = {};
  if (status) where.status = status;
  if (!isAccountingPusat(req.user) && req.user.branch_id && !['super_admin', 'admin_pusat'].includes(req.user.role)) {
    where.branch_id = req.user.branch_id;
  } else if (branch_id) where.branch_id = branch_id;

  const invoices = await Invoice.findAll({
    where,
    include: [
      { model: Order, as: 'Order', attributes: ['id', 'order_number', 'total_amount', 'status'] },
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      { model: PaymentProof, as: 'PaymentProofs', required: false }
    ],
    order: [['created_at', 'DESC']]
  });

  res.json({ success: true, data: invoices });
});

/**
 * GET /api/v1/accounting/orders
 * Daftar order untuk accounting: filter branch_id (opsional). Tanpa branch_id = semua cabang, terbaru dulu.
 */
const listOrders = asyncHandler(async (req, res) => {
  const { branch_id, status, limit } = req.query;
  const where = {};
  if (branch_id) where.branch_id = branch_id;
  if (status) where.status = status;

  const orders = await Order.findAll({
    where,
    include: [
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      { model: OrderItem, as: 'OrderItems' }
    ],
    order: [['created_at', 'DESC']],
    limit: Math.min(parseInt(limit, 10) || 100, 500)
  });

  res.json({ success: true, data: orders });
});

/** Helper: build date range from query params for financial report */
function buildFinancialReportDateRange(period, year, month, date_from, date_to) {
  let startDate;
  let endDate = new Date();
  if (date_from && date_to) {
    startDate = new Date(date_from);
    endDate = new Date(date_to);
    endDate.setHours(23, 59, 59, 999);
  } else {
    const y = parseInt(year || endDate.getFullYear(), 10);
    if (period === 'year') {
      startDate = new Date(y, 0, 1);
      endDate = new Date(y, 11, 31, 23, 59, 59);
    } else if (period === 'quarter') {
      const monthNum = parseInt(month || '1', 10);
      const quarterNum = Math.min(4, Math.max(1, Math.ceil(monthNum / 3)));
      const qStart = (quarterNum - 1) * 3;
      startDate = new Date(y, qStart, 1);
      endDate = new Date(y, qStart + 3, 0, 23, 59, 59);
    } else {
      const m = parseInt(month || (endDate.getMonth() + 1), 10) - 1;
      startDate = new Date(y, m, 1);
      endDate = new Date(y, m + 1, 0, 23, 59, 59);
    }
  }
  return { startDate, endDate };
}

/**
 * GET /api/v1/accounting/financial-report
 * Laporan keuangan lengkap: pendapatan per periode, per cabang, per owner, per produk.
 * Filter: branch_id, provinsi_id, wilayah_id, owner_id, period, year, month, date_from, date_to,
 *        status, order_status, product_type, search, min_amount, max_amount
 * Pagination: page, limit (untuk invoices)
 * Sort: sort_by (issued_at|total_amount|paid_amount|invoice_number), sort_order (asc|desc)
 */
function emptyFinancialReportPayload(startDate, endDate) {
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 30);
  return {
    period: { start: startDate, end: endDate },
    total_revenue: 0,
    by_branch: [],
    by_wilayah: [],
    by_provinsi: [],
    by_owner: [],
    by_product_type: [{ type: 'hotel', revenue: 0 }, { type: 'visa', revenue: 0 }, { type: 'ticket', revenue: 0 }, { type: 'bus', revenue: 0 }, { type: 'handling', revenue: 0 }],
    by_period: [],
    invoice_count: 0,
    invoices: [],
    pagination: { total: 0, page: 1, limit: 25, totalPages: 1 },
    previous_period: { start: prevStart, end: prevEnd, revenue: 0, invoice_count: 0, growth_percent: null }
  };
}

const getFinancialReport = asyncHandler(async (req, res) => {
  const { period, year, month, date_from, date_to, branch_id, provinsi_id, wilayah_id, owner_id, status, order_status, product_type, search, min_amount, max_amount, page, limit, sort_by, sort_order } = req.query;
  let startDate;
  let endDate;
  try {
    const range = buildFinancialReportDateRange(period, year, month, date_from, date_to);
    startDate = range.startDate;
    endDate = range.endDate;
  } catch (err) {
    endDate = new Date();
    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    return res.json({ success: true, data: emptyFinancialReportPayload(startDate, endDate) });
  }
  const invWhere = {};

  const branchFilter = await resolveBranchFilter(branch_id, provinsi_id, wilayah_id, req.user);
  if (Object.keys(branchFilter).length) Object.assign(invWhere, branchFilter);
  if (owner_id) invWhere.owner_id = owner_id;
  if (status) {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) invWhere.status = { [Op.in]: statuses };
  }
  if (min_amount != null && min_amount !== '') invWhere.paid_amount = { ...(invWhere.paid_amount || {}), [Op.gte]: parseFloat(min_amount) };
  if (max_amount != null && max_amount !== '') invWhere.paid_amount = { ...(invWhere.paid_amount || {}), [Op.lte]: parseFloat(max_amount) };

  const dateCondition = {
    [Op.or]: [
      { issued_at: { [Op.between]: [startDate, endDate] } },
      { issued_at: { [Op.is]: null }, created_at: { [Op.between]: [startDate, endDate] } }
    ]
  };
  invWhere[Op.and] = [...(invWhere[Op.and] || []), dateCondition];

  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    const orders = await Order.findAll({ where: { order_number: { [Op.iLike]: q } }, attributes: ['id'], raw: true });
    const users = await User.findAll({
      where: { [Op.or]: [{ name: { [Op.iLike]: q } }, { company_name: { [Op.iLike]: q } }] },
      attributes: ['id'],
      raw: true
    });
    const orderIds = orders.map(o => o.id);
    const userIds = users.map(u => u.id);
    const searchOr = [];
    if (orderIds.length) searchOr.push({ order_id: { [Op.in]: orderIds } });
    if (userIds.length) searchOr.push({ owner_id: { [Op.in]: userIds } });
    searchOr.push({ invoice_number: { [Op.iLike]: q } });
    invWhere[Op.and].push({ [Op.or]: searchOr });
  }

  const orderWhere = order_status ? { status: { [Op.in]: String(order_status).split(',').map(s => s.trim()).filter(Boolean) } } : undefined;
  const orderItemInclude = { model: OrderItem, as: 'OrderItems', required: false };
  if (product_type) {
    orderItemInclude.where = { type: { [Op.iLike]: String(product_type).trim() } };
    orderItemInclude.required = true;
  }
  const orderInclude = {
    model: Order,
    as: 'Order',
    required: true,
    where: orderWhere,
    include: [orderItemInclude]
  };

  const allowedSort = ['issued_at', 'total_amount', 'paid_amount', 'invoice_number'];
  const sortCol = allowedSort.includes(String(sort_by || '')) ? String(sort_by) : 'issued_at';
  const sortDir = String(sort_order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  // ORDER BY must use alias "Invoice" (Sequelize model name) to avoid "invalid reference to FROM-clause" in PostgreSQL
  const orderBy = [
    [sequelize.literal(`"Invoice"."${sortCol}"`), sortDir],
    [sequelize.literal('"Invoice"."invoice_number"'), 'ASC']
  ];

  const branchInclude = {
    model: Branch,
    as: 'Branch',
    attributes: ['id', 'code', 'name', 'provinsi_id'],
    required: false,
    include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'wilayah_id'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'] }] }]
  };

  let invoices;
  try {
    invoices = await Invoice.findAll({
    where: invWhere,
    include: [
      branchInclude,
      { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] },
      { model: PaymentProof, as: 'PaymentProofs', required: false },
      orderInclude
    ],
    order: orderBy
  });

  let totalRevenue = 0;
  const byBranch = {};
  const byWilayah = {};
  const byProvinsi = {};
  const byOwner = {};
  const byProductType = { hotel: 0, visa: 0, ticket: 0, bus: 0, handling: 0 };
  const byPeriod = {};
  const invoicesDetail = [];

  invoices.forEach(inv => {
    const paid = parseFloat(inv.paid_amount || 0);
    totalRevenue += paid;

    const bid = inv.branch_id || 'none';
    byBranch[bid] = byBranch[bid] || { branch_id: bid, branch_name: inv.Branch?.name || inv.Branch?.code || 'Lainnya', revenue: 0, invoice_count: 0 };
    byBranch[bid].revenue += paid;
    byBranch[bid].invoice_count += 1;

    const wid = inv.Branch?.Provinsi?.Wilayah?.id || 'other';
    byWilayah[wid] = byWilayah[wid] || { wilayah_id: wid, wilayah_name: inv.Branch?.Provinsi?.Wilayah?.name || 'Lainnya', revenue: 0, invoice_count: 0 };
    byWilayah[wid].revenue += paid;
    byWilayah[wid].invoice_count += 1;

    const prid = inv.Branch?.Provinsi?.id || 'other';
    byProvinsi[prid] = byProvinsi[prid] || { provinsi_id: prid, provinsi_name: inv.Branch?.Provinsi?.name || 'Lainnya', revenue: 0, invoice_count: 0 };
    byProvinsi[prid].revenue += paid;
    byProvinsi[prid].invoice_count += 1;

    const oid = inv.owner_id || 'none';
    byOwner[oid] = byOwner[oid] || { owner_id: oid, owner_name: inv.User?.company_name || inv.User?.name || 'Lainnya', revenue: 0, invoice_count: 0 };
    byOwner[oid].revenue += paid;
    byOwner[oid].invoice_count += 1;

    const issuedAt = inv.issued_at || inv.created_at;
    const periodKey = issuedAt ? `${new Date(issuedAt).getFullYear()}-${String(new Date(issuedAt).getMonth() + 1).padStart(2, '0')}` : 'unknown';
    byPeriod[periodKey] = byPeriod[periodKey] || { revenue: 0, invoice_count: 0 };
    byPeriod[periodKey].revenue += paid;
    byPeriod[periodKey].invoice_count += 1;

    const orderTotal = parseFloat(inv.Order?.total_amount || 0) || 1;
    const items = inv.Order?.OrderItems || [];
    if (product_type) {
      const matching = items.filter(i => (i.type || '').toLowerCase() === String(product_type).toLowerCase());
      if (matching.length) {
        const ratio = matching.reduce((s, i) => s + parseFloat(i.subtotal || 0), 0) / orderTotal;
        const alloc = paid * ratio;
        const t = (product_type || 'handling').toLowerCase();
        if (byProductType[t] !== undefined) byProductType[t] += alloc;
        else byProductType.handling += alloc;
      }
    } else {
      items.forEach(item => {
        const ratio = parseFloat(item.subtotal || 0) / orderTotal;
        const alloc = paid * ratio;
        const t = (item.type || 'handling').toLowerCase();
        if (byProductType[t] !== undefined) byProductType[t] += alloc;
        else byProductType.handling += alloc;
      });
      if (!items.length) byProductType.handling += paid;
    }

    invoicesDetail.push({
      id: inv.id,
      invoice_number: inv.invoice_number,
      order_number: inv.Order?.order_number,
      owner_name: inv.User?.company_name || inv.User?.name,
      branch_name: inv.Branch?.name || inv.Branch?.code,
      total_amount: parseFloat(inv.total_amount || 0),
      paid_amount: paid,
      remaining_amount: parseFloat(inv.remaining_amount || 0),
      status: inv.status,
      order_status: inv.Order?.status,
      issued_at: inv.issued_at || inv.created_at
    });
  });

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
  const totalInvoices = invoicesDetail.length;
  const totalPages = Math.max(1, Math.ceil(totalInvoices / limitNum));
  const offset = (pageNum - 1) * limitNum;
  const paginatedInvoices = invoicesDetail.slice(offset, offset + limitNum);

  const byPeriodArr = Object.entries(byPeriod).map(([key, v]) => ({ period: key, revenue: v.revenue, invoice_count: v.invoice_count })).sort((a, b) => a.period.localeCompare(b.period));

  const periodDays = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - periodDays);

  const prevDateCondition = {
    [Op.or]: [
      { issued_at: { [Op.between]: [prevStart, prevEnd] } },
      { issued_at: { [Op.is]: null }, created_at: { [Op.between]: [prevStart, prevEnd] } }
    ]
  };
  const prevInvWhere = { [Op.and]: [prevDateCondition] };
  if (Object.keys(branchFilter).length) Object.assign(prevInvWhere, branchFilter);
  if (owner_id) prevInvWhere.owner_id = owner_id;
  if (status) {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) prevInvWhere.status = { [Op.in]: statuses };
  }
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    const orders = await Order.findAll({ where: { order_number: { [Op.iLike]: q } }, attributes: ['id'], raw: true });
    const users = await User.findAll({ where: { [Op.or]: [{ name: { [Op.iLike]: q } }, { company_name: { [Op.iLike]: q } }] }, attributes: ['id'], raw: true });
    const searchOr = [];
    if (orders.length) searchOr.push({ order_id: { [Op.in]: orders.map(o => o.id) } });
    if (users.length) searchOr.push({ owner_id: { [Op.in]: users.map(u => u.id) } });
    searchOr.push({ invoice_number: { [Op.iLike]: q } });
    prevInvWhere[Op.and].push({ [Op.or]: searchOr });
  }

  let prevRevenue = 0;
  let prevInvoiceCount = 0;
  try {
    const prevInvs = await Invoice.findAll({
      where: prevInvWhere,
      attributes: ['id', 'paid_amount'],
      include: [{ model: Order, as: 'Order', attributes: ['id'], required: true }]
    });
    prevRevenue = prevInvs.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0);
    prevInvoiceCount = prevInvs.length;
  } catch {
    prevRevenue = 0;
    prevInvoiceCount = 0;
  }

  const growthPercent = totalRevenue > 0 && prevRevenue > 0 ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : (totalRevenue > 0 && prevRevenue === 0 ? 100 : null);

  res.json({
    success: true,
    data: {
      period: { start: startDate, end: endDate },
      total_revenue: totalRevenue,
      by_branch: Object.values(byBranch),
      by_wilayah: Object.values(byWilayah),
      by_provinsi: Object.values(byProvinsi),
      by_owner: Object.values(byOwner),
      by_product_type: Object.entries(byProductType).map(([type, revenue]) => ({ type, revenue })),
      by_period: byPeriodArr,
      invoice_count: totalInvoices,
      invoices: paginatedInvoices,
      pagination: { total: totalInvoices, page: pageNum, limit: limitNum, totalPages },
      previous_period: {
        start: prevStart,
        end: prevEnd,
        revenue: prevRevenue,
        invoice_count: prevInvoiceCount,
        growth_percent: growthPercent
      }
    }
  });
  } catch (err) {
    req.log?.error?.(err);
    return res.status(200).json({ success: true, data: emptyFinancialReportPayload(startDate, endDate) });
  }
});

/**
 * GET /api/v1/accounting/export-financial-excel
 */
const exportFinancialExcel = asyncHandler(async (req, res) => {
  const { period, year, month, date_from, date_to, branch_id, provinsi_id, wilayah_id, owner_id, status, order_status, product_type, search, min_amount, max_amount } = req.query;
  const { startDate, endDate } = buildFinancialReportDateRange(period, year, month, date_from, date_to);

  const invWhere = {};
  const branchFilter = await resolveBranchFilter(branch_id, provinsi_id, wilayah_id, req.user);
  if (Object.keys(branchFilter).length) Object.assign(invWhere, branchFilter);
  if (owner_id) invWhere.owner_id = owner_id;
  if (status) {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) invWhere.status = { [Op.in]: statuses };
  }
  if (min_amount != null && min_amount !== '') invWhere.paid_amount = { ...(invWhere.paid_amount || {}), [Op.gte]: parseFloat(min_amount) };
  if (max_amount != null && max_amount !== '') invWhere.paid_amount = { ...(invWhere.paid_amount || {}), [Op.lte]: parseFloat(max_amount) };
  const dateCondition = {
    [Op.or]: [
      { issued_at: { [Op.between]: [startDate, endDate] } },
      { issued_at: { [Op.is]: null }, created_at: { [Op.between]: [startDate, endDate] } }
    ]
  };
  invWhere[Op.and] = [...(invWhere[Op.and] || []), dateCondition];

  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    const orders = await Order.findAll({ where: { order_number: { [Op.iLike]: q } }, attributes: ['id'], raw: true });
    const users = await User.findAll({ where: { [Op.or]: [{ name: { [Op.iLike]: q } }, { company_name: { [Op.iLike]: q } }] }, attributes: ['id'], raw: true });
    const searchOr = [];
    if (orders.length) searchOr.push({ order_id: { [Op.in]: orders.map(o => o.id) } });
    if (users.length) searchOr.push({ owner_id: { [Op.in]: users.map(u => u.id) } });
    searchOr.push({ invoice_number: { [Op.iLike]: q } });
    invWhere[Op.and].push({ [Op.or]: searchOr });
  }

  const orderWhere = order_status ? { status: { [Op.in]: String(order_status).split(',').map(s => s.trim()).filter(Boolean) } } : undefined;
  const orderItemInclude = { model: OrderItem, as: 'OrderItems', required: false };
  if (product_type) {
    orderItemInclude.where = { type: { [Op.iLike]: String(product_type).trim() } };
    orderItemInclude.required = true;
  }

  const branchIncludeExport = {
    model: Branch,
    as: 'Branch',
    attributes: ['id', 'code', 'name', 'provinsi_id'],
    required: false,
    include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'wilayah_id'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'] }] }]
  };

  const invoices = await Invoice.findAll({
    where: invWhere,
    include: [
      branchIncludeExport,
      { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] },
      { model: Order, as: 'Order', required: true, where: orderWhere, include: [orderItemInclude] }
    ]
  });

  let totalRevenue = 0;
  const byBranch = {};
  const byWilayah = {};
  const byProvinsi = {};
  const byOwner = {};
  const byProductType = { hotel: 0, visa: 0, ticket: 0, bus: 0, handling: 0 };
  invoices.forEach(inv => {
    const paid = parseFloat(inv.paid_amount || 0);
    totalRevenue += paid;
    const bid = inv.branch_id || 'none';
    byBranch[bid] = byBranch[bid] || { branch_id: bid, branch_name: inv.Branch?.name || 'Lainnya', revenue: 0 };
    byBranch[bid].revenue += paid;
    const wid = inv.Branch?.Provinsi?.Wilayah?.id || 'other';
    byWilayah[wid] = byWilayah[wid] || { wilayah_name: inv.Branch?.Provinsi?.Wilayah?.name || 'Lainnya', revenue: 0 };
    byWilayah[wid].revenue += paid;
    const prid = inv.Branch?.Provinsi?.id || 'other';
    byProvinsi[prid] = byProvinsi[prid] || { provinsi_name: inv.Branch?.Provinsi?.name || 'Lainnya', revenue: 0 };
    byProvinsi[prid].revenue += paid;
    const oid = inv.owner_id || 'none';
    byOwner[oid] = byOwner[oid] || { owner_id: oid, owner_name: inv.User?.company_name || inv.User?.name || 'Lainnya', revenue: 0 };
    byOwner[oid].revenue += paid;
    const orderTotal = parseFloat(inv.Order?.total_amount || 0) || 1;
    (inv.Order?.OrderItems || []).forEach(item => {
      const ratio = parseFloat(item.subtotal || 0) / orderTotal;
      const alloc = paid * ratio;
      const t = (item.type || 'handling').toLowerCase();
      if (byProductType[t] !== undefined) byProductType[t] += alloc;
      else byProductType.handling += alloc;
    });
    if (!inv.Order?.OrderItems?.length) byProductType.handling += paid;
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Laporan Keuangan', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [{ header: 'Metric', width: 30 }, { header: 'Nilai', width: 20 }];
  sheet.getRow(1).font = { bold: true };
  sheet.addRows([
    ['Periode', `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`],
    ['Total Pendapatan', totalRevenue],
    ['Jumlah Invoice', invoices.length],
    ['', ''],
    ['Per Wilayah', '']
  ]);
  Object.values(byWilayah).forEach(w => sheet.addRow([w.wilayah_name, w.revenue]));
  sheet.addRows(['', '', ['Per Provinsi', '']]);
  Object.values(byProvinsi).forEach(p => sheet.addRow([p.provinsi_name, p.revenue]));
  sheet.addRows(['', '', ['Per Cabang', '']]);
  Object.values(byBranch).forEach(b => sheet.addRow([b.branch_name, b.revenue]));
  sheet.addRows(['', '', ['Per Owner', '']]);
  Object.values(byOwner).forEach(b => sheet.addRow([b.owner_name, b.revenue]));
  sheet.addRows(['', '', ['Per Jenis Produk', '']]);
  Object.entries(byProductType).forEach(([k, v]) => sheet.addRow([k.charAt(0).toUpperCase() + k.slice(1), v]));

  const buf = await workbook.xlsx.writeBuffer();
  const now = new Date();
  const filename = `laporan-keuangan-${now.toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buf));
});

/**
 * GET /api/v1/accounting/export-financial-pdf
 */
const exportFinancialPdf = asyncHandler(async (req, res) => {
  const { period, year, month, date_from, date_to, branch_id, provinsi_id, wilayah_id, owner_id, status, order_status, product_type, search, min_amount, max_amount } = req.query;
  const { startDate, endDate } = buildFinancialReportDateRange(period, year, month, date_from, date_to);

  const invWhere = {};
  const branchFilter = await resolveBranchFilter(branch_id, provinsi_id, wilayah_id, req.user);
  if (Object.keys(branchFilter).length) Object.assign(invWhere, branchFilter);
  if (owner_id) invWhere.owner_id = owner_id;
  if (status) {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length) invWhere.status = { [Op.in]: statuses };
  }
  if (min_amount != null && min_amount !== '') invWhere.paid_amount = { ...(invWhere.paid_amount || {}), [Op.gte]: parseFloat(min_amount) };
  if (max_amount != null && max_amount !== '') invWhere.paid_amount = { ...(invWhere.paid_amount || {}), [Op.lte]: parseFloat(max_amount) };
  const dateCondition = {
    [Op.or]: [
      { issued_at: { [Op.between]: [startDate, endDate] } },
      { issued_at: { [Op.is]: null }, created_at: { [Op.between]: [startDate, endDate] } }
    ]
  };
  invWhere[Op.and] = [...(invWhere[Op.and] || []), dateCondition];

  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    const orders = await Order.findAll({ where: { order_number: { [Op.iLike]: q } }, attributes: ['id'], raw: true });
    const users = await User.findAll({ where: { [Op.or]: [{ name: { [Op.iLike]: q } }, { company_name: { [Op.iLike]: q } }] }, attributes: ['id'], raw: true });
    const searchOr = [];
    if (orders.length) searchOr.push({ order_id: { [Op.in]: orders.map(o => o.id) } });
    if (users.length) searchOr.push({ owner_id: { [Op.in]: users.map(u => u.id) } });
    searchOr.push({ invoice_number: { [Op.iLike]: q } });
    invWhere[Op.and].push({ [Op.or]: searchOr });
  }

  const orderWhere = order_status ? { status: { [Op.in]: String(order_status).split(',').map(s => s.trim()).filter(Boolean) } } : undefined;
  const orderItemInclude = { model: OrderItem, as: 'OrderItems', required: false };
  if (product_type) {
    orderItemInclude.where = { type: { [Op.iLike]: String(product_type).trim() } };
    orderItemInclude.required = true;
  }

  const branchIncludePdf = {
    model: Branch,
    as: 'Branch',
    attributes: ['id', 'code', 'name', 'provinsi_id'],
    required: false,
    include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'wilayah_id'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'] }] }]
  };

  const invoices = await Invoice.findAll({
    where: invWhere,
    include: [
      branchIncludePdf,
      { model: User, as: 'User', attributes: ['id', 'name', 'company_name'] },
      { model: Order, as: 'Order', required: true, where: orderWhere, include: [orderItemInclude] }
    ]
  });

  let totalRevenue = 0;
  const byBranch = {};
  const byWilayah = {};
  const byProvinsi = {};
  const byOwner = {};
  const byProductType = { hotel: 0, visa: 0, ticket: 0, bus: 0, handling: 0 };
  invoices.forEach(inv => {
    const paid = parseFloat(inv.paid_amount || 0);
    totalRevenue += paid;
    const bid = inv.branch_id || 'none';
    byBranch[bid] = byBranch[bid] || { branch_name: inv.Branch?.name || 'Lainnya', revenue: 0 };
    byBranch[bid].revenue += paid;
    const wid = inv.Branch?.Provinsi?.Wilayah?.id || 'other';
    byWilayah[wid] = byWilayah[wid] || { wilayah_name: inv.Branch?.Provinsi?.Wilayah?.name || 'Lainnya', revenue: 0 };
    byWilayah[wid].revenue += paid;
    const prid = inv.Branch?.Provinsi?.id || 'other';
    byProvinsi[prid] = byProvinsi[prid] || { provinsi_name: inv.Branch?.Provinsi?.name || 'Lainnya', revenue: 0 };
    byProvinsi[prid].revenue += paid;
    const oid = inv.owner_id || 'none';
    byOwner[oid] = byOwner[oid] || { owner_name: inv.User?.company_name || inv.User?.name || 'Lainnya', revenue: 0 };
    byOwner[oid].revenue += paid;
    const orderTotal = parseFloat(inv.Order?.total_amount || 0) || 1;
    (inv.Order?.OrderItems || []).forEach(item => {
      const ratio = parseFloat(item.subtotal || 0) / orderTotal;
      const alloc = paid * ratio;
      const t = (item.type || 'handling').toLowerCase();
      if (byProductType[t] !== undefined) byProductType[t] += alloc;
      else byProductType.handling += alloc;
    });
    if (!inv.Order?.OrderItems?.length) byProductType.handling += paid;
  });

  const doc = new PDFDocument({ margin: 50 });
  const now = new Date();
  const filename = `laporan-keuangan-${now.toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(16).text('Laporan Keuangan', { align: 'center' });
  doc.fontSize(9).text(`Periode: ${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}  |  Generated: ${now.toLocaleString('id-ID')}`, { align: 'center' });
  doc.moveDown(1.5);
  doc.fontSize(10).text(`Total Pendapatan: Rp ${totalRevenue.toLocaleString('id-ID')}`);
  doc.text(`Jumlah Invoice: ${invoices.length}`);
  doc.moveDown(0.5);
  doc.text('Per Wilayah:');
  Object.values(byWilayah).forEach(w => doc.text(`  ${w.wilayah_name}: Rp ${w.revenue.toLocaleString('id-ID')}`));
  doc.moveDown(0.5);
  doc.text('Per Provinsi:');
  Object.values(byProvinsi).forEach(p => doc.text(`  ${p.provinsi_name}: Rp ${p.revenue.toLocaleString('id-ID')}`));
  doc.moveDown(0.5);
  doc.text('Per Cabang:');
  Object.values(byBranch).forEach(b => doc.text(`  ${b.branch_name}: Rp ${b.revenue.toLocaleString('id-ID')}`));
  doc.moveDown(0.5);
  doc.text('Per Owner:');
  Object.values(byOwner).forEach(b => doc.text(`  ${b.owner_name}: Rp ${b.revenue.toLocaleString('id-ID')}`));
  doc.moveDown(0.5);
  doc.text('Per Jenis Produk:');
  Object.entries(byProductType).forEach(([k, v]) => doc.text(`  ${k.charAt(0).toUpperCase() + k.slice(1)}: Rp ${v.toLocaleString('id-ID')}`));
  doc.end();
});

/**
 * POST /api/v1/accounting/payments/:id/reconcile
 * Tandai bukti pembayaran sudah direkonsiliasi (rekonsiliasi bank).
 */
const reconcilePayment = asyncHandler(async (req, res) => {
  const proof = await PaymentProof.findByPk(req.params.id, { include: [{ model: Invoice, as: 'Invoice' }] });
  if (!proof) return res.status(404).json({ success: false, message: 'Bukti pembayaran tidak ditemukan' });
  await proof.update({ reconciled_at: new Date(), reconciled_by: req.user.id });
  res.json({ success: true, data: proof, message: 'Berhasil ditandai rekonsiliasi' });
});

/**
 * GET /api/v1/accounting/chart-of-accounts
 * Daftar Chart of Accounts (COA) multi-level.
 * Filter: active_only (true|false), account_type, level, is_header (true|false), parent_id, search (kode/nama)
 */
const getChartOfAccounts = asyncHandler(async (req, res) => {
  const { active_only, account_type, level, is_header, parent_id, search } = req.query;
  const where = {};
  if (active_only === 'true') where.is_active = true;
  else if (active_only === 'false') where.is_active = false;
  if (account_type) where.account_type = account_type;
  if (level != null && level !== '') where.level = parseInt(level, 10);
  if (is_header === 'true') where.is_header = true;
  else if (is_header === 'false') where.is_header = false;
  if (parent_id !== undefined && parent_id !== '') {
    if (parent_id === 'null' || parent_id === 'root') where.parent_id = null;
    else where.parent_id = parent_id;
  }
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [
      { code: { [Op.iLike]: q } },
      { name: { [Op.iLike]: q } }
    ];
  }

  const accounts = await ChartOfAccount.findAll({
    where,
    order: [['sort_order', 'ASC'], ['code', 'ASC']]
  });
  res.json({ success: true, data: accounts });
});

/**
 * GET /api/v1/accounting/chart-of-accounts/:id
 */
const getChartOfAccountById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const account = await ChartOfAccount.findByPk(id, {
    include: [{ model: ChartOfAccount, as: 'Parent', attributes: ['id', 'code', 'name'] }]
  });
  if (!account) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });
  res.json({ success: true, data: account });
});

/**
 * POST /api/v1/accounting/chart-of-accounts
 * Buat akun baru. Level dihitung dari parent (parent level + 1) jika parent_id ada.
 */
const createChartOfAccount = asyncHandler(async (req, res) => {
  const { code, name, account_type, parent_id, is_header, currency, sort_order } = req.body;
  if (!code || !name || !account_type) {
    return res.status(400).json({ success: false, message: 'code, name, account_type wajib' });
  }
  const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
  if (!validTypes.includes(String(account_type).toLowerCase())) {
    return res.status(400).json({ success: false, message: 'account_type tidak valid' });
  }
  const existing = await ChartOfAccount.findOne({ where: { code: String(code).trim() } });
  if (existing) return res.status(400).json({ success: false, message: 'Kode akun sudah ada' });

  let level = 1;
  let parentId = parent_id || null;
  if (parent_id) {
    const parent = await ChartOfAccount.findByPk(parent_id);
    if (!parent) return res.status(400).json({ success: false, message: 'Parent akun tidak ditemukan' });
    level = (parent.level || 1) + 1;
  }

  const account = await ChartOfAccount.create({
    code: String(code).trim(),
    name: String(name).trim(),
    account_type: String(account_type).toLowerCase(),
    parent_id: parentId,
    level,
    is_header: !!is_header,
    currency: (currency && String(currency).toUpperCase()) || 'IDR',
    is_active: true,
    sort_order: sort_order != null ? parseInt(sort_order, 10) : 0,
    created_by: req.user?.id,
    updated_by: req.user?.id
  });
  res.status(201).json({ success: true, data: account, message: 'Akun berhasil dibuat' });
});

/**
 * PATCH /api/v1/accounting/chart-of-accounts/:id
 * Update akun (nama, tipe, is_header, currency, sort_order, is_active). Kode dan parent_id tidak diubah lewat sini.
 */
const updateChartOfAccount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, account_type, is_header, currency, sort_order, is_active } = req.body;
  const account = await ChartOfAccount.findByPk(id);
  if (!account) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });

  const updates = { updated_by: req.user?.id };
  if (name !== undefined) updates.name = String(name).trim();
  if (account_type !== undefined) {
    const validTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
    if (!validTypes.includes(String(account_type).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'account_type tidak valid' });
    }
    updates.account_type = String(account_type).toLowerCase();
  }
  if (is_header !== undefined) updates.is_header = !!is_header;
  if (currency !== undefined) updates.currency = String(currency).toUpperCase() || 'IDR';
  if (sort_order !== undefined) updates.sort_order = parseInt(sort_order, 10) || 0;
  if (is_active !== undefined) updates.is_active = !!is_active;

  await account.update(updates);
  res.json({ success: true, data: account, message: 'Akun berhasil diupdate' });
});

/**
 * DELETE /api/v1/accounting/chart-of-accounts/:id
 * Hapus akun. Ditolak jika dipakai di mapping atau jurnal. Anak-anak di-set parent_id = null.
 */
const deleteChartOfAccount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const account = await ChartOfAccount.findByPk(id);
  if (!account) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });

  const usedInDebit = await AccountMapping.count({ where: { debit_account_id: id } });
  const usedInCredit = await AccountMapping.count({ where: { credit_account_id: id } });
  const usedInJournal = await JournalEntryLine.count({ where: { account_id: id } });
  if (usedInDebit > 0 || usedInCredit > 0 || usedInJournal > 0) {
    return res.status(400).json({
      success: false,
      message: 'Akun dipakai di mapping atau jurnal. Nonaktifkan saja (ubah status ke Nonaktif).'
    });
  }

  await ChartOfAccount.update({ parent_id: null }, { where: { parent_id: id } });
  await account.destroy();
  res.json({ success: true, message: 'Akun berhasil dihapus' });
});

/**
 * GET /api/v1/accounting/fiscal-years
 * Daftar tahun fiskal. Filter: is_closed (true|false), search (code/name)
 */
const getFiscalYears = asyncHandler(async (req, res) => {
  const { is_closed, search } = req.query;
  const where = {};
  if (is_closed === 'true') where.is_closed = true;
  else if (is_closed === 'false') where.is_closed = false;
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [
      { code: { [Op.iLike]: q } },
      { name: { [Op.iLike]: q } }
    ];
  }

  const years = await AccountingFiscalYear.findAll({
    where,
    order: [['start_date', 'DESC']],
    include: [{ model: AccountingPeriod, as: 'Periods', order: [['period_number', 'ASC']] }]
  });
  res.json({ success: true, data: years });
});

/**
 * GET /api/v1/accounting/fiscal-years/:id
 * Satu tahun fiskal dengan periode
 */
const getFiscalYearById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const year = await AccountingFiscalYear.findByPk(id, {
    include: [{ model: AccountingPeriod, as: 'Periods', order: [['period_number', 'ASC']] }]
  });
  if (!year) return res.status(404).json({ success: false, message: 'Tahun fiskal tidak ditemukan' });
  res.json({ success: true, data: year });
});

/**
 * POST /api/v1/accounting/fiscal-years
 * Buat tahun fiskal baru + 12 periode bulanan
 */
const createFiscalYear = asyncHandler(async (req, res) => {
  const { code, name, start_date, end_date } = req.body;
  if (!code || !name || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: 'code, name, start_date, end_date wajib' });
  }
  const start = new Date(start_date);
  const end = new Date(end_date);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return res.status(400).json({ success: false, message: 'Tanggal tidak valid' });
  }
  const existing = await AccountingFiscalYear.findOne({ where: { code: String(code).trim() } });
  if (existing) {
    return res.status(400).json({ success: false, message: 'Kode tahun fiskal sudah ada' });
  }

  const year = await AccountingFiscalYear.create({
    code: String(code).trim(),
    name: String(name).trim(),
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    is_closed: false
  });

  const periods = [];
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  let periodNumber = 1;
  for (let y = startYear; y <= endYear; y++) {
    const mStart = y === startYear ? startMonth : 0;
    const mEnd = y === endYear ? endMonth : 11;
    for (let m = mStart; m <= mEnd; m++) {
      const pStart = new Date(y, m, 1);
      const pEnd = new Date(y, m + 1, 0);
      periods.push({
        fiscal_year_id: year.id,
        period_number: periodNumber++,
        start_date: pStart.toISOString().slice(0, 10),
        end_date: pEnd.toISOString().slice(0, 10),
        is_locked: false
      });
    }
  }
  await AccountingPeriod.bulkCreate(periods);

  const withPeriods = await AccountingFiscalYear.findByPk(year.id, {
    include: [{ model: AccountingPeriod, as: 'Periods', order: [['period_number', 'ASC']] }]
  });
  res.status(201).json({ success: true, data: withPeriods, message: 'Tahun fiskal dibuat' });
});

/**
 * POST /api/v1/accounting/fiscal-years/:id/lock-all
 * Kunci semua periode dalam tahun fiskal
 */
const lockAllPeriods = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const year = await AccountingFiscalYear.findByPk(id);
  if (!year) return res.status(404).json({ success: false, message: 'Tahun fiskal tidak ditemukan' });
  if (year.is_closed) return res.status(400).json({ success: false, message: 'Tahun fiskal sudah ditutup' });

  const [updated] = await AccountingPeriod.update(
    { is_locked: true, locked_at: new Date(), locked_by: req.user?.id },
    { where: { fiscal_year_id: id, is_locked: false } }
  );
  const withPeriods = await AccountingFiscalYear.findByPk(id, {
    include: [{ model: AccountingPeriod, as: 'Periods', order: [['period_number', 'ASC']] }]
  });
  res.json({ success: true, data: withPeriods, message: `${updated || 0} periode dikunci` });
});

/**
 * POST /api/v1/accounting/fiscal-years/:id/close
 * Tutup tahun fiskal (is_closed = true). Semua periode harus terkunci dulu.
 */
const closeFiscalYear = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const year = await AccountingFiscalYear.findByPk(id);
  if (!year) return res.status(404).json({ success: false, message: 'Tahun fiskal tidak ditemukan' });
  if (year.is_closed) return res.status(400).json({ success: false, message: 'Tahun fiskal sudah ditutup' });

  const openPeriods = await AccountingPeriod.count({ where: { fiscal_year_id: id, is_locked: false } });
  if (openPeriods > 0) {
    return res.status(400).json({ success: false, message: 'Semua periode harus dikunci dulu sebelum menutup tahun' });
  }

  await year.update({
    is_closed: true,
    closed_at: new Date(),
    closed_by: req.user?.id
  });
  const updated = await AccountingFiscalYear.findByPk(id, {
    include: [{ model: AccountingPeriod, as: 'Periods', order: [['period_number', 'ASC']] }]
  });
  res.json({ success: true, data: updated, message: 'Tahun fiskal ditutup' });
});

/**
 * GET /api/v1/accounting/periods
 * Daftar periode akuntansi. Filter: fiscal_year_id, is_locked (true|false)
 */
const getAccountingPeriods = asyncHandler(async (req, res) => {
  const { fiscal_year_id, is_locked } = req.query;
  const where = {};
  if (fiscal_year_id) where.fiscal_year_id = fiscal_year_id;
  if (is_locked === 'true') where.is_locked = true;
  else if (is_locked === 'false') where.is_locked = false;

  const periods = await AccountingPeriod.findAll({
    where,
    include: [{ model: AccountingFiscalYear, as: 'FiscalYear', attributes: ['id', 'code', 'name', 'is_closed'] }],
    order: [['period_number', 'ASC']]
  });
  res.json({ success: true, data: periods });
});

/**
 * PUT /api/v1/accounting/periods/:id/lock
 * Kunci periode (tidak bisa posting jurnal di periode ini)
 */
const lockPeriod = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const period = await AccountingPeriod.findByPk(id, { include: [{ model: AccountingFiscalYear, as: 'FiscalYear' }] });
  if (!period) return res.status(404).json({ success: false, message: 'Periode tidak ditemukan' });
  if (period.is_locked) return res.status(400).json({ success: false, message: 'Periode sudah terkunci' });
  if (period.FiscalYear?.is_closed) return res.status(400).json({ success: false, message: 'Tahun fiskal sudah ditutup' });

  await period.update({
    is_locked: true,
    locked_at: new Date(),
    locked_by: req.user?.id
  });
  const updated = await AccountingPeriod.findByPk(id, { include: [{ model: AccountingFiscalYear, as: 'FiscalYear', attributes: ['id', 'code', 'name'] }] });
  res.json({ success: true, data: updated, message: 'Periode dikunci' });
});

/**
 * PUT /api/v1/accounting/periods/:id/unlock
 * Buka kunci periode (hanya super_admin / admin_pusat jika perlu)
 */
const unlockPeriod = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const period = await AccountingPeriod.findByPk(id, { include: [{ model: AccountingFiscalYear, as: 'FiscalYear' }] });
  if (!period) return res.status(404).json({ success: false, message: 'Periode tidak ditemukan' });
  if (!period.is_locked) return res.status(400).json({ success: false, message: 'Periode tidak terkunci' });
  if (period.FiscalYear?.is_closed) return res.status(400).json({ success: false, message: 'Tahun fiskal sudah ditutup, tidak bisa membuka periode' });

  await period.update({
    is_locked: false,
    locked_at: null,
    locked_by: null
  });
  const updated = await AccountingPeriod.findByPk(id, { include: [{ model: AccountingFiscalYear, as: 'FiscalYear', attributes: ['id', 'code', 'name'] }] });
  res.json({ success: true, data: updated, message: 'Periode dibuka' });
});

/**
 * GET /api/v1/accounting/account-mappings
 * Mapping akun otomatis per jenis transaksi
 */
const getAccountMappings = asyncHandler(async (req, res) => {
  const mappings = await AccountMapping.findAll({
    where: { is_active: true },
    include: [
      { model: ChartOfAccount, as: 'DebitAccount', attributes: ['id', 'code', 'name'] },
      { model: ChartOfAccount, as: 'CreditAccount', attributes: ['id', 'code', 'name'] }
    ]
  });
  res.json({ success: true, data: mappings });
});

/**
 * GET /api/v1/accounting/dashboard-kpi
 * Dashboard eksekutif: revenue per wilayah, outstanding AR/AP, margin, cash flow
 */
const getDashboardKpi = asyncHandler(async (req, res) => {
  const { branch_id, wilayah_id, date_from, date_to } = req.query;
  const invWhere = {};
  if (branch_id) invWhere.branch_id = branch_id;
  if (date_from || date_to) {
    invWhere.created_at = {};
    if (date_from) invWhere.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      invWhere.created_at[Op.lte] = d;
    }
  }

  const invoices = await Invoice.findAll({
    where: invWhere,
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'] }] }] },
      { model: Order, as: 'Order', attributes: ['id', 'order_number'] }
    ]
  });

  let totalRevenue = 0;
  let totalReceivable = 0;
  const byWilayah = {};
  const byProduct = { hotel: 0, visa: 0, ticket: 0, bus: 0, handling: 0 };

  invoices.forEach(inv => {
    const j = inv.toJSON();
    const paid = parseFloat(j.paid_amount || 0);
    const remaining = parseFloat(j.remaining_amount || 0);
    const total = parseFloat(j.total_amount || 0);
    if (!['draft', 'canceled', 'cancelled'].includes(j.status)) {
      totalRevenue += paid;
      totalReceivable += remaining;
    }
    const wid = j.Branch?.Provinsi?.Wilayah?.id || 'other';
    if (!byWilayah[wid]) byWilayah[wid] = { name: j.Branch?.Provinsi?.Wilayah?.name || 'Lainnya', revenue: 0, receivable: 0 };
    byWilayah[wid].revenue += paid;
    byWilayah[wid].receivable += remaining;
  });

  const branches = await Branch.findAll({ where: { is_active: true }, attributes: ['id', 'code', 'name'] });

  res.json({
    success: true,
    data: {
      total_revenue: totalRevenue,
      total_receivable: totalReceivable,
      by_wilayah: Object.entries(byWilayah).map(([id, v]) => ({ wilayah_id: id, ...v })),
      by_product: byProduct,
      branches
    }
  });
});

module.exports = {
  getDashboard,
  listAccountingOwners,
  getAgingReport,
  exportAgingExcel,
  exportAgingPdf,
  getPaymentsList,
  listInvoices,
  listOrders,
  getFinancialReport,
  exportFinancialExcel,
  exportFinancialPdf,
  reconcilePayment,
  getChartOfAccounts,
  getChartOfAccountById,
  createChartOfAccount,
  updateChartOfAccount,
  deleteChartOfAccount,
  getFiscalYears,
  getFiscalYearById,
  createFiscalYear,
  lockAllPeriods,
  closeFiscalYear,
  getAccountingPeriods,
  lockPeriod,
  unlockPeriod,
  getAccountMappings,
  getDashboardKpi
};
