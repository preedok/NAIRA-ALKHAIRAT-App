const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const {
  Order,
  OrderItem,
  Invoice,
  User,
  Branch,
  Provinsi,
  Wilayah,
  SystemLog
} = require('../models');
const { ORDER_ITEM_TYPE } = require('../constants');

/** Build date range from query: date_from, date_to OR period (today|week|month|quarter|year) */
function buildDateRange(query) {
  const { date_from, date_to, period } = query || {};
  if (date_from || date_to) {
    const start = date_from ? new Date(date_from) : new Date(0);
    let end = date_to ? new Date(date_to) : new Date();
    if (date_to) end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const now = new Date();
  if (!period || period === 'all') return null;
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end: now };
  }
  if (period === 'week') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end: now };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: now };
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3) + 1;
    const start = new Date(now.getFullYear(), (q - 1) * 3, 1);
    const end = new Date(now.getFullYear(), q * 3, 0);
    return { start, end };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start, end: now };
  }
  return null;
}

/** Build branch_id filter from branch_id, provinsi_id, wilayah_id */
async function getBranchIdsFilter(branch_id, provinsi_id, wilayah_id) {
  if (branch_id) return [branch_id];
  const where = { is_active: true };
  if (provinsi_id) where.provinsi_id = provinsi_id;
  const opts = { where, attributes: ['id'] };
  if (wilayah_id) {
    opts.include = [{ model: Provinsi, as: 'Provinsi', attributes: [], required: true, where: { wilayah_id } }];
  }
  const rows = await Branch.findAll(opts);
  return rows.map((r) => r.id);
}

/**
 * GET /api/v1/reports/filters
 * Returns branches, wilayah, provinsi for filter dropdowns.
 */
const getReportFilters = asyncHandler(async (req, res) => {
  const [branches, wilayahList, provinsiList] = await Promise.all([
    Branch.findAll({ where: { is_active: true }, order: [['code', 'ASC']], attributes: ['id', 'code', 'name', 'provinsi_id'] }),
    Wilayah.findAll({ order: [['name', 'ASC']], attributes: ['id', 'name'] }),
    Provinsi.findAll({ order: [['name', 'ASC']], attributes: ['id', 'name', 'kode', 'wilayah_id'], include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] })
  ]);
  res.json({
    success: true,
    data: {
      branches,
      wilayah: wilayahList,
      provinsi: provinsiList
    }
  });
});

/**
 * GET /api/v1/reports/analytics
 * Query: report_type (revenue|orders|partners|jamaah|financial|logs), date_from, date_to, period, branch_id, wilayah_id, provinsi_id, group_by (day|week|month|quarter|year), role (for partners), page, limit, source (logs), level (logs)
 * Returns summary, series (time), breakdown, rows, pagination.
 */
