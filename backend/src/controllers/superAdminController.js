const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const {
  Order,
  Invoice,
  User,
  Branch,
  AppSetting,
  SystemLog,
  MaintenanceNotice
} = require('../models');
const { ROLES } = require('../constants');

/**
 * GET /api/v1/super-admin/monitoring
 * Query: branch_id, role (optional). Filter monitoring per cabang atau per role.
 */
const getMonitoring = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const branch_id = req.query.branch_id || null;
  const role = req.query.role || null;

  const { orderWhere, invoiceWhere, userWhere, branchesCount } = await getMonitoringFilters(branch_id, role);

  const revenueWhere = { ...orderWhere, status: { [Op.notIn]: ['draft', 'cancelled'] } };

  const [
    totalOrders,
    ordersToday,
    totalInvoices,
    invoicesToday,
    totalRevenue,
    revenueToday,
    activeUsersCount,
    totalUsers,
    ordersByStatus
  ] = await Promise.all([
    Order.count({ where: orderWhere }),
    Order.count({ where: { ...orderWhere, created_at: { [Op.gte]: todayStart } } }),
    Invoice.count({ where: invoiceWhere }),
    Invoice.count({ where: { ...invoiceWhere, created_at: { [Op.gte]: todayStart } } }),
    Order.sum('total_amount', { where: revenueWhere }),
    Order.sum('total_amount', {
      where: { ...revenueWhere, created_at: { [Op.gte]: todayStart } }
    }),
    User.count({ where: { ...userWhere, last_login_at: { [Op.gte]: last24h } } }),
    User.count({ where: userWhere }),
    Order.findAll({
      where: orderWhere,
      attributes: ['status'],
      raw: true
    })
  ]);

  const statusCounts = (ordersByStatus || []).reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const dbPing = await require('../config/sequelize').authenticate().then(() => 'ok').catch(() => 'error');
  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = process.uptime();

  res.json({
    success: true,
    data: {
      overview: {
        total_orders: totalOrders || 0,
        orders_today: ordersToday || 0,
        total_invoices: totalInvoices || 0,
        invoices_today: invoicesToday || 0,
        total_revenue: parseFloat(totalRevenue || 0),
        revenue_today: parseFloat(revenueToday || 0),
        active_users_24h: activeUsersCount || 0,
        total_users: totalUsers || 0,
        active_branches: branchesCount || 0
      },
      orders_by_status: statusCounts,
      performance: {
        database: dbPing,
        memory_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        uptime_seconds: Math.floor(uptimeSeconds),
        uptime_human: formatUptime(uptimeSeconds)
      }
    }
  });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** period: today | week | month | year | all. Returns { start, end } or null for all. */
function getDateRange(period) {
  const now = new Date();
  if (!period || period === 'all') return null;
  let start;
  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, end: now };
  }
  if (period === 'week') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start, end: now };
  }
  if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: now };
  }
  if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    return { start, end: now };
  }
  return null;
}

/**
 * Build where clauses for monitoring/export filter: branch_id and/or role.
 * Returns { orderWhere, invoiceWhere, userWhere, ownerIds, branchesCount }.
 * ownerIds: array of user ids for the role (and optional branch); use for Order/Invoice owner_id filter.
 */
async function getMonitoringFilters(branch_id, role) {
  const orderWhere = { status: { [Op.notIn]: ['draft', 'cancelled'] } };
  const invoiceWhere = {};
  const userWhere = { is_active: true };
  let ownerIds = null;
  let branchesCount;

  if (branch_id) {
    orderWhere.branch_id = branch_id;
    invoiceWhere.branch_id = branch_id;
    userWhere.branch_id = branch_id;
    const branch = await Branch.findOne({ where: { id: branch_id, is_active: true }, attributes: ['id'] });
    branchesCount = branch ? 1 : 0;
  } else {
    branchesCount = await Branch.count({ where: { is_active: true } });
  }

  if (role) {
    const roleUserWhere = { role };
    if (branch_id) roleUserWhere.branch_id = branch_id;
    const users = await User.findAll({ where: roleUserWhere, attributes: ['id'], raw: true });
    ownerIds = users.map((u) => u.id);
    if (ownerIds.length === 0) ownerIds = [null];
    orderWhere.owner_id = { [Op.in]: ownerIds };
    invoiceWhere.owner_id = { [Op.in]: ownerIds };
    userWhere.role = role;
  } else {
    if (branch_id) userWhere.branch_id = branch_id;
  }

  return { orderWhere, invoiceWhere, userWhere, ownerIds, branchesCount };
}

