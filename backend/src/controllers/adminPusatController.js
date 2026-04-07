const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const {
  Order,
  OrderItem,
  User,
  Branch,
  Provinsi,
  Wilayah,
  Kabupaten,
  OwnerProfile,
  Invoice,
  Refund,
  HotelProgress,
  VisaProgress,
  TicketProgress,
  BusProgress,
  Product,
  ProductAvailability,
  HotelSeason,
  HotelRoomInventory,
  VisaSeason,
  VisaSeasonQuota,
  TicketSeason,
  TicketSeasonQuota,
  BusSeason,
  BusSeasonQuota
} = require('../models');
const { ROLES, ORDER_ITEM_TYPE, isOwnerRole, OWNER_ROLES } = require('../constants');
const { getHotelAvailabilityConfig } = require('../services/hotelAvailabilityService');
const { runFullSync, enrichBranchWithLocation } = require('../utils/locationMaster');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');

/**
 * POST /api/v1/admin-pusat/sync-location
 * Generate otomatis: isi provinsi.wilayah_id dan branch.provinsi_id yang masih null; isi user.wilayah_id dari branch.
 */
const syncLocation = asyncHandler(async (req, res) => {
  const result = await runFullSync();
  res.json({
    success: true,
    message: 'Sinkronisasi lokasi selesai.',
    data: {
      provinsi_updated: result.provinsiUpdated,
      branch_by_code: result.branchByCode,
      branch_by_city: result.branchByCity,
      branch_by_region: result.branchByRegion,
      user_wilayah_updated: result.userWilayahUpdated
    }
  });
});

