const asyncHandler = require('express-async-handler');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { PayrollSetting, EmployeeSalary, PayrollRun, PayrollItem, User, Branch, Notification } = require('../models');
const { ROLES, PAYROLL_METHOD, PAYROLL_RUN_STATUS, NOTIFICATION_TRIGGER } = require('../constants');
const { buildPayrollSlipPdfBuffer } = require('../utils/payrollSlipPdf');
const { SUBDIRS, getDir, payrollSlipFilename, toUrlPath } = require('../config/uploads');

const isPayrollAllowed = (user) => user && ['super_admin', 'admin_pusat', 'role_accounting'].includes(user.role);

/** GET /api/v1/accounting/payroll/settings */
const getSettings = asyncHandler(async (req, res) => {
  const { branch_id } = req.query;
  const branchId = branch_id || null;
  let setting = await PayrollSetting.findOne({ where: { branch_id: branchId || null } });
  if (!setting) {
    setting = await PayrollSetting.create({
      branch_id: branchId,
      method: PAYROLL_METHOD.MANUAL,
      is_active: true
    });
  }
  const branch = branchId ? await Branch.findByPk(branchId, { attributes: ['id', 'code', 'name'] }) : null;
  res.json({ success: true, data: { ...setting.toJSON(), Branch: branch } });
});

/** PUT /api/v1/accounting/payroll/settings */
const updateSettings = asyncHandler(async (req, res) => {
  const { branch_id, method, payroll_day_of_month, run_time, is_active, company_name_slip, company_address_slip } = req.body;
  const branchId = branch_id || null;
  let setting = await PayrollSetting.findOne({ where: { branch_id: branchId } });
  if (!setting) {
    setting = await PayrollSetting.create({ branch_id: branchId, method: PAYROLL_METHOD.MANUAL });
  }
  await setting.update({
    method: method || setting.method,
    payroll_day_of_month: payroll_day_of_month != null ? payroll_day_of_month : setting.payroll_day_of_month,
    run_time: run_time != null ? run_time : setting.run_time,
    is_active: is_active != null ? is_active : setting.is_active,
    company_name_slip: company_name_slip != null ? company_name_slip : setting.company_name_slip,
    company_address_slip: company_address_slip != null ? company_address_slip : setting.company_address_slip
  });
  res.json({ success: true, data: setting, message: 'Pengaturan payroll disimpan' });
});

/** GET /api/v1/accounting/payroll/employees - Daftar karyawan (bukan owner) untuk payroll */
const listEligibleEmployees = asyncHandler(async (req, res) => {
  const { branch_id } = req.query;
  const where = { role: { [Op.ne]: ROLES.OWNER }, is_active: true };
  if (branch_id) where.branch_id = branch_id;
  const users = await User.findAll({
    where,
    attributes: ['id', 'name', 'email', 'role', 'branch_id'],
    include: [{ model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false }],
    order: [['name', 'ASC']]
  });
  const salaries = await EmployeeSalary.findAll({
    where: { user_id: { [Op.in]: users.map(u => u.id) } },
    order: [['effective_from', 'DESC']]
  });
  const salaryByUser = {};
  salaries.forEach((s) => {
    if (!salaryByUser[s.user_id]) salaryByUser[s.user_id] = s.toJSON();
  });
  const data = users.map((u) => {
    const j = u.toJSON();
    j.salary_template = salaryByUser[j.id] || null;
    return j;
  });
  res.json({ success: true, data });
});

/** GET /api/v1/accounting/payroll/employees/:userId/salary */
const getEmployeeSalary = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const salary = await EmployeeSalary.findOne({
    where: { user_id: userId },
    order: [['effective_from', 'DESC']]
  });
  if (!salary) return res.status(404).json({ success: false, message: 'Template gaji tidak ditemukan' });
  res.json({ success: true, data: salary });
});

/** PUT /api/v1/accounting/payroll/employees/:userId/salary */
const upsertEmployeeSalary = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { base_salary, allowances, deductions, effective_from, effective_to, notes } = req.body;
  const user = await User.findByPk(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  if (user.role === ROLES.OWNER) return res.status(400).json({ success: false, message: 'Owner tidak memiliki template gaji' });
  let salary = await EmployeeSalary.findOne({ where: { user_id: userId }, order: [['effective_from', 'DESC']] });
  const payload = {
    base_salary: base_salary != null ? base_salary : (salary?.base_salary ?? 0),
    allowances: Array.isArray(allowances) ? allowances : (salary?.allowances ?? []),
    deductions: Array.isArray(deductions) ? deductions : (salary?.deductions ?? []),
    effective_from: effective_from || null,
    effective_to: effective_to || null,
    notes: notes != null ? notes : (salary?.notes ?? null)
  };
  if (salary) {
    await salary.update(payload);
  } else {
    salary = await EmployeeSalary.create({ user_id: userId, ...payload });
  }
  res.json({ success: true, data: salary, message: 'Template gaji disimpan' });
});