/**
 * GET /api/v1/super-admin/logs
 * System logs with filter (source, level, q = search in message) and pagination
 */
const getLogs = asyncHandler(async (req, res) => {
  const { source, level, q, page = 1, limit = 50 } = req.query;
  const where = {};
  if (source) where.source = source;
  if (level) where.level = level;
  if (q && String(q).trim()) {
    where.message = { [Op.iLike]: `%${String(q).trim()}%` };
  }

  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(200, Math.max(1, parseInt(limit, 10)));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));

  const { count, rows } = await SystemLog.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset,
    limit: limitNum
  });

  res.json({
    success: true,
    data: { items: rows, total: count, page: parseInt(page, 10), limit: limitNum }
  });
});

/**
 * POST /api/v1/super-admin/logs (from frontend - log client errors)
 * Body: { source: 'frontend', level, message, meta }
 */
const createLog = asyncHandler(async (req, res) => {
  const { source = 'frontend', level = 'info', message, meta = {} } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, message: 'message required' });
  }
  const log = await SystemLog.create({
    source: ['backend', 'frontend', 'database'].includes(source) ? source : 'frontend',
    level: ['info', 'warn', 'error', 'debug'].includes(level) ? level : 'info',
    message,
    meta: { ...meta, userId: req.user?.id }
  });
  res.status(201).json({ success: true, data: log });
});

/**
 * GET /api/v1/super-admin/maintenance
 * List all maintenance notices (admin list)
 */
const listMaintenance = asyncHandler(async (req, res) => {
  const { active_only } = req.query;
  const where = {};
  if (active_only === 'true') {
    const now = new Date();
    where.is_active = true;
    where[Op.and] = [
      { [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: now } }] },
      { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gte]: now } }] }
    ];
  }
  const notices = await MaintenanceNotice.findAll({
    where,
    order: [['created_at', 'DESC']],
    attributes: ['id', 'title', 'message', 'type', 'is_active', 'block_app', 'starts_at', 'ends_at', 'created_at', 'created_by'],
    include: [{ model: User, as: 'CreatedBy', attributes: ['id', 'name', 'email'] }]
  });
  const data = notices.map((n) => {
    const plain = n.get ? n.get({ plain: true }) : n;
    return { ...plain, block_app: !!plain.block_app };
  });
  res.json({ success: true, data });
});

/**
 * GET /api/v1/super-admin/maintenance/active (public - for banner & block check)
 * - block_app true + centang: seluruh role (kecuali super_admin) lihat halaman maintenance full.
 * - block_app false + set tanggal: sebelum tanggal = alert pemberitahuan; saat/sesudah tanggal = halaman maintenance full.
 */
const getActiveMaintenance = asyncHandler(async (req, res) => {
  const now = new Date();
  const all = await MaintenanceNotice.findAll({
    where: { is_active: true },
    order: [['created_at', 'DESC']],
    attributes: ['id', 'title', 'message', 'type', 'starts_at', 'ends_at', 'block_app']
  });
  const blocking = [];
  const upcoming = [];
  for (const n of all) {
    const blockFlag = n.block_app === true;
    const startsAt = n.starts_at ? new Date(n.starts_at) : null;
    const endsAt = n.ends_at ? new Date(n.ends_at) : null;
    if (blockFlag) {
      blocking.push(n);
    } else if (startsAt && now >= startsAt && (!endsAt || now <= endsAt)) {
      blocking.push(n);
    } else if (startsAt && now < startsAt) {
      upcoming.push(n);
    }
  }
  const blockApp = blocking.length > 0;
  res.json({ success: true, data: blocking, block_app: blockApp, upcoming });
});

/**
 * POST /api/v1/super-admin/maintenance
 */