/**
 * GET /api/v1/admin-pusat/dashboard
 * Rekapitulasi transaksi dan pekerjaan per cabang. Filter: branch_id, date_from, date_to.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const { branch_id, date_from, date_to, status, provinsi_id, wilayah_id } = req.query;

  const branches = await Branch.findAll({ where: { is_active: true }, order: [['code', 'ASC']] });
  const branchWithProvinsi = await Branch.findAll({
    where: { is_active: true },
    attributes: ['id', 'code', 'name', 'provinsi_id'],
    include: [
      { model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'kode', 'wilayah_id'], required: false,
        include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }
    ]
  });
  const branchMap = {};
  for (const b of branchWithProvinsi) {
    const loc = await enrichBranchWithLocation(b, { syncDb: true });
    const j = b.toJSON();
    branchMap[j.id] = {
      provinsi_id: loc.provinsi_id || j.provinsi_id,
      provinsi_name: loc.provinsi_name ?? j.Provinsi?.name,
      wilayah_id: loc.wilayah_id ?? j.Provinsi?.Wilayah?.id,
      wilayah_name: loc.wilayah_name ?? j.Provinsi?.Wilayah?.name
    };
  }

  // Dashboard hanya pakai data invoice (orders & invoices section = invoice-based), konsisten dengan reports/analytics
  const whereInvoice = {};
  if (branch_id) whereInvoice.branch_id = branch_id;
  if (status) whereInvoice.status = status;
  if (date_from || date_to) {
    whereInvoice.created_at = {};
    if (date_from) whereInvoice.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      whereInvoice.created_at[Op.lte] = d;
    }
  }
  if (provinsi_id || wilayah_id) {
    let branchIdsForInv = [];
    if (provinsi_id) {
      const rows = await Branch.findAll({ where: { provinsi_id, is_active: true }, attributes: ['id'] });
      branchIdsForInv = rows.map((r) => r.id);
    } else if (wilayah_id) {
      branchIdsForInv = await getBranchIdsForWilayah(wilayah_id);
    }
    if (branchIdsForInv.length > 0) {
      whereInvoice.branch_id = branch_id ? (branchIdsForInv.includes(branch_id) ? branch_id : 'none') : { [Op.in]: branchIdsForInv };
    } else {
      whereInvoice.branch_id = 'none';
    }
  }

  const invoiceRows = await Invoice.findAll({
    where: whereInvoice,
    attributes: ['id', 'status', 'total_amount', 'branch_id', 'invoice_number', 'created_at'],
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'provinsi_id'], required: false,
        include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'wilayah_id'], required: false,
          include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
      { model: User, as: 'User', attributes: ['id', 'name'], required: false }
    ]
  });

  const invByStatus = {};
  const invByBranch = {};
  const invByWilayah = {};
  const invByProvinsi = {};
  let invTotalRevenue = 0;
  (invoiceRows || []).forEach(inv => {
    const j = inv.toJSON ? inv.toJSON() : inv;
    invByStatus[j.status] = (invByStatus[j.status] || 0) + 1;
    const bid = j.branch_id;
    if (bid) {
      invByBranch[bid] = invByBranch[bid] || { branch_name: j.Branch?.name, code: j.Branch?.code, count: 0, revenue: 0 };
      invByBranch[bid].count += 1;
      invByBranch[bid].revenue += parseFloat(j.total_amount || 0);
      const provinsiId = j.Branch?.Provinsi?.id || j.Branch?.provinsi_id || branchMap[bid]?.provinsi_id;
      const wilayahId = j.Branch?.Provinsi?.Wilayah?.id || branchMap[bid]?.wilayah_id;
      const provinsiName = j.Branch?.Provinsi?.name || branchMap[bid]?.provinsi_name || 'Tanpa Provinsi';
      const wilayahName = j.Branch?.Provinsi?.Wilayah?.name || branchMap[bid]?.wilayah_name || 'Tanpa Wilayah';
      if (wilayahId) {
        invByWilayah[wilayahId] = invByWilayah[wilayahId] || { wilayah_name: wilayahName, count: 0, revenue: 0 };
        invByWilayah[wilayahId].count += 1;
        invByWilayah[wilayahId].revenue += parseFloat(j.total_amount || 0);
      } else {
        invByWilayah['_none'] = invByWilayah['_none'] || { wilayah_name: 'Tanpa Wilayah', count: 0, revenue: 0 };
        invByWilayah['_none'].count += 1;
        invByWilayah['_none'].revenue += parseFloat(j.total_amount || 0);
      }
      if (provinsiId) {
        invByProvinsi[provinsiId] = invByProvinsi[provinsiId] || { provinsi_name: provinsiName, count: 0, revenue: 0 };
        invByProvinsi[provinsiId].count += 1;
        invByProvinsi[provinsiId].revenue += parseFloat(j.total_amount || 0);
      } else {
        invByProvinsi['_none'] = invByProvinsi['_none'] || { provinsi_name: 'Tanpa Provinsi', count: 0, revenue: 0 };
        invByProvinsi['_none'].count += 1;
        invByProvinsi['_none'].revenue += parseFloat(j.total_amount || 0);
      }
    }
    invTotalRevenue += parseFloat(j.total_amount || 0);
  });

  const invoiceByStatus = {};
  invoiceRows.forEach(i => { const j = i.toJSON ? i.toJSON() : i; invoiceByStatus[j.status] = (invoiceByStatus[j.status] || 0) + 1; });

  const ownersCount = await OwnerProfile.count({
    where: branch_id ? { assigned_branch_id: branch_id } : {}
  });

  const invoicesRecent = await Invoice.findAll({
    where: whereInvoice,
    attributes: ['id', 'invoice_number', 'status', 'total_amount', 'paid_amount', 'cancelled_refund_amount', 'branch_id', 'created_at'],
    include: [
      { model: Order, as: 'Order', attributes: ['id', 'currency_rates_override'] },
      { model: User, as: 'User', attributes: ['id', 'name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      { model: Refund, as: 'Refunds', required: false, attributes: ['id', 'status', 'amount'] }
    ],
    order: [['created_at', 'DESC']],
    limit: 15
  });

  res.json({
    success: true,
    data: {
      branches,
      orders: {
        total: invoiceRows.length,
        by_status: invByStatus,
        by_branch: Object.entries(invByBranch).map(([id, v]) => ({ branch_id: id, ...v })),
        by_wilayah: Object.entries(invByWilayah).map(([id, v]) => ({ wilayah_id: id === '_none' ? null : id, ...v })),
        by_provinsi: Object.entries(invByProvinsi).map(([id, v]) => ({ provinsi_id: id === '_none' ? null : id, ...v })),
        total_revenue: invTotalRevenue
      },
      invoices: { total: invoiceRows.length, by_status: invoiceByStatus },
      owners_total: ownersCount,
      orders_recent: invoicesRecent
    }
  });
});

/**
 * GET /api/v1/admin-pusat/users
 * Daftar user (Super Admin / Admin Pusat). Untuk manajemen user.
 */
const USER_ALLOWED_SORT = ['name', 'email', 'role', 'created_at'];