const getAnalytics = asyncHandler(async (req, res) => {
  const {
    report_type = 'revenue',
    date_from,
    date_to,
    period = 'month',
    branch_id,
    wilayah_id,
    provinsi_id,
    group_by = 'month',
    role,
    page = 1,
    limit = 20,
    source,
    level
  } = req.query;

  const dateRange = buildDateRange({ date_from, date_to, period });
  const branchIds = await getBranchIdsFilter(branch_id, provinsi_id, wilayah_id);
  const hasLocationFilter = !!(branch_id || provinsi_id || wilayah_id);

  const orderWhere = {};
  const invoiceWhere = {};
  if (hasLocationFilter && branchIds.length === 0) {
    orderWhere.branch_id = { [Op.in]: [] };
    invoiceWhere.branch_id = { [Op.in]: [] };
  } else if (branchIds.length > 0) {
    orderWhere.branch_id = branch_id ? branch_id : { [Op.in]: branchIds };
    invoiceWhere.branch_id = branch_id ? branch_id : { [Op.in]: branchIds };
  }
  if (dateRange) {
    orderWhere.created_at = { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end };
    invoiceWhere.created_at = { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end };
  }
  const revenueOrderWhere = { ...orderWhere, status: { [Op.notIn]: ['draft', 'cancelled'] } };

  if (report_type === 'logs') {
    const where = {};
    if (source) where.source = source;
    if (level) where.level = level;
    if (dateRange) where.created_at = { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end };
    const logLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
    const logs = await SystemLog.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: logLimit,
      raw: true
    });
    const total = await SystemLog.count({ where });
    return res.json({
      success: true,
      data: {
        report_type: 'logs',
        summary: { total_logs: total },
        series: [],
        breakdown: { by_source: {}, by_level: {} },
        rows: logs,
        pagination: { page: 1, limit: logLimit, total, totalPages: Math.ceil(total / logLimit) }
      }
    });
  }

  if (report_type === 'financial') {
    const invWhere = {};
    if (hasLocationFilter && branchIds.length === 0) invWhere.branch_id = { [Op.in]: [] };
    else if (branchIds.length > 0) invWhere.branch_id = branch_id || { [Op.in]: branchIds };
    if (dateRange) {
      invWhere.issued_at = { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end };
    }
    const [invoices, branchList] = await Promise.all([
      Invoice.findAll({
        where: invWhere,
        attributes: ['id', 'invoice_number', 'total_amount', 'paid_amount', 'remaining_amount', 'status', 'branch_id', 'owner_id', 'issued_at'],
        include: [
          { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'provinsi_id'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
          { model: User, as: 'User', attributes: ['id', 'name'], required: false }
        ],
        raw: false
      }),
      Branch.findAll({ where: { is_active: true }, attributes: ['id', 'code', 'name'], raw: true })
    ]);
    let totalRevenue = 0;
    const byBranch = {};
    const byStatus = {};
    const byWilayah = {};
    const byProvinsi = {};
    const byOwner = {};
    (invoices || []).forEach((inv) => {
      const j = inv.toJSON ? inv.toJSON() : inv;
      const rev = parseFloat(j.paid_amount || 0) || 0;
      totalRevenue += rev;
      byStatus[j.status] = (byStatus[j.status] || 0) + 1;
      const bid = j.branch_id;
      if (bid) {
        byBranch[bid] = byBranch[bid] || { branch_name: j.Branch?.name || bid, revenue: 0, invoice_count: 0 };
        byBranch[bid].revenue += rev;
        byBranch[bid].invoice_count += 1;
      }
      const provinsiId = j.Branch?.Provinsi?.id || j.Branch?.provinsi_id;
      const wilayahId = j.Branch?.Provinsi?.Wilayah?.id;
      if (provinsiId) {
        byProvinsi[provinsiId] = byProvinsi[provinsiId] || { provinsi_name: j.Branch?.Provinsi?.name || provinsiId, revenue: 0, invoice_count: 0 };
        byProvinsi[provinsiId].revenue += rev;
        byProvinsi[provinsiId].invoice_count += 1;
      }
      if (wilayahId) {
        byWilayah[wilayahId] = byWilayah[wilayahId] || { wilayah_name: j.Branch?.Provinsi?.Wilayah?.name || wilayahId, revenue: 0, invoice_count: 0 };
        byWilayah[wilayahId].revenue += rev;
        byWilayah[wilayahId].invoice_count += 1;
      }
      const oid = j.owner_id;
      if (oid) {
        byOwner[oid] = byOwner[oid] || { owner_name: j.User?.name || oid, revenue: 0, invoice_count: 0 };
        byOwner[oid].revenue += rev;
        byOwner[oid].invoice_count += 1;
      }
    });
    const pag = { page: parseInt(page, 10) || 1, limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)) };
    const start = (pag.page - 1) * pag.limit;
    const rows = (invoices || []).slice(start, start + pag.limit).map((inv) => {
      const j = inv.toJSON ? inv.toJSON() : inv;
      return {
        id: j.id,
        invoice_number: j.invoice_number,
        total_amount: parseFloat(j.total_amount || 0),
        paid_amount: parseFloat(j.paid_amount || 0),
        remaining_amount: parseFloat(j.remaining_amount || 0),
        status: j.status,
        branch_name: j.Branch?.name,
        owner_name: j.User?.name,
        issued_at: j.issued_at
      };
    });
    return res.json({
      success: true,
      data: {
        report_type: 'financial',
        period: dateRange ? { start: dateRange.start, end: dateRange.end } : null,
        summary: { total_revenue: totalRevenue, invoice_count: (invoices || []).length },
        series: [],
        breakdown: {
          by_branch: Object.entries(byBranch).map(([id, v]) => ({ branch_id: id, ...v })),
          by_status: byStatus,
          by_wilayah: Object.entries(byWilayah).map(([id, v]) => ({ wilayah_id: id, ...v })),
          by_provinsi: Object.entries(byProvinsi).map(([id, v]) => ({ provinsi_id: id, ...v })),
          by_owner: Object.entries(byOwner).map(([id, v]) => ({ owner_id: id, ...v }))
        },
        rows,
        pagination: { page: pag.page, limit: pag.limit, total: (invoices || []).length, totalPages: Math.ceil((invoices || []).length / pag.limit) }
      }
    });
  }

  const OrderItem = require('../models/OrderItem');
  const Product = require('../models/Product');
  const orders = await Order.findAll({
    where: Object.keys(orderWhere).length ? orderWhere : undefined,
    attributes: ['id', 'order_number', 'status', 'subtotal', 'discount', 'penalty_amount', 'total_amount', 'currency', 'total_jamaah', 'branch_id', 'owner_id', 'created_at', 'notes'],
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'provinsi_id'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: User, as: 'User', attributes: ['id', 'name', 'role', 'email', 'company_name'] },
      { model: OrderItem, as: 'OrderItems', attributes: ['id', 'type', 'quantity', 'unit_price', 'subtotal'], required: false, include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'], required: false }] }
    ],
    order: [['created_at', 'DESC']],
    limit: 500
  });

  let ownerFilter = null;
  if (role) {
    const usersWithRole = await User.findAll({ where: { role }, attributes: ['id'], raw: true });
    const ownerIds = usersWithRole.map((u) => u.id);
    if (ownerIds.length > 0) ownerFilter = ownerIds;
  }

  const filteredOrders = ownerFilter
    ? orders.filter((o) => {
        const j = o.toJSON ? o.toJSON() : o;
        return ownerFilter.includes(j.owner_id);
      })
    : orders;

  const totalOrders = filteredOrders.length;
  const totalRevenue = filteredOrders
    .filter((o) => {
      const j = o.toJSON ? o.toJSON() : o;
      return !['draft', 'cancelled'].includes(j.status);
    })
    .reduce((sum, o) => sum + parseFloat((o.toJSON ? o.toJSON() : o).total_amount || 0), 0);
  const totalJamaah = filteredOrders.reduce((sum, o) => sum + parseInt((o.toJSON ? o.toJSON() : o).total_jamaah || 0, 10), 0);

  const byStatus = {};
  const byBranch = {};
  const byWilayah = {};
  const byProvinsi = {};
  const byOwner = {};
  const byRole = {};
  filteredOrders.forEach((o) => {
    const j = o.toJSON ? o.toJSON() : o;
    byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    const bid = j.branch_id;
    if (bid) {
      byBranch[bid] = byBranch[bid] || { branch_name: j.Branch?.name || bid, code: j.Branch?.code, count: 0, revenue: 0, jamaah: 0 };
      byBranch[bid].count += 1;
      byBranch[bid].revenue += !['draft', 'cancelled'].includes(j.status) ? parseFloat(j.total_amount || 0) : 0;
      byBranch[bid].jamaah += parseInt(j.total_jamaah || 0, 10);
    }
    const r = j.User?.role || 'owner';
    byRole[r] = (byRole[r] || 0) + 1;
    const provinsiId = j.Branch?.Provinsi?.id || j.Branch?.provinsi_id;
    const wilayahId = j.Branch?.Provinsi?.Wilayah?.id;
    if (provinsiId) {
      byProvinsi[provinsiId] = byProvinsi[provinsiId] || { provinsi_name: j.Branch?.Provinsi?.name || provinsiId, count: 0, revenue: 0 };
      byProvinsi[provinsiId].count += 1;
      byProvinsi[provinsiId].revenue += !['draft', 'cancelled'].includes(j.status) ? parseFloat(j.total_amount || 0) : 0;
    }
    if (wilayahId) {
      byWilayah[wilayahId] = byWilayah[wilayahId] || { wilayah_name: j.Branch?.Provinsi?.Wilayah?.name || wilayahId, count: 0, revenue: 0 };
      byWilayah[wilayahId].count += 1;
      byWilayah[wilayahId].revenue += !['draft', 'cancelled'].includes(j.status) ? parseFloat(j.total_amount || 0) : 0;
    }
    const oid = j.owner_id;
    if (oid) {
      byOwner[oid] = byOwner[oid] || { owner_name: j.User?.name || oid, count: 0, revenue: 0 };
      byOwner[oid].count += 1;
      byOwner[oid].revenue += !['draft', 'cancelled'].includes(j.status) ? parseFloat(j.total_amount || 0) : 0;
    }
  });

  const series = [];
  if (dateRange && group_by) {
    const buckets = {};
    filteredOrders.forEach((o) => {
      const j = o.toJSON ? o.toJSON() : o;
      const d = new Date(j.created_at);
      let key;
      if (group_by === 'day') key = d.toISOString().slice(0, 10);
      else if (group_by === 'week') key = `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`;
      else if (group_by === 'month') key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      else if (group_by === 'quarter') key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
      else key = `${d.getFullYear()}`;
      if (!buckets[key]) buckets[key] = { count: 0, revenue: 0, jamaah: 0 };
      buckets[key].count += 1;
      buckets[key].revenue += !['draft', 'cancelled'].includes(j.status) ? parseFloat(j.total_amount || 0) : 0;
      buckets[key].jamaah += parseInt(j.total_jamaah || 0, 10);
    });
    series.push(...Object.entries(buckets).map(([period_key, v]) => ({ period: period_key, ...v })));
    series.sort((a, b) => (a.period < b.period ? -1 : 1));
  }

  const pag = { page: parseInt(page, 10) || 1, limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)) };
  const start = (pag.page - 1) * pag.limit;
  const rows = filteredOrders.slice(start, start + pag.limit).map((o) => {
    const j = o.toJSON ? o.toJSON() : o;
    const items = (j.OrderItems || []).map((item) => ({
      type: item.type,
      product_name: item.Product?.name || '-',
      quantity: parseInt(item.quantity || 0, 10),
      unit_price: parseFloat(item.unit_price || 0),
      subtotal: parseFloat(item.subtotal || 0)
    }));
    const itemTypes = [...new Set(items.map((i) => i.type))];
    return {
      id: j.id,
      order_number: j.order_number,
      status: j.status,
      subtotal: parseFloat(j.subtotal || 0),
      discount: parseFloat(j.discount || 0),
      penalty_amount: parseFloat(j.penalty_amount || 0),
      total_amount: parseFloat(j.total_amount || 0),
      currency: j.currency || 'IDR',
      total_jamaah: parseInt(j.total_jamaah || 0, 10),
      branch_id: j.branch_id,
      branch_name: j.Branch?.name,
      branch_code: j.Branch?.code,
      wilayah_id: j.Branch?.Provinsi?.Wilayah?.id,
      wilayah_name: j.Branch?.Provinsi?.Wilayah?.name,
      provinsi_id: j.Branch?.Provinsi?.id || j.Branch?.provinsi_id,
      provinsi_name: j.Branch?.Provinsi?.name,
      owner_id: j.owner_id,
      owner_name: j.User?.name,
      owner_email: j.User?.email,
      owner_company: j.User?.company_name,
      role: j.User?.role,
      order_items: items,
      item_types: itemTypes,
      item_count: items.length,
      notes: j.notes,
      created_at: j.created_at
    };
  });

  res.json({
    success: true,
    data: {
      report_type: report_type || 'revenue',
      period: dateRange ? { start: dateRange.start, end: dateRange.end } : null,
      summary: {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        total_jamaah: totalJamaah,
        total_invoices: report_type === 'revenue' ? await Invoice.count({ where: invoiceWhere }) : undefined
      },
      series,
      breakdown: {
        by_status: byStatus,
        by_branch: Object.entries(byBranch).map(([id, v]) => ({ branch_id: id, ...v })),
        by_wilayah: Object.entries(byWilayah).map(([id, v]) => ({ wilayah_id: id, ...v })),
        by_provinsi: Object.entries(byProvinsi).map(([id, v]) => ({ provinsi_id: id, ...v })),
        by_owner: Object.entries(byOwner).map(([id, v]) => ({ owner_id: id, ...v })),
        by_role: byRole
      },
      rows,
      pagination: { page: pag.page, limit: pag.limit, total: totalOrders, totalPages: Math.ceil(totalOrders / pag.limit) }
    }
  });
});