const createMaintenance = asyncHandler(async (req, res) => {
  const { title, message, starts_at, ends_at } = req.body;
  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'title and message required' });
  }
  const block_app = req.body.block_app === true;
  if (!block_app && !(starts_at && String(starts_at).trim())) {
    return res.status(400).json({ success: false, message: 'Jika tidak centang Blokir akses, wajib isi tanggal/jam mulai.' });
  }
  const notice = await MaintenanceNotice.create({
    title,
    message,
    type: 'maintenance',
    is_active: true,
    starts_at: block_app ? null : (starts_at || null),
    ends_at: block_app ? null : (ends_at || null),
    block_app,
    created_by: req.user.id
  });
  res.status(201).json({ success: true, data: notice });
});

/**
 * PATCH /api/v1/super-admin/maintenance/:id
 */
const updateMaintenance = asyncHandler(async (req, res) => {
  const notice = await MaintenanceNotice.findByPk(req.params.id);
  if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
  const { title, message, starts_at, ends_at, block_app } = req.body;
  const blockApp = block_app !== undefined ? !!block_app : notice.block_app;
  if (title !== undefined) notice.title = title;
  if (message !== undefined) notice.message = message;
  if (block_app !== undefined) notice.block_app = !!block_app;
  if (block_app !== undefined) {
    if (blockApp) {
      notice.starts_at = null;
      notice.ends_at = null;
    } else {
      if (!(starts_at && String(starts_at).trim())) {
        return res.status(400).json({ success: false, message: 'Jika tidak centang Blokir akses, wajib isi tanggal/jam mulai.' });
      }
      notice.starts_at = starts_at || null;
      notice.ends_at = ends_at || null;
    }
  } else {
    if (starts_at !== undefined) notice.starts_at = starts_at || null;
    if (ends_at !== undefined) notice.ends_at = ends_at || null;
  }
  await notice.save();
  res.json({ success: true, data: notice });
});

/**
 * DELETE /api/v1/super-admin/maintenance/:id
 */
const deleteMaintenance = asyncHandler(async (req, res) => {
  const notice = await MaintenanceNotice.findByPk(req.params.id);
  if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
  await notice.destroy();
  res.json({ success: true, message: 'Deleted' });
});

/**
 * GET /api/v1/super-admin/settings
 * App settings (theme, locale, colors, font_size, background, ui_template)
 */
const getSettings = asyncHandler(async (req, res) => {
  const rows = await AppSetting.findAll({ raw: true });
  const settings = {};
  rows.forEach(r => {
    try {
      settings[r.key] = r.value && (r.value.startsWith('{') || r.value.startsWith('[')) ? JSON.parse(r.value) : r.value;
    } catch {
      settings[r.key] = r.value;
    }
  });
  const defaults = {
    locale: 'id',
    primary_color: '#059669',
    background_color: '#f8fafc',
    text_color: '#0f172a',
    font_size: '14',
    ui_template: 'default'
  };
  res.json({ success: true, data: { ...defaults, ...settings } });
});

/**
 * PUT /api/v1/super-admin/settings
 * Body: { locale?, primary_color?, background_color?, text_color?, font_size?, ui_template? }
 */
const ALLOWED_LOCALES = ['en', 'id', 'ar'];

const updateSettings = asyncHandler(async (req, res) => {
  const allowed = ['locale', 'primary_color', 'background_color', 'text_color', 'font_size', 'ui_template'];
  const updates = req.body;
  if (updates.locale !== undefined && !ALLOWED_LOCALES.includes(String(updates.locale))) {
    return res.status(400).json({
      success: false,
      message: 'Bahasa hanya mendukung: English (en), Indonesia (id), العربية Saudi (ar).'
    });
  }
  for (const key of Object.keys(updates)) {
    if (!allowed.includes(key)) continue;
    const value = typeof updates[key] === 'object' ? JSON.stringify(updates[key]) : String(updates[key]);
    const [row] = await AppSetting.findOrCreate({ where: { key }, defaults: { value } });
    await row.update({ value });
  }
  const rows = await AppSetting.findAll({ raw: true });
  const settings = {};
  rows.forEach(r => {
    try {
      settings[r.key] = r.value && (r.value.startsWith('{') || r.value.startsWith('[')) ? JSON.parse(r.value) : r.value;
    } catch {
      settings[r.key] = r.value;
    }
  });
  res.json({ success: true, data: settings });
});