const listUsers = asyncHandler(async (req, res) => {
  const { role, branch_id, wilayah_id, provinsi_id, kabupaten_id, region, is_active, limit = 25, page = 1, sort_by, sort_order } = req.query;
  const where = {};
  if (role === 'divisi') {
    where.role = { [Op.notIn]: OWNER_ROLES };
  } else if (role === 'owner') {
    where.role = { [Op.in]: OWNER_ROLES };
  } else if (role) {
    where.role = role;
  }
  if (region) where.region = region;
  // Filter is_active: 'true'/'1' = aktif, 'false'/'0' = nonaktif, undefined = hanya aktif (default)
  if (is_active !== undefined && is_active !== '') {
    where.is_active = is_active === 'true' || is_active === '1';
  } else {
    where.is_active = true; // default: hanya tampilkan akun aktif (yang belum dihapus)
  }

  let branchIds = null;
  if (kabupaten_id && String(kabupaten_id).trim()) {
    const kab = await Kabupaten.findByPk(kabupaten_id.trim(), { attributes: ['id', 'nama', 'provinsi_id'] });
    if (kab && kab.provinsi_id) {
      const nama = (kab.nama || '').trim();
      const branchWhere = { provinsi_id: kab.provinsi_id };
      if (nama) branchWhere[Op.or] = [{ city: { [Op.iLike]: `%${nama}%` } }, { name: { [Op.iLike]: `%${nama}%` } }];
      const branchesInKab = await Branch.findAll({ where: branchWhere, attributes: ['id'] });
      branchIds = branchesInKab.length > 0 ? branchesInKab.map((b) => b.id) : [];
    }
  }
  if (branchIds == null && (wilayah_id || provinsi_id)) {
    if (wilayah_id && !provinsi_id) {
      branchIds = await getBranchIdsForWilayah(wilayah_id);
    } else if (provinsi_id) {
      const branches = await Branch.findAll({ where: { provinsi_id, is_active: true }, attributes: ['id'] });
      branchIds = branches.map((b) => b.id);
    }
    if (branchIds && branchIds.length === 0) branchIds = [null];
  }
  if (branch_id) {
    branchIds = [branch_id];
  }

  if (branchIds != null) {
    const orConditions = [
      { branch_id: { [Op.in]: branchIds } },
      { '$OwnerProfile.preferred_branch_id$': { [Op.in]: branchIds } }
    ];
    if (wilayah_id) orConditions.push({ wilayah_id });
    where[Op.or] = orConditions;
  } else if (branch_id) {
    where.branch_id = branch_id;
  }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const sortCol = USER_ALLOWED_SORT.includes(sort_by) ? sort_by : 'created_at';
  const sortDir = (sort_order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const includeBranch = {
    model: Branch,
    as: 'Branch',
    attributes: ['id', 'code', 'name', 'city', 'provinsi_id'],
    required: false,
    include: [
      { model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'wilayah_id'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }
    ]
  };

  const includeOwnerProfile = {
    model: OwnerProfile,
    as: 'OwnerProfile',
    attributes: ['id', 'status', 'preferred_branch_id', 'registration_payment_proof_url', 'registration_payment_amount', 'activation_generated_password', 'is_mou_owner'],
    required: false,
    include: [
      {
        model: Branch,
        as: 'PreferredBranch',
        attributes: ['id', 'code', 'name', 'city', 'provinsi_id'],
        required: false,
        include: [
          { model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'wilayah_id'], required: false, include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }
        ]
      }
    ]
  };

  const includeWilayah = { model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false };

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'email', 'name', 'phone', 'role', 'branch_id', 'wilayah_id', 'region', 'company_name', 'is_active', 'created_at', 'last_login_at'],
    include: [
      includeBranch,
      includeOwnerProfile,
      includeWilayah
    ],
    order: [[sortCol, sortDir]],
    limit: lim,
    offset,
    distinct: true
  });

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const data = rows.map((u) => {
    const j = u.toJSON();
    const isOwner = isOwnerRole(j.role);
    const branchSource = isOwner && j.OwnerProfile?.PreferredBranch ? j.OwnerProfile.PreferredBranch : j.Branch;
    j.branch_name = branchSource?.name ?? null;
    j.branch_code = branchSource?.code ?? null;
    j.city = branchSource?.city ?? null;
    j.provinsi_name = branchSource?.Provinsi?.name ?? null;
    j.wilayah_name = branchSource?.Provinsi?.Wilayah?.name ?? null;
    if (j.wilayah_name == null && j.Wilayah?.name) j.wilayah_name = j.Wilayah.name;
    delete j.Wilayah;
    if (j.OwnerProfile) {
      j.owner_profile_id = j.OwnerProfile.id;
      j.owner_status = j.OwnerProfile.status;
      j.registration_payment_proof_url = j.OwnerProfile.registration_payment_proof_url || null;
      j.registration_payment_amount = j.OwnerProfile.registration_payment_amount != null ? parseFloat(j.OwnerProfile.registration_payment_amount) : null;
      j.activation_generated_password = j.OwnerProfile.activation_generated_password != null ? String(j.OwnerProfile.activation_generated_password) : null;
      j.is_mou_owner = !!j.OwnerProfile.is_mou_owner;
      delete j.OwnerProfile;
    }
    const lastLoginAt = j.last_login_at;
    if (lastLoginAt) {
      const d = new Date(lastLoginAt);
      j.last_login_at = d.toISOString();
      j.is_online = d >= fiveMinAgo;
    } else {
      j.last_login_at = null;
      j.is_online = false;
    }
    delete j.Branch;
    return j;
  });
  const totalPages = Math.ceil(count / lim) || 1;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.json({
    success: true,
    data,
    pagination: { total: count, page: pg, limit: lim, totalPages }
  });
});