/** GET /api/v1/accounting/payroll/runs */
const listPayrollRuns = asyncHandler(async (req, res) => {
  const { branch_id, period_year, period_month, status, page = 1, limit = 20 } = req.query;
  const where = {};
  if (branch_id) where.branch_id = branch_id;
  if (period_year) where.period_year = period_year;
  if (period_month) where.period_month = period_month;
  if (status) where.status = status;
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const { rows, count } = await PayrollRun.findAndCountAll({
    where,
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: User, as: 'CreatedBy', attributes: ['id', 'name'], required: false }
    ],
    order: [['period_year', 'DESC'], ['period_month', 'DESC'], ['created_at', 'DESC']],
    limit: lim,
    offset
  });
  res.json({
    success: true,
    data: rows,
    pagination: { total: count, page: parseInt(page, 10), limit: lim, totalPages: Math.ceil(count / lim) }
  });
});

/** POST /api/v1/accounting/payroll/runs - Buat run baru (draft), isi items dari template atau kosong */
const createPayrollRun = asyncHandler(async (req, res) => {
  const { period_month, period_year, method, branch_id } = req.body;
  if (!period_month || !period_year) return res.status(400).json({ success: false, message: 'period_month dan period_year wajib' });
  const whereUser = { role: { [Op.ne]: ROLES.OWNER }, is_active: true };
  if (branch_id) whereUser.branch_id = branch_id;
  const users = await User.findAll({ where: whereUser, attributes: ['id'] });
  const existing = await PayrollRun.findOne({
    where: { period_month: Number(period_month), period_year: Number(period_year), branch_id: branch_id || null }
  });
  if (existing) return res.status(400).json({ success: false, message: 'Payroll periode ini sudah ada' });

  const run = await PayrollRun.create({
    period_month: Number(period_month),
    period_year: Number(period_year),
    status: PAYROLL_RUN_STATUS.DRAFT,
    method: method || PAYROLL_METHOD.MANUAL,
    branch_id: branch_id || null,
    created_by: req.user.id,
    total_amount: 0
  });

  const salaries = await EmployeeSalary.findAll({ where: { user_id: { [Op.in]: users.map(u => u.id) } } });
  const salaryMap = {};
  salaries.forEach((s) => { salaryMap[s.user_id] = s; });

  const items = [];
  let totalAmount = 0;
  for (const u of users) {
    const t = salaryMap[u.id];
    const base = t ? parseFloat(t.base_salary) : 0;
    const allowances = t && Array.isArray(t.allowances) ? t.allowances : [];
    const deductions = t && Array.isArray(t.deductions) ? t.deductions : [];
    const gross = base + allowances.reduce((s, a) => s + parseFloat(a.amount || a.value || 0), 0);
    const totalDed = deductions.reduce((s, d) => s + parseFloat(d.amount || d.value || 0), 0);
    const net = gross - totalDed;
    const item = await PayrollItem.create({
      payroll_run_id: run.id,
      user_id: u.id,
      base_salary: base,
      allowances,
      deductions,
      gross,
      total_deductions: totalDed,
      net
    });
    items.push(item);
    totalAmount += net;
  }
  await run.update({ total_amount: totalAmount });
  const full = await PayrollRun.findByPk(run.id, {
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: User, as: 'CreatedBy', attributes: ['id', 'name'], required: false },
      { model: PayrollItem, as: 'PayrollItems', include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email', 'role'] }] }
    ]
  });
  res.status(201).json({ success: true, data: full, message: 'Payroll run dibuat (draft)' });
});

/** GET /api/v1/accounting/payroll/runs/:id */
const getPayrollRun = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findByPk(req.params.id, {
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: User, as: 'CreatedBy', attributes: ['id', 'name'], required: false },
      { model: PayrollItem, as: 'PayrollItems', include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email', 'role'] }] }
    ]
  });
  if (!run) return res.status(404).json({ success: false, message: 'Payroll run tidak ditemukan' });
  res.json({ success: true, data: run });
});