const LOCALES = ['en', 'id', 'ar'];
const I18N = {
  en: {
    app_name: 'Bintang Global',
    dashboard: 'Dashboard',
    orders: 'Orders',
    invoices: 'Invoices',
    users: 'Users',
    branches: 'Branches',
    settings: 'Settings',
    reports: 'Reports',
    hotels: 'Hotels',
    visa: 'Visa',
    tickets: 'Tickets',
    bus: 'Bus',
    packages: 'Packages',
    super_admin: 'Super Admin',
    monitoring: 'Monitoring',
    order_statistics: 'Order Statistics',
    system_logs: 'System Logs',
    maintenance: 'Maintenance',
    language: 'Language',
    deployment: 'Deployment',
    welcome: 'Welcome back',
    total_orders: 'Total Orders',
    total_revenue: 'Total Revenue',
    active_users: 'Active Users',
    system_health: 'System Health'
  },
  id: {
    app_name: 'Bintang Global',
    dashboard: 'Dashboard',
    orders: 'Order',
    invoices: 'Faktur',
    users: 'Pengguna',
    branches: 'Cabang',
    settings: 'Pengaturan',
    reports: 'Laporan',
    hotels: 'Hotel',
    visa: 'Visa',
    tickets: 'Tiket',
    bus: 'Bus',
    packages: 'Paket',
    super_admin: 'Super Admin',
    monitoring: 'Monitoring',
    order_statistics: 'Statistik Order',
    system_logs: 'Log Sistem',
    maintenance: 'Pemeliharaan',
    language: 'Bahasa',
    deployment: 'Deployment',
    welcome: 'Selamat datang kembali',
    total_orders: 'Total Order',
    total_revenue: 'Total Pendapatan',
    active_users: 'Pengguna Aktif',
    system_health: 'Kesehatan Sistem'
  },
  ar: {
    app_name: 'بينتانج جلوبال',
    dashboard: 'لوحة التحكم',
    orders: 'الطلبات',
    invoices: 'الفواتير',
    users: 'المستخدمون',
    branches: 'الفروع',
    settings: 'الإعدادات',
    reports: 'التقارير',
    hotels: 'الفنادق',
    visa: 'التأشيرة',
    tickets: 'التذاكر',
    bus: 'الحافلة',
    packages: 'الباقات',
    super_admin: 'المشرف الأعلى',
    monitoring: 'المراقبة',
    order_statistics: 'إحصائيات الطلبات',
    system_logs: 'سجلات النظام',
    maintenance: 'الصيانة',
    language: 'اللغة',
    deployment: 'النشر',
    welcome: 'مرحباً بعودتك',
    total_orders: 'إجمالي الطلبات',
    total_revenue: 'إجمالي الإيرادات',
    active_users: 'المستخدمون النشطون',
    system_health: 'صحة النظام'
  }
};

/**
 * GET /api/v1/super-admin/i18n/:locale
 * Get translations for locale (en, id, ar)
 */
const getI18n = asyncHandler(async (req, res) => {
  const locale = LOCALES.includes(req.params.locale) ? req.params.locale : 'id';
  res.json({ success: true, data: I18N[locale] || I18N.id });
});

/**
 * GET /api/v1/super-admin/i18n
 * List available locales
 */
const listLocales = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: [
      { code: 'en', name: 'English' },
      { code: 'id', name: 'Indonesia' },
      { code: 'ar', name: 'العربية (Saudi Arabia)' }
    ]
  });
});

/**
 * GET /api/v1/super-admin/export-monitoring-excel?period=today|week|month|year|all&branch_id=&role=
 */