/**
 * GET /api/v1/admin-pusat/users/:id
 * Detail user untuk edit. Include OwnerProfile jika role owner.
 */
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findByPk(id, {
    attributes: ['id', 'email', 'name', 'phone', 'role', 'branch_id', 'wilayah_id', 'company_name', 'is_active', 'created_at'],
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'city', 'provinsi_id'], required: false },
      { model: OwnerProfile, as: 'OwnerProfile', attributes: ['id', 'status', 'activation_generated_password', 'assigned_branch_id', 'operational_region', 'is_mou_owner'], required: false }
    ]
  });
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  const j = user.toJSON();
  if (j.OwnerProfile) {
    j.owner_profile_id = j.OwnerProfile.id;
    j.owner_status = j.OwnerProfile.status;
    j.activation_generated_password = j.OwnerProfile.activation_generated_password != null ? String(j.OwnerProfile.activation_generated_password) : null;
    j.assigned_branch_id = j.OwnerProfile.assigned_branch_id;
    j.operational_region = j.OwnerProfile.operational_region;
    if (typeof j.OwnerProfile.is_mou_owner !== 'undefined') j.is_mou_owner = !!j.OwnerProfile.is_mou_owner;
  }
  res.json({ success: true, data: j });
});

const KOORDINATOR_CREATE_ROLES = [ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR];

/**
 * POST /api/v1/admin-pusat/users
 * Buat akun: owner (kabupaten→provinsi&wilayah), koordinator (visa/tiket/invoice pilih wilayah), pusat/bus/hotel/accounting (tanpa wilayah)
 */
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, branch_id, region, provinsi_id, kabupaten_kode, kabupaten_nama } = req.body;
  const allowedRoles = [
    ROLES.OWNER_MOU,
    ROLES.OWNER_NON_MOU,
    ROLES.ROLE_BUS,
    ROLES.ROLE_HOTEL,
    ROLES.ADMIN_PUSAT,
    ROLES.ROLE_ACCOUNTING,
    ROLES.INVOICE_KOORDINATOR,
    ROLES.TIKET_KOORDINATOR,
    ROLES.VISA_KOORDINATOR,
    ROLES.ROLE_INVOICE_SAUDI,
    ROLES.ROLE_HANDLING,
    ROLES.ROLE_SISKOPATUH
  ];
  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'name, email, password, role wajib' });
  }
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Role tidak valid' });
  }
  if (KOORDINATOR_CREATE_ROLES.includes(role) && !region) {
    return res.status(400).json({ success: false, message: 'Koordinator wajib pilih wilayah (provinsi & kota di wilayah tersebut otomatis)' });
  }
  if (OWNER_ROLES.includes(role) && (!provinsi_id || !kabupaten_kode)) {
    return res.status(400).json({ success: false, message: 'owner wajib pilih kabupaten (provinsi_id dan kabupaten_kode)' });
  }

  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });

  let finalBranchId = null;
  let finalRegion = null;
  let finalWilayahId = null;

  if (OWNER_ROLES.includes(role)) {
    const prov = await Provinsi.findByPk(provinsi_id, { attributes: ['id', 'wilayah_id'] });
    if (!prov) return res.status(400).json({ success: false, message: 'Provinsi tidak ditemukan' });
    finalWilayahId = prov.wilayah_id;
    const kabupatenName = (kabupaten_nama || kabupaten_kode || '').trim();
    if (kabupatenName) {
      let branch = await Branch.findOne({
        where: { provinsi_id, is_active: true, city: { [Op.iLike]: `%${kabupatenName}%` } },
        order: [['code', 'ASC']]
      });
      if (!branch) {
        branch = await Branch.findOne({
          where: { provinsi_id, is_active: true },
          order: [['code', 'ASC']]
        });
      }
      if (branch) finalBranchId = branch.id;
    }
  } else if (KOORDINATOR_CREATE_ROLES.includes(role)) {
    finalWilayahId = (region || '').trim() || null;
    if (finalWilayahId) {
      const w = await Wilayah.findByPk(finalWilayahId, { attributes: ['id'] });
      if (!w) return res.status(400).json({ success: false, message: 'Wilayah tidak ditemukan' });
    }
  } else if ([ROLES.ROLE_BUS, ROLES.ROLE_HOTEL, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING, ROLES.ROLE_INVOICE_SAUDI, ROLES.ROLE_HANDLING, ROLES.ROLE_SISKOPATUH].includes(role)) {
    // tidak perlu wilayah
  } else if (branch_id) {
    finalBranchId = branch_id;
    const branch = await Branch.findByPk(branch_id);
    if (!branch) return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan' });
  }

  const user = await User.create({
    email: email.toLowerCase(),
    password_hash: password,
    name,
    role,
    branch_id: finalBranchId,
    region: finalRegion,
    wilayah_id: OWNER_ROLES.includes(role) ? finalWilayahId : (KOORDINATOR_CREATE_ROLES.includes(role) ? finalWilayahId : null),
    is_active: true
  });

  if (OWNER_ROLES.includes(role)) {
    const { OWNER_STATUS } = require('../constants');
    // Owner daftar lewat Admin Pusat: skip workflow (bukti bayar, MOU, aktivasi). Langsung aktif.
    await OwnerProfile.create({
      user_id: user.id,
      status: 'active', // OWNER_STATUS.ACTIVE - langsung bisa dipakai, tanpa verifikasi
      assigned_branch_id: finalBranchId,
      assigned_at: new Date(),
      activated_at: new Date(),
      activated_by: req.user.id,
      operational_region: kabupaten_nama || kabupaten_kode || null
    });
  }

  const u = user.toJSON();
  delete u.password_hash;
  // Agar daftar user langsung tampil "Aktif" untuk owner yang baru dibuat
  if (OWNER_ROLES.includes(role)) u.owner_status = 'active';
  res.status(201).json({ success: true, message: 'Akun berhasil dibuat', data: u });
});