/**
 * GET /api/v1/reports/export-excel
 * Same query params as getAnalytics. Exports Excel.
 */
const exportReportExcel = asyncHandler(async (req, res) => {
  const { report_type = 'revenue', date_from, date_to, period = 'month', branch_id, wilayah_id, provinsi_id, role, source, level } = req.query;
  const dateRange = buildDateRange({ date_from, date_to, period });
  const branchIds = await getBranchIdsFilter(branch_id, provinsi_id, wilayah_id);
  const hasLocationFilter = !!(branch_id || provinsi_id || wilayah_id);

  const orderWhere = {};
  const invoiceWhere = {};
  if (hasLocationFilter && branchIds.length === 0) {
    orderWhere.branch_id = { [Op.in]: [] };
    invoiceWhere.branch_id = { [Op.in]: [] };
  } else if (branchIds.length > 0) {
    orderWhere.branch_id = branch_id || { [Op.in]: branchIds };
    invoiceWhere.branch_id = branch_id || { [Op.in]: branchIds };
  }
  if (dateRange) {
    orderWhere.created_at = { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end };
    invoiceWhere.created_at = { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end };
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bintang Global - Reports & Analytics';

  if (report_type === 'logs') {
    const where = {};
    if (source) where.source = source;
    if (level) where.level = level;
    if (dateRange) where.created_at = { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end };
    const logs = await SystemLog.findAll({ where, order: [['created_at', 'DESC']], limit: 3000, raw: true });
    const sheet = workbook.addWorksheet('System Logs', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'Waktu', width: 22 },
      { header: 'Sumber', width: 14 },
      { header: 'Level', width: 10 },
      { header: 'Pesan', width: 50 },
      { header: 'Meta', width: 28 }
    ];
    sheet.getRow(1).font = { bold: true };
    logs.forEach((log) => {
      sheet.addRow([
        log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '',
        log.source || '',
        log.level || '',
        log.message || '',
        log.meta ? JSON.stringify(log.meta) : ''
      ]);
    });
    const buf = await workbook.xlsx.writeBuffer();
    const filename = `reports-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buf));
  }

  if (report_type === 'financial') {
    const invWhere = { ...invoiceWhere };
    invWhere.issued_at = {};
    if (dateRange) {
      invWhere.issued_at[Op.gte] = dateRange.start;
      invWhere.issued_at[Op.lte] = dateRange.end;
    }
    const invoices = await Invoice.findAll({
      where: invWhere,
      include: [{ model: Branch, as: 'Branch', attributes: ['code', 'name'] }, { model: User, as: 'User', attributes: ['name'] }],
      order: [['issued_at', 'DESC']],
      limit: 2000
    });
    const sheet = workbook.addWorksheet('Laporan Keuangan', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'No. Invoice', width: 22 },
      { header: 'Cabang', width: 18 },
      { header: 'Owner', width: 20 },
      { header: 'Total', width: 14 },
      { header: 'Terbayar', width: 14 },
      { header: 'Sisa', width: 14 },
      { header: 'Status', width: 14 },
      { header: 'Tanggal', width: 18 }
    ];
    sheet.getRow(1).font = { bold: true };
    invoices.forEach((inv) => {
      const j = inv.toJSON ? inv.toJSON() : inv;
      sheet.addRow([
        j.invoice_number,
        j.Branch?.name || '',
        j.User?.name || '',
        parseFloat(j.total_amount || 0),
        parseFloat(j.paid_amount || 0),
        parseFloat(j.remaining_amount || 0),
        j.status || '',
        j.issued_at ? new Date(j.issued_at).toLocaleDateString('id-ID') : ''
      ]);
    });
    const buf = await workbook.xlsx.writeBuffer();
    const filename = `reports-financial-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buf));
  }

  let ownerFilter = null;
  if (role) {
    const usersWithRole = await User.findAll({ where: { role }, attributes: ['id'], raw: true });
    ownerFilter = usersWithRole.map((u) => u.id);
  }
  const OrderItem = require('../models/OrderItem');
  const Product = require('../models/Product');
  const orders = await Order.findAll({
    where: Object.keys(orderWhere).length ? orderWhere : undefined,
    attributes: ['id', 'order_number', 'status', 'subtotal', 'discount', 'penalty_amount', 'total_amount', 'currency', 'total_jamaah', 'branch_id', 'owner_id', 'created_at'],
    include: [
      { model: Branch, as: 'Branch', attributes: ['code', 'name', 'provinsi_id'], required: false, include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: User, as: 'User', attributes: ['name', 'role', 'email', 'company_name'] },
      { model: OrderItem, as: 'OrderItems', attributes: ['type', 'quantity'], required: false, include: [{ model: Product, as: 'Product', attributes: ['id', 'name', 'code'], required: false }] }
    ],
    order: [['created_at', 'DESC']],
    limit: 2000
  });
  const filtered = ownerFilter ? orders.filter((o) => ownerFilter.includes((o.toJSON ? o.toJSON() : o).owner_id)) : orders;

  const sheet = workbook.addWorksheet('Orders', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'No. Order', width: 22 },
    { header: 'Wilayah', width: 16 },
    { header: 'Provinsi', width: 16 },
    { header: 'Cabang', width: 18 },
    { header: 'Owner', width: 20 },
    { header: 'Role', width: 14 },
    { header: 'Subtotal', width: 14 },
    { header: 'Diskon', width: 12 },
    { header: 'Penalty', width: 12 },
    { header: 'Total', width: 14 },
    { header: 'Currency', width: 10 },
    { header: 'Jamaah', width: 10 },
    { header: 'Item Types', width: 20 },
    { header: 'Status', width: 14 },
    { header: 'Tanggal', width: 18 }
  ];
  sheet.getRow(1).font = { bold: true };
  filtered.forEach((o) => {
    const j = o.toJSON ? o.toJSON() : o;
    const items = (j.OrderItems || []);
    const itemTypes = [...new Set(items.map((i) => i.type))].join(', ');
    sheet.addRow([
      j.order_number,
      j.Branch?.Provinsi?.Wilayah?.name || '',
      j.Branch?.Provinsi?.name || '',
      j.Branch?.name || '',
      j.User?.name || '',
      j.User?.role || '',
      parseFloat(j.subtotal || 0),
      parseFloat(j.discount || 0),
      parseFloat(j.penalty_amount || 0),
      parseFloat(j.total_amount || 0),
      j.currency || 'IDR',
      parseInt(j.total_jamaah || 0, 10),
      itemTypes,
      j.status || '',
      j.created_at ? new Date(j.created_at).toLocaleString('id-ID') : ''
    ]);
  });
  const buf = await workbook.xlsx.writeBuffer();
  const filename = `reports-${report_type}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buf));
});

/**
 * GET /api/v1/reports/export-pdf
 * Same query params. Exports PDF.
 */
const exportReportPdf = asyncHandler(async (req, res) => {
  const { report_type = 'revenue', date_from, date_to, period = 'month', branch_id, wilayah_id, provinsi_id, role, source, level } = req.query;
  const dateRange = buildDateRange({ date_from, date_to, period });
  const branchIds = await getBranchIdsFilter(branch_id, provinsi_id, wilayah_id);
  const hasLocationFilter = !!(branch_id || provinsi_id || wilayah_id);

  const orderWhere = {};
  const invoiceWhere = {};
  if (hasLocationFilter && branchIds.length === 0) {
    orderWhere.branch_id = { [Op.in]: [] };
    invoiceWhere.branch_id = { [Op.in]: [] };
  } else if (branchIds.length > 0) {
    orderWhere.branch_id = branch_id || { [Op.in]: branchIds };
    invoiceWhere.branch_id = branch_id || { [Op.in]: branchIds };
  }
  if (dateRange) {
    orderWhere.created_at = { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end };
    invoiceWhere.created_at = { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end };
  }

  const doc = new PDFDocument({ margin: 50 });
  const now = new Date();
  const periodLabel = dateRange
    ? `${new Date(dateRange.start).toLocaleDateString('id-ID')} – ${new Date(dateRange.end).toLocaleDateString('id-ID')}`
    : 'Semua';
  const filename = `reports-${report_type}-${now.toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(16).text('Reports & Analytics - Bintang Global', { align: 'center' });
  doc.fontSize(10).text(`Tipe: ${report_type}  |  Periode: ${periodLabel}  |  Generated: ${now.toLocaleString('id-ID')}`, { align: 'center' });
  doc.moveDown(1.5);

  if (report_type === 'logs') {
    const where = {};
    if (source) where.source = source;
    if (level) where.level = level;
    if (dateRange) where.created_at = { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end };
    const logs = await SystemLog.findAll({ where, order: [['created_at', 'DESC']], limit: 200 });
    doc.fontSize(11).text('System Logs', { continued: false });
    doc.font('Helvetica').fontSize(9);
    logs.forEach((log) => {
      doc.text(`${log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : ''} | ${log.source || ''} | ${log.level || ''} | ${(log.message || '').slice(0, 60)}`);
    });
    doc.end();
    return;
  }

  if (report_type === 'financial') {
    const invWhere = { ...invoiceWhere };
    invWhere.issued_at = {};
    if (dateRange) {
      invWhere.issued_at[Op.gte] = dateRange.start;
      invWhere.issued_at[Op.lte] = dateRange.end;
    }
    const invoices = await Invoice.findAll({
      where: invWhere,
      include: [{ model: Branch, as: 'Branch', attributes: ['name'] }, { model: User, as: 'User', attributes: ['name'] }],
      order: [['issued_at', 'DESC']],
      limit: 150
    });
    let totalRevenue = 0;
    invoices.forEach((inv) => {
      const j = inv.toJSON ? inv.toJSON() : inv;
      totalRevenue += parseFloat(j.paid_amount || 0);
    });
    doc.fontSize(11).text(`Total Pendapatan (Terbayar): ${totalRevenue.toLocaleString('id-ID')}`, { continued: false });
    doc.text(`Jumlah Invoice: ${invoices.length}`);
    doc.moveDown(0.5);
    doc.fontSize(10).text('Detail (sample)', { continued: false });
    doc.font('Helvetica').fontSize(8);
    invoices.slice(0, 30).forEach((inv) => {
      const j = inv.toJSON ? inv.toJSON() : inv;
      doc.text(`${j.invoice_number} | ${j.Branch?.name || '-'} | ${parseFloat(j.total_amount || 0).toLocaleString('id-ID')} | ${j.status}`);
    });
    doc.end();
    return;
  }

  let ownerFilter = null;
  if (role) {
    const usersWithRole = await User.findAll({ where: { role }, attributes: ['id'], raw: true });
    ownerFilter = usersWithRole.map((u) => u.id);
  }
  const orders = await Order.findAll({
    where: Object.keys(orderWhere).length ? orderWhere : undefined,
    include: [{ model: Branch, as: 'Branch', attributes: ['name'] }, { model: User, as: 'User', attributes: ['name'] }],
    order: [['created_at', 'DESC']],
    limit: 500
  });
  const filtered = ownerFilter ? orders.filter((o) => ownerFilter.includes((o.toJSON ? o.toJSON() : o).owner_id)) : orders;
  const totalOrders = filtered.length;
  const totalRevenue = filtered
    .filter((o) => !['draft', 'cancelled'].includes((o.toJSON ? o.toJSON() : o).status))
    .reduce((sum, o) => sum + parseFloat((o.toJSON ? o.toJSON() : o).total_amount || 0), 0);
  doc.fontSize(11).text(`Total Order: ${totalOrders}  |  Total Revenue: ${totalRevenue.toLocaleString('id-ID')}`, { continued: false });
  doc.moveDown(0.5);
  doc.fontSize(10).text('Detail (sample)', { continued: false });
  doc.font('Helvetica').fontSize(8);
  filtered.slice(0, 30).forEach((o) => {
    const j = o.toJSON ? o.toJSON() : o;
    doc.text(`${j.order_number} | ${j.Branch?.name || '-'} | ${j.User?.name || '-'} | ${parseFloat(j.total_amount || 0).toLocaleString('id-ID')} | ${j.status}`);
  });
  doc.end();
});

module.exports = {
  getReportFilters,
  getAnalytics,
  exportReportExcel,
  exportReportPdf
};