const exportMonitoringExcel = asyncHandler(async (req, res) => {
  const period = (req.query.period || 'all').toLowerCase();
  const branch_id = req.query.branch_id || null;
  const role = req.query.role || null;
  const dateRange = getDateRange(period);
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { orderWhere, invoiceWhere, userWhere, branchesCount } = await getMonitoringFilters(branch_id, role);
  const orderDateWhere = dateRange ? { created_at: { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end } } : {};
  const invoiceDateWhere = dateRange ? { created_at: { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end } } : {};
  const revenueWhere = { ...orderWhere, status: { [Op.notIn]: ['draft', 'cancelled'] }, ...orderDateWhere };

  const [
    totalOrders,
    totalInvoices,
    totalRevenue,
    activeUsersCount,
    totalUsers,
    ordersByStatus
  ] = await Promise.all([
    Order.count({ where: { ...orderWhere, ...orderDateWhere } }),
    Invoice.count({ where: { ...invoiceWhere, ...invoiceDateWhere } }),
    Order.sum('total_amount', { where: revenueWhere }),
    User.count({ where: { ...userWhere, last_login_at: { [Op.gte]: last24h } } }),
    User.count({ where: userWhere }),
    Order.findAll({
      where: { ...orderWhere, ...orderDateWhere },
      attributes: ['status'],
      raw: true
    })
  ]);

  const statusCounts = (ordersByStatus || []).reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const dbPing = await require('../config/sequelize').authenticate().then(() => 'ok').catch(() => 'error');
  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = process.uptime();
  const uptimeHuman = formatUptime(uptimeSeconds);

  const periodLabel = { today: 'Harian', week: 'Mingguan', month: 'Bulanan', year: 'Tahunan', all: 'Semua' }[period] || 'Semua';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bintang Global - Super Admin';

  const sheet1 = workbook.addWorksheet('Overview', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet1.columns = [
    { header: 'Metric', width: 28 },
    { header: 'Nilai', width: 18 }
  ];
  sheet1.getRow(1).font = { bold: true };
  sheet1.addRows([
    ['Periode', periodLabel],
    ['Total Order', totalOrders || 0],
    ['Total Faktur', totalInvoices || 0],
    ['Total Revenue', parseFloat(totalRevenue || 0)],
    ['Pengguna Aktif (24j)', activeUsersCount || 0],
    ['Total Pengguna', totalUsers || 0],
    ['Cabang Aktif', branchesCount || 0],
    ['Database', dbPing],
    ['Memory (MB)', Math.round(memoryUsage.heapUsed / 1024 / 1024)],
    ['Uptime', uptimeHuman]
  ]);

  const sheet2 = workbook.addWorksheet('Order per Status', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet2.columns = [
    { header: 'Status', width: 22 },
    { header: 'Jumlah', width: 12 }
  ];
  sheet2.getRow(1).font = { bold: true };
  Object.entries(statusCounts).forEach(([status, count]) => {
    sheet2.addRow([status, count]);
  });

  const buf = await workbook.xlsx.writeBuffer();
  const filename = `rekap-monitoring-${period}-${now.toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buf));
});

/**
 * GET /api/v1/super-admin/export-monitoring-pdf?period=today|week|month|year|all&branch_id=&role=
 */
const exportMonitoringPdf = asyncHandler(async (req, res) => {
  const period = (req.query.period || 'all').toLowerCase();
  const branch_id = req.query.branch_id || null;
  const role = req.query.role || null;
  const dateRange = getDateRange(period);
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { orderWhere, invoiceWhere, userWhere, branchesCount } = await getMonitoringFilters(branch_id, role);
  const orderDateWhere = dateRange ? { created_at: { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end } } : {};
  const invoiceDateWhere = dateRange ? { created_at: { [Op.gte]: dateRange.start, [Op.lte]: dateRange.end } } : {};
  const revenueWhere = { ...orderWhere, status: { [Op.notIn]: ['draft', 'cancelled'] }, ...orderDateWhere };

  const [
    totalOrders,
    totalInvoices,
    totalRevenue,
    activeUsersCount,
    totalUsers,
    ordersByStatus
  ] = await Promise.all([
    Order.count({ where: { ...orderWhere, ...orderDateWhere } }),
    Invoice.count({ where: { ...invoiceWhere, ...invoiceDateWhere } }),
    Order.sum('total_amount', { where: revenueWhere }),
    User.count({ where: { ...userWhere, last_login_at: { [Op.gte]: last24h } } }),
    User.count({ where: userWhere }),
    Order.findAll({ where: { ...orderWhere, ...orderDateWhere }, attributes: ['status'], raw: true })
  ]);

  const statusCounts = (ordersByStatus || []).reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const dbPing = await require('../config/sequelize').authenticate().then(() => 'ok').catch(() => 'error');
  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = process.uptime();
  const periodLabel = { today: 'Harian', week: 'Mingguan', month: 'Bulanan', year: 'Tahunan', all: 'Semua' }[period] || 'Semua';

  const doc = new PDFDocument({ margin: 50 });
  const filename = `rekap-monitoring-${period}-${now.toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(16).text('Rekapitulasi Monitoring - Super Admin', { align: 'center' });
  doc.fontSize(9).text(`Periode: ${periodLabel}  |  Generated: ${now.toLocaleString('id-ID')}`, { align: 'center' });
  doc.moveDown(1.5);

  doc.fontSize(11).text('Overview', { continued: false });
  doc.font('Helvetica').fontSize(10);
  doc.text(`Total Order: ${totalOrders || 0}  |  Total Faktur: ${totalInvoices || 0}`);
  doc.text(`Total Revenue: ${parseFloat(totalRevenue || 0).toLocaleString('id-ID')}`);
  doc.text(`Pengguna Aktif (24j): ${activeUsersCount || 0}  |  Total Pengguna: ${totalUsers || 0}  |  Cabang Aktif: ${branchesCount || 0}`);
  doc.text(`Database: ${dbPing}  |  Memory (MB): ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}  |  Uptime: ${formatUptime(uptimeSeconds)}`);
  doc.moveDown(1);

  doc.fontSize(11).text('Order per Status', { continued: false });
  doc.font('Helvetica').fontSize(9);
  Object.entries(statusCounts).forEach(([status, count]) => {
    doc.text(`${status}: ${count}`);
  });

  doc.end();
});

/**
 * GET /api/v1/super-admin/export/logs-excel
 * Query: source, level, limit (default 2000)
 */
const exportLogsExcel = asyncHandler(async (req, res) => {
  const { source, level } = req.query;
  const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit, 10) || 2000));
  const where = {};
  if (source) where.source = source;
  if (level) where.level = level;

  const logs = await SystemLog.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    raw: true
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('System Logs', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Waktu', width: 22 },
    { header: 'Sumber', width: 12 },
    { header: 'Level', width: 10 },
    { header: 'Pesan', width: 50 },
    { header: 'Meta', width: 30 }
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
  const filename = `system-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buf));
});

/**
 * GET /api/v1/super-admin/export/logs-pdf
 */
const exportLogsPdf = asyncHandler(async (req, res) => {
  const { source, level } = req.query;
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 500));
  const where = {};
  if (source) where.source = source;
  if (level) where.level = level;

  const logs = await SystemLog.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    raw: true
  });

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const filename = `system-logs-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(14).text('System Logs - Super Admin', { align: 'center' });
  doc.fontSize(8).text(`Generated: ${new Date().toLocaleString('id-ID')} | Total: ${logs.length} baris`, { align: 'center' });
  doc.moveDown(1);

  doc.font('Helvetica').fontSize(8);
  logs.forEach((log, idx) => {
    if (doc.y > 720) {
      doc.addPage();
      doc.y = 40;
    }
    const time = log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '';
    const metaStr = log.meta ? JSON.stringify(log.meta).substring(0, 80) : '';
    doc.text(`[${time}] ${log.source || ''} ${log.level || ''}: ${(log.message || '').substring(0, 90)} ${metaStr}`, { width: 520 });
  });

  doc.end();
});

module.exports = {
  getMonitoring,
  getLogs,
  createLog,
  listMaintenance,
  getActiveMaintenance,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  getSettings,
  updateSettings,
  getI18n,
  listLocales,
  exportMonitoringExcel,
  exportMonitoringPdf,
  exportLogsExcel,
  exportLogsPdf
};