/** PATCH /api/v1/accounting/payroll/runs/:id - Update items (hanya draft) */
const updatePayrollRun = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findByPk(req.params.id, { include: [{ model: PayrollItem, as: 'PayrollItems' }] });
  if (!run) return res.status(404).json({ success: false, message: 'Payroll run tidak ditemukan' });
  if (run.status !== PAYROLL_RUN_STATUS.DRAFT) return res.status(400).json({ success: false, message: 'Hanya run draft yang dapat diedit' });
  const { items } = req.body;
  if (Array.isArray(items)) {
    let totalAmount = 0;
    for (const row of items) {
      const item = run.PayrollItems.find((i) => i.id === row.id);
      if (!item) continue;
      const base = parseFloat(row.base_salary) ?? parseFloat(item.base_salary);
      const allowances = Array.isArray(row.allowances) ? row.allowances : (item.allowances || []);
      const deductions = Array.isArray(row.deductions) ? row.deductions : (item.deductions || []);
      const gross = base + allowances.reduce((s, a) => s + parseFloat(a.amount || a.value || 0), 0);
      const totalDed = deductions.reduce((s, d) => s + parseFloat(d.amount || d.value || 0), 0);
      const net = gross - totalDed;
      await item.update({ base_salary: base, allowances, deductions, gross, total_deductions: totalDed, net, notes: row.notes != null ? row.notes : item.notes });
      totalAmount += net;
    }
    await run.update({ total_amount: totalAmount });
  }
  const full = await PayrollRun.findByPk(run.id, {
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: User, as: 'CreatedBy', attributes: ['id', 'name'], required: false },
      { model: PayrollItem, as: 'PayrollItems', include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email', 'role'] }] }
    ]
  });
  res.json({ success: true, data: full, message: 'Payroll run diperbarui' });
});

/** POST /api/v1/accounting/payroll/runs/:id/finalize - Generate slip, simpan file, notifikasi ke setiap karyawan (bukan owner) */
const finalizePayrollRun = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findByPk(req.params.id, {
    include: [
      { model: PayrollItem, as: 'PayrollItems', include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }] },
      { model: Branch, as: 'Branch', attributes: ['id', 'name'], required: false }
    ]
  });
  if (!run) return res.status(404).json({ success: false, message: 'Payroll run tidak ditemukan' });
  if (run.status !== PAYROLL_RUN_STATUS.DRAFT) return res.status(400).json({ success: false, message: 'Run sudah diproses atau difinalisasi' });

  const setting = await PayrollSetting.findOne({ where: { branch_id: run.branch_id || null } });
  const companyName = setting?.company_name_slip || 'BINTANG GLOBAL GROUP';
  const companyAddress = setting?.company_address_slip || 'Travel & Umroh';

  const slipDir = getDir(SUBDIRS.PAYROLL_SLIPS);
  const baseUrl = process.env.API_BASE_URL || req.protocol + '://' + req.get('host');

  for (const item of run.PayrollItems) {
    const user = item.User;
    const opts = {
      companyName,
      companyAddress,
      employeeName: user?.name || 'Karyawan',
      periodMonth: run.period_month,
      periodYear: run.period_year,
      baseSalary: item.base_salary,
      allowances: item.allowances || [],
      deductions: item.deductions || [],
      gross: item.gross,
      totalDeductions: item.total_deductions,
      net: item.net
    };
    const buf = await buildPayrollSlipPdfBuffer(opts);
    const filename = payrollSlipFilename(user?.name, run.period_year, run.period_month, item.id);
    const filePath = path.join(slipDir, filename);
    fs.writeFileSync(filePath, buf);
    const relativePath = path.join(SUBDIRS.PAYROLL_SLIPS, filename).replace(/\\/g, '/');
    await item.update({
      slip_file_path: relativePath,
      slip_generated_at: new Date()
    });
    const slipUrl = `${baseUrl}/uploads/${relativePath}`;
    await Notification.create({
      user_id: item.user_id,
      trigger: NOTIFICATION_TRIGGER.PAYROLL_SLIP_ISSUED,
      title: 'Slip Gaji Tersedia',
      message: `Slip gaji Anda untuk periode ${opts.periodMonth}/${opts.periodYear} telah tersedia. Take home pay: Rp ${Number(item.net).toLocaleString('id-ID')}.`,
      data: { payroll_run_id: run.id, payroll_item_id: item.id, slip_url: slipUrl, period_month: run.period_month, period_year: run.period_year }
    });
  }

  await run.update({
    status: PAYROLL_RUN_STATUS.FINALIZED,
    finalized_at: new Date(),
    processed_at: new Date()
  });

  const full = await PayrollRun.findByPk(run.id, {
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: PayrollItem, as: 'PayrollItems', include: [{ model: User, as: 'User', attributes: ['id', 'name'] }] }
    ]
  });
  res.json({ success: true, data: full, message: 'Payroll difinalisasi. Slip gaji telah digenerate dan notifikasi dikirim ke setiap karyawan.' });
});