/**
 * PATCH /api/v1/admin-pusat/users/:id
 * Update akun: name, email, phone, company_name, password (opsional), is_active.
 * Juga role & lokasi: region (koordinator), provinsi_id + kabupaten_kode (owner).
 * Jika role owner: bisa sekaligus update owner profile (address, whatsapp, npwp, preferred_branch_id, assigned_branch_id).
 */
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, company_name, password, is_active, address, whatsapp, npwp, preferred_branch_id, role, region, provinsi_id, kabupaten_kode, kabupaten_nama } = req.body;
  const user = await User.findByPk(id);
  if (!user) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (phone !== undefined) updates.phone = phone !== null && phone !== undefined ? String(phone).trim() : null;
  if (company_name !== undefined) updates.company_name = company_name !== null && company_name !== undefined ? String(company_name).trim() : null;
  if (is_active !== undefined) updates.is_active = is_active === true || is_active === 'true' || is_active === '1';
  if (email !== undefined) {
    const newEmail = email.toLowerCase().trim();
    if (newEmail !== user.email) {
      const existing = await User.findOne({ where: { email: newEmail } });
      if (existing) return res.status(400).json({ success: false, message: 'Email sudah digunakan oleh pengguna lain' });
      updates.email = newEmail;
    }
  }
  if (password && String(password).length >= 6) {
    const salt = await bcrypt.genSalt(10);
    updates.password_hash = await bcrypt.hash(password, salt);
  }

  const allowedRoles = [
    ROLES.OWNER_MOU,
    ROLES.OWNER_NON_MOU,
    ROLES.ROLE_BUS,
    ROLES.ROLE_HOTEL,
    ROLES.ADMIN_PUSAT,
    ROLES.ROLE_ACCOUNTING,
    ROLES.INVOICE_KOORDINATOR,
    ROLES.TIKET_KOORDINATOR,
    ROLES.VISA_KOORDINATOR,
    ROLES.ROLE_INVOICE_SAUDI,
    ROLES.ROLE_HANDLING,
    ROLES.ROLE_SISKOPATUH
  ];
  if (role !== undefined && allowedRoles.includes(role)) updates.role = role;
  const currentRole = role !== undefined ? role : user.role;

  // Update lokasi sesuai role (sama seperti createUser)
  let resolvedBranchId = null;
  if (allowedRoles.includes(currentRole)) {
    if (OWNER_ROLES.includes(currentRole) && provinsi_id && kabupaten_kode) {
      const prov = await Provinsi.findByPk(provinsi_id, { attributes: ['id', 'wilayah_id'] });
      if (prov) {
        updates.wilayah_id = prov.wilayah_id;
        const kabupatenName = (kabupaten_nama || kabupaten_kode || '').trim();
        let branch = null;
        if (kabupatenName) {
          branch = await Branch.findOne({
            where: { provinsi_id, is_active: true, city: { [Op.iLike]: `%${kabupatenName}%` } },
            order: [['code', 'ASC']]
          });
        }
        if (!branch) branch = await Branch.findOne({ where: { provinsi_id, is_active: true }, order: [['code', 'ASC']] });
        if (branch) resolvedBranchId = branch.id;
        updates.branch_id = resolvedBranchId;
      }
    } else if (KOORDINATOR_CREATE_ROLES.includes(currentRole) && region !== undefined) {
      updates.wilayah_id = (region || '').trim() || null;
      updates.branch_id = null;
    } else if ([ROLES.ROLE_BUS, ROLES.ROLE_HOTEL, ROLES.ADMIN_PUSAT, ROLES.ROLE_ACCOUNTING, ROLES.ROLE_INVOICE_SAUDI, ROLES.ROLE_HANDLING, ROLES.ROLE_SISKOPATUH].includes(currentRole) && role !== undefined) {
      updates.wilayah_id = null;
      updates.branch_id = null;
    }
  }

  const wasOwner = isOwnerRole(user.role);
  if (Object.keys(updates).length > 0) await user.update(updates);

  if (wasOwner) {
    const profile = await OwnerProfile.findOne({ where: { user_id: id } });
    if (profile) {
      const profileUpdates = {};
      if (address !== undefined) profileUpdates.address = address != null ? String(address).trim() : null;
      if (whatsapp !== undefined) profileUpdates.whatsapp = whatsapp != null ? String(whatsapp).trim() : null;
      if (npwp !== undefined) profileUpdates.npwp = npwp != null ? String(npwp).trim() : null;
      if (preferred_branch_id !== undefined) profileUpdates.preferred_branch_id = preferred_branch_id || null;
      if (password && String(password).length >= 6) profileUpdates.activation_generated_password = null;
      if (provinsi_id && kabupaten_kode) {
        profileUpdates.assigned_branch_id = resolvedBranchId;
        profileUpdates.assigned_at = new Date();
        profileUpdates.operational_region = kabupaten_nama || kabupaten_kode || null;
      }
      if (Object.keys(profileUpdates).length > 0) await profile.update(profileUpdates);
    }
  }

  const u = await User.findByPk(id, {
    attributes: ['id', 'email', 'name', 'phone', 'role', 'branch_id', 'wilayah_id', 'company_name', 'is_active', 'created_at'],
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false },
      { model: OwnerProfile, as: 'OwnerProfile', required: false }
    ]
  });
  const out = u.toJSON();
  if (out.OwnerProfile) {
    out.owner_profile_id = out.OwnerProfile.id;
    out.owner_status = out.OwnerProfile.status;
  }
  if (out.Wilayah) out.wilayah_name = out.Wilayah.name;
  delete out.Wilayah;
  res.json({ success: true, message: 'Akun berhasil diperbarui', data: out });
});

/**
 * DELETE /api/v1/admin-pusat/users/:id
 * Soft delete: set is_active = false agar data hilang dari daftar (tanpa kena FK constraint)
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });
  await user.update({ is_active: false });
  res.json({ success: true, message: 'Akun berhasil dihapus' });
});

/**
 * PUT /api/v1/admin-pusat/products/:id/availability
 * Set ketersediaan awal (acuan general) untuk product. Role hotel/tiket/visa update real-time di flow masing-masing.
 */
const setProductAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity, meta } = req.body;
  const product = await Product.findByPk(id, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });

  let availability = await ProductAvailability.findOne({ where: { product_id: id } });
  if (!availability) {
    availability = await ProductAvailability.create({
      product_id: id,
      quantity: quantity != null ? Number(quantity) : 0,
      meta: meta || {},
      updated_by: req.user.id
    });
  } else {
    await availability.update({
      quantity: quantity != null ? Number(quantity) : availability.quantity,
      meta: meta !== undefined ? meta : availability.meta,
      updated_by: req.user.id
    });
  }
  const data = await ProductAvailability.findByPk(availability.id, {
    include: [{ model: Product, as: 'Product', attributes: ['id', 'code', 'name', 'type'] }]
  });
  res.json({ success: true, data });
});

// ---------- Hotel availability mode (semua jumlah kamar vs per musim) ----------

const getHotelAvailabilityConfigHandler = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'hotel') return res.status(400).json({ success: false, message: 'Bukan product hotel' });
  const config = await getHotelAvailabilityConfig(productId);
  res.json({ success: true, data: config });
});

const setHotelAvailabilityConfigHandler = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { availability_mode, global_room_inventory } = req.body;
  const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'hotel') return res.status(400).json({ success: false, message: 'Bukan product hotel' });

  const validModes = ['global', 'per_season'];
  const mode = availability_mode && validModes.includes(availability_mode) ? availability_mode : 'per_season';
  const roomTypes = ['double', 'triple', 'quad', 'quint'];

  let av = await ProductAvailability.findOne({ where: { product_id: productId } });
  const meta = av?.meta && typeof av.meta === 'object' ? { ...av.meta } : {};
  meta.availability_mode = mode;
  if (mode === 'global' && global_room_inventory && typeof global_room_inventory === 'object') {
    const inv = {};
    for (const rt of roomTypes) {
      inv[rt] = Math.max(0, parseInt(global_room_inventory[rt], 10) || 0);
    }
    meta.global_room_inventory = inv;
    // Samakan room_types agar getHotelAvailabilityConfig (prioritas room_types) tetap konsisten setelah tambah kuota dari kalender
    const rtMeta = meta.room_types && typeof meta.room_types === 'object' ? { ...meta.room_types } : {};
    for (const rt of roomTypes) {
      rtMeta[rt] = inv[rt];
    }
    meta.room_types = rtMeta;
  }
  // When switching to per_season, keep existing global_room_inventory so user can switch back without re-entering

  if (!av) {
    av = await ProductAvailability.create({
      product_id: productId,
      quantity: 0,
      meta,
      updated_by: req.user.id
    });
  } else {
    av.meta = JSON.parse(JSON.stringify(meta));
    av.updated_by = req.user.id;
    av.changed('meta', true);
    await av.save();
  }

  const config = await getHotelAvailabilityConfig(productId);
  res.json({ success: true, data: config, message: 'Pengaturan jumlah kamar disimpan' });
});

// ---------- Hotel seasons & room inventory (data per musim, realtime availability) ----------

const listSeasons = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'hotel') return res.status(400).json({ success: false, message: 'Bukan product hotel' });
  const seasons = await HotelSeason.findAll({
    where: { product_id: productId },
    order: [['start_date', 'ASC']],
    include: [{ model: HotelRoomInventory, as: 'RoomInventory', attributes: ['id', 'room_type', 'total_rooms'] }]
  });
  res.json({ success: true, data: seasons });
});