/** GET /api/v1/accounting/payroll/my-slips - Daftar slip gaji saya (untuk role selain owner) */
const listMySlips = asyncHandler(async (req, res) => {
  if (req.user.role === ROLES.OWNER) return res.json({ success: true, data: [] });
  const items = await PayrollItem.findAll({
    where: { user_id: req.user.id, slip_generated_at: { [Op.ne]: null } },
    include: [{ model: PayrollRun, as: 'PayrollRun', attributes: ['id', 'period_month', 'period_year', 'status', 'finalized_at'] }],
    order: [['slip_generated_at', 'DESC']]
  });
  const data = items.map((i) => ({
    id: i.id,
    payroll_run_id: i.payroll_run_id,
    period_month: i.PayrollRun?.period_month,
    period_year: i.PayrollRun?.period_year,
    net: i.net,
    slip_generated_at: i.slip_generated_at
  }));
  res.json({ success: true, data });
});

/** GET /api/v1/accounting/payroll/my-slips/:itemId/slip - Download slip gaji saya (PDF) */
const getMySlipPdf = asyncHandler(async (req, res) => {
  const item = await PayrollItem.findByPk(req.params.itemId, {
    include: [
      { model: PayrollRun, as: 'PayrollRun', attributes: ['id', 'period_month', 'period_year'] },
      { model: User, as: 'User', attributes: ['id', 'name'] }
    ]
  });
  if (!item || item.user_id !== req.user.id) return res.status(404).json({ success: false, message: 'Slip tidak ditemukan' });
  if (!item.slip_generated_at) return res.status(404).json({ success: false, message: 'Slip belum digenerate' });
  if (item.slip_file_path) {
    const uploadRoot = process.env.UPLOAD_ROOT || path.join(__dirname, '../../..', 'uploads');
    const fullPath = path.join(uploadRoot, item.slip_file_path);
    if (fs.existsSync(fullPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="slip-gaji-${item.User?.name || item.id}.pdf"`);
      return res.sendFile(fullPath);
    }
  }
  const setting = await PayrollSetting.findOne({ where: { branch_id: null } });
  const opts = {
    companyName: setting?.company_name_slip || 'BINTANG GLOBAL GROUP',
    companyAddress: setting?.company_address_slip || '',
    employeeName: item.User?.name || 'Karyawan',
    periodMonth: item.PayrollRun.period_month,
    periodYear: item.PayrollRun.period_year,
    baseSalary: item.base_salary,
    allowances: item.allowances || [],
    deductions: item.deductions || [],
    gross: item.gross,
    totalDeductions: item.total_deductions,
    net: item.net
  };
  const buf = await buildPayrollSlipPdfBuffer(opts);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="slip-gaji-${opts.periodYear}-${opts.periodMonth}.pdf"`);
  res.send(buf);
});

/** GET /api/v1/accounting/payroll/runs/:runId/items/:itemId/slip - Download PDF slip (karyawan sendiri atau accounting) */
const getSlipPdf = asyncHandler(async (req, res) => {
  const { runId, itemId } = req.params;
  const item = await PayrollItem.findByPk(itemId, {
    include: [
      { model: PayrollRun, as: 'PayrollRun', attributes: ['id', 'period_month', 'period_year', 'status'] },
      { model: User, as: 'User', attributes: ['id', 'name', 'email'] }
    ]
  });
  if (!item || item.payroll_run_id !== runId) return res.status(404).json({ success: false, message: 'Slip tidak ditemukan' });
  const isOwner = item.user_id === req.user.id;
  if (!isOwner && !isPayrollAllowed(req.user)) return res.status(403).json({ success: false, message: 'Akses ditolak' });

  if (item.slip_file_path) {
    const fullPath = path.join(process.env.UPLOAD_ROOT || path.join(__dirname, '../../..', 'uploads'), item.slip_file_path);
    if (fs.existsSync(fullPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="slip-gaji-${item.User?.name || itemId}.pdf"`);
      return res.sendFile(fullPath);
    }
  }

  const setting = await PayrollSetting.findOne({ where: { branch_id: item.PayrollRun?.branch_id || null } });
  const opts = {
    companyName: setting?.company_name_slip || 'BINTANG GLOBAL GROUP',
    companyAddress: setting?.company_address_slip || 'Travel & Umroh',
    employeeName: item.User?.name || 'Karyawan',
    periodMonth: item.PayrollRun.period_month,
    periodYear: item.PayrollRun.period_year,
    baseSalary: item.base_salary,
    allowances: item.allowances || [],
    deductions: item.deductions || [],
    gross: item.gross,
    totalDeductions: item.total_deductions,
    net: item.net
  };
  const buf = await buildPayrollSlipPdfBuffer(opts);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="slip-gaji-${opts.employeeName.replace(/\s/g, '_')}-${opts.periodYear}-${opts.periodMonth}.pdf"`);
  res.send(buf);
});

module.exports = {
  getSettings,
  updateSettings,
  listEligibleEmployees,
  getEmployeeSalary,
  upsertEmployeeSalary,
  listPayrollRuns,
  createPayrollRun,
  getPayrollRun,
  updatePayrollRun,
  finalizePayrollRun,
  getSlipPdf,
  listMySlips,
  getMySlipPdf
};