const createSeason = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { name, start_date, end_date, meta } = req.body;
  const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'hotel') return res.status(400).json({ success: false, message: 'Bukan product hotel' });
  if (!name || !start_date || !end_date) return res.status(400).json({ success: false, message: 'name, start_date, end_date wajib' });
  const season = await HotelSeason.create({
    product_id: productId,
    name: name.trim(),
    start_date,
    end_date,
    meta: meta || {},
    created_by: req.user.id
  });
  const full = await HotelSeason.findByPk(season.id, { include: [{ model: HotelRoomInventory, as: 'RoomInventory' }] });
  res.status(201).json({ success: true, data: full });
});

const updateSeason = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const { name, start_date, end_date, meta } = req.body;
  const season = await HotelSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Musim tidak ditemukan' });
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (meta !== undefined) updates.meta = meta;
  await season.update(updates);
  const full = await HotelSeason.findByPk(season.id, { include: [{ model: HotelRoomInventory, as: 'RoomInventory' }] });
  res.json({ success: true, data: full });
});

const deleteSeason = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const season = await HotelSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Musim tidak ditemukan' });
  await season.destroy();
  res.json({ success: true, message: 'Musim dihapus' });
});

const setSeasonInventory = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const { inventory } = req.body;
  const season = await HotelSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Musim tidak ditemukan' });
  if (!Array.isArray(inventory)) return res.status(400).json({ success: false, message: 'inventory harus array [{ room_type, total_rooms }]' });
  await HotelRoomInventory.destroy({ where: { season_id: seasonId } });
  for (const row of inventory) {
    const rt = row.room_type && String(row.room_type).trim().toLowerCase();
    const total = parseInt(row.total_rooms, 10) || 0;
    if (!rt) continue;
    await HotelRoomInventory.create({
      product_id: productId,
      season_id: seasonId,
      room_type: rt,
      total_rooms: Math.max(0, total)
    });
  }
  const list = await HotelRoomInventory.findAll({ where: { season_id: seasonId } });
  res.json({ success: true, data: list });
});

// ---------- Visa seasons & quota (kalender visa) ----------

const listVisaSeasons = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'visa') return res.status(400).json({ success: false, message: 'Bukan product visa' });
  const seasons = await VisaSeason.findAll({
    where: { product_id: productId },
    order: [['start_date', 'ASC']],
    include: [{ model: VisaSeasonQuota, as: 'Quota', attributes: ['id', 'quota'] }]
  });
  res.json({ success: true, data: seasons });
});

const createVisaSeason = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { name, start_date, end_date, quota, meta } = req.body;
  const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'visa') return res.status(400).json({ success: false, message: 'Bukan product visa' });
  if (!name || !start_date || !end_date) return res.status(400).json({ success: false, message: 'name, start_date, end_date wajib' });
  const season = await VisaSeason.create({
    product_id: productId,
    name: name.trim(),
    start_date,
    end_date,
    meta: meta || {},
    created_by: req.user.id
  });
  const q = Math.max(0, parseInt(quota, 10) || 0);
  await VisaSeasonQuota.create({ product_id: productId, season_id: season.id, quota: q });
  const full = await VisaSeason.findByPk(season.id, { include: [{ model: VisaSeasonQuota, as: 'Quota' }] });
  res.status(201).json({ success: true, data: full });
});

const updateVisaSeason = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const { name, start_date, end_date, meta } = req.body;
  const season = await VisaSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Periode visa tidak ditemukan' });
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (meta !== undefined) updates.meta = meta;
  await season.update(updates);
  const full = await VisaSeason.findByPk(season.id, { include: [{ model: VisaSeasonQuota, as: 'Quota' }] });
  res.json({ success: true, data: full });
});

const deleteVisaSeason = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const season = await VisaSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Periode visa tidak ditemukan' });
  await season.destroy();
  res.json({ success: true, message: 'Periode visa dihapus' });
});

const setVisaSeasonQuota = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const { quota } = req.body;
  const season = await VisaSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Periode visa tidak ditemukan' });
  const q = Math.max(0, parseInt(quota, 10) || 0);
  let row = await VisaSeasonQuota.findOne({ where: { season_id: seasonId } });
  if (row) {
    row.quota = q;
    await row.save();
  } else {
    row = await VisaSeasonQuota.create({ product_id: productId, season_id: seasonId, quota: q });
  }
  res.json({ success: true, data: row });
});

// ---------- Ticket seasons & quota (kuota tiket per periode) ----------

const listTicketSeasons = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'ticket') return res.status(400).json({ success: false, message: 'Bukan product tiket' });
  const seasons = await TicketSeason.findAll({
    where: { product_id: productId },
    order: [['start_date', 'ASC']],
    include: [{ model: TicketSeasonQuota, as: 'Quota', attributes: ['id', 'quota'] }]
  });
  res.json({ success: true, data: seasons });
});

const createTicketSeason = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { name, start_date, end_date, quota, meta } = req.body;
  const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'ticket') return res.status(400).json({ success: false, message: 'Bukan product tiket' });
  if (!name || !start_date || !end_date) return res.status(400).json({ success: false, message: 'name, start_date, end_date wajib' });
  const season = await TicketSeason.create({
    product_id: productId,
    name: name.trim(),
    start_date,
    end_date,
    meta: meta || {},
    created_by: req.user.id
  });
  const q = Math.max(0, parseInt(quota, 10) || 0);
  await TicketSeasonQuota.create({ product_id: productId, season_id: season.id, quota: q });
  const full = await TicketSeason.findByPk(season.id, { include: [{ model: TicketSeasonQuota, as: 'Quota' }] });
  res.status(201).json({ success: true, data: full });
});

const updateTicketSeason = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const { name, start_date, end_date, meta } = req.body;
  const season = await TicketSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Periode tiket tidak ditemukan' });
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (meta !== undefined) updates.meta = meta;
  await season.update(updates);
  const full = await TicketSeason.findByPk(season.id, { include: [{ model: TicketSeasonQuota, as: 'Quota' }] });
  res.json({ success: true, data: full });
});

const deleteTicketSeason = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const season = await TicketSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Periode tiket tidak ditemukan' });
  await season.destroy();
  res.json({ success: true, message: 'Periode tiket dihapus' });
});

const setTicketSeasonQuota = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const { quota } = req.body;
  const season = await TicketSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Periode tiket tidak ditemukan' });
  const q = Math.max(0, parseInt(quota, 10) || 0);
  let row = await TicketSeasonQuota.findOne({ where: { season_id: seasonId } });
  if (row) {
    row.quota = q;
    await row.save();
  } else {
    row = await TicketSeasonQuota.create({ product_id: productId, season_id: seasonId, quota: q });
  }
  res.json({ success: true, data: row });
});

// ---------- Bus seasons & quota (kuota bus per periode) ----------

const listBusSeasons = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'bus') return res.status(400).json({ success: false, message: 'Bukan product bus' });
  const seasons = await BusSeason.findAll({
    where: { product_id: productId },
    order: [['start_date', 'ASC']],
    include: [{ model: BusSeasonQuota, as: 'Quota', attributes: ['id', 'quota'] }]
  });
  res.json({ success: true, data: seasons });
});

const createBusSeason = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { name, start_date, end_date, quota, meta } = req.body;
  const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
  if (!product) return res.status(404).json({ success: false, message: 'Product tidak ditemukan' });
  if (product.type !== 'bus') return res.status(400).json({ success: false, message: 'Bukan product bus' });
  if (!name || !start_date || !end_date) return res.status(400).json({ success: false, message: 'name, start_date, end_date wajib' });
  const season = await BusSeason.create({
    product_id: productId,
    name: name.trim(),
    start_date,
    end_date,
    meta: meta || {},
    created_by: req.user.id
  });
  const q = Math.max(0, parseInt(quota, 10) || 0);
  await BusSeasonQuota.create({ product_id: productId, season_id: season.id, quota: q });
  const full = await BusSeason.findByPk(season.id, { include: [{ model: BusSeasonQuota, as: 'Quota' }] });
  res.status(201).json({ success: true, data: full });
});

const updateBusSeason = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const { name, start_date, end_date, meta } = req.body;
  const season = await BusSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Periode bus tidak ditemukan' });
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (meta !== undefined) updates.meta = meta;
  await season.update(updates);
  const full = await BusSeason.findByPk(season.id, { include: [{ model: BusSeasonQuota, as: 'Quota' }] });
  res.json({ success: true, data: full });
});

const deleteBusSeason = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const season = await BusSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Periode bus tidak ditemukan' });
  await season.destroy();
  res.json({ success: true, message: 'Periode bus dihapus' });
});

const setBusSeasonQuota = asyncHandler(async (req, res) => {
  const { productId, seasonId } = req.params;
  const { quota } = req.body;
  const season = await BusSeason.findOne({ where: { id: seasonId, product_id: productId } });
  if (!season) return res.status(404).json({ success: false, message: 'Periode bus tidak ditemukan' });
  const q = Math.max(0, parseInt(quota, 10) || 0);
  let row = await BusSeasonQuota.findOne({ where: { season_id: seasonId } });
  if (row) {
    row.quota = q;
    await row.save();
  } else {
    row = await BusSeasonQuota.create({ product_id: productId, season_id: seasonId, quota: q });
  }
  res.json({ success: true, data: row });
});

module.exports = {
  getDashboard,
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  setProductAvailability,
  getHotelAvailabilityConfig: getHotelAvailabilityConfigHandler,
  setHotelAvailabilityConfig: setHotelAvailabilityConfigHandler,
  listSeasons,
  createSeason,
  updateSeason,
  deleteSeason,
  setSeasonInventory,
  listVisaSeasons,
  createVisaSeason,
  updateVisaSeason,
  deleteVisaSeason,
  setVisaSeasonQuota,
  listTicketSeasons,
  createTicketSeason,
  updateTicketSeason,
  deleteTicketSeason,
  setTicketSeasonQuota,
  listBusSeasons,
  createBusSeason,
  updateBusSeason,
  deleteBusSeason,
  setBusSeasonQuota,
  syncLocation
};
