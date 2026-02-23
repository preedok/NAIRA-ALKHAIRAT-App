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
  OwnerProfile,
  Invoice,
  HotelProgress,
  VisaProgress,
  TicketProgress,
  BusProgress,
  Product,
  ProductAvailability,
  HotelSeason,
  HotelRoomInventory
} = require('../models');
const { ROLES, ORDER_ITEM_TYPE } = require('../constants');

/**
 * GET /api/v1/admin-pusat/dashboard
 * Rekapitulasi transaksi dan pekerjaan per cabang. Filter: branch_id, date_from, date_to.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const { branch_id, date_from, date_to, status, provinsi_id, wilayah_id } = req.query;
  const whereOrder = {};
  if (branch_id) whereOrder.branch_id = branch_id;
  if (status) whereOrder.status = status;
  if (date_from || date_to) {
    whereOrder.created_at = {};
    if (date_from) whereOrder.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      whereOrder.created_at[Op.lte] = d;
    }
  }
  if (provinsi_id || wilayah_id) {
    const branchWhere = { is_active: true };
    if (provinsi_id) branchWhere.provinsi_id = provinsi_id;
    const branchOpts = { where: branchWhere, attributes: ['id'] };
    if (wilayah_id) {
      branchOpts.include = [{ model: Provinsi, as: 'Provinsi', attributes: [], required: true, where: { wilayah_id } }];
    }
    const branchIds = (await Branch.findAll(branchOpts)).map(r => r.id);
    if (branchIds.length > 0) {
      whereOrder.branch_id = branch_id ? (branchIds.includes(branch_id) ? branch_id : 'none') : { [Op.in]: branchIds };
    } else {
      whereOrder.branch_id = 'none';
    }
  }

  const branches = await Branch.findAll({ where: { is_active: true }, order: [['code', 'ASC']] });
  const branchWithProvinsi = await Branch.findAll({
    where: { is_active: true },
    attributes: ['id', 'code', 'name', 'provinsi_id'],
    include: [
      { model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'kode', 'wilayah_id'], required: false,
        include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }
    ]
  });
  const branchMap = branchWithProvinsi.reduce((acc, b) => {
    const j = b.toJSON();
    acc[j.id] = { provinsi_id: j.provinsi_id, provinsi_name: j.Provinsi?.name, wilayah_id: j.Provinsi?.Wilayah?.id, wilayah_name: j.Provinsi?.Wilayah?.name };
    return acc;
  }, {});

  const orderCounts = await Order.findAndCountAll({
    where: whereOrder,
    attributes: ['id', 'status', 'total_amount', 'branch_id', 'created_at'],
    include: [{ model: Branch, as: 'Branch', attributes: ['id', 'code', 'name', 'provinsi_id'], required: false,
      include: [{ model: Provinsi, as: 'Provinsi', attributes: ['id', 'name', 'wilayah_id'], required: false,
        include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'], required: false }] }] },
    { model: User, as: 'User', attributes: ['id', 'name'] }]
  });

  const byStatus = {};
  const byBranch = {};
  const byWilayah = {};
  const byProvinsi = {};
  let totalRevenue = 0;
  (orderCounts.rows || []).forEach(o => {
    const j = o.toJSON();
    byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    const bid = j.branch_id;
    if (bid) {
      byBranch[bid] = byBranch[bid] || { branch_name: j.Branch?.name, code: j.Branch?.code, count: 0, revenue: 0 };
      byBranch[bid].count += 1;
      byBranch[bid].revenue += parseFloat(j.total_amount || 0);
      const provinsiId = j.Branch?.Provinsi?.id || j.Branch?.provinsi_id || branchMap[bid]?.provinsi_id;
      const wilayahId = j.Branch?.Provinsi?.Wilayah?.id || branchMap[bid]?.wilayah_id;
      const provinsiName = j.Branch?.Provinsi?.name || branchMap[bid]?.provinsi_name || 'Tanpa Provinsi';
      const wilayahName = j.Branch?.Provinsi?.Wilayah?.name || branchMap[bid]?.wilayah_name || 'Tanpa Wilayah';
      if (wilayahId) {
        byWilayah[wilayahId] = byWilayah[wilayahId] || { wilayah_name: wilayahName, count: 0, revenue: 0 };
        byWilayah[wilayahId].count += 1;
        byWilayah[wilayahId].revenue += parseFloat(j.total_amount || 0);
      } else {
        byWilayah['_none'] = byWilayah['_none'] || { wilayah_name: 'Tanpa Wilayah', count: 0, revenue: 0 };
        byWilayah['_none'].count += 1;
        byWilayah['_none'].revenue += parseFloat(j.total_amount || 0);
      }
      if (provinsiId) {
        byProvinsi[provinsiId] = byProvinsi[provinsiId] || { provinsi_name: provinsiName, count: 0, revenue: 0 };
        byProvinsi[provinsiId].count += 1;
        byProvinsi[provinsiId].revenue += parseFloat(j.total_amount || 0);
      } else {
        byProvinsi['_none'] = byProvinsi['_none'] || { provinsi_name: 'Tanpa Provinsi', count: 0, revenue: 0 };
        byProvinsi['_none'].count += 1;
        byProvinsi['_none'].revenue += parseFloat(j.total_amount || 0);
      }
    }
    if (!['draft', 'cancelled'].includes(j.status)) totalRevenue += parseFloat(j.total_amount || 0);
  });

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
    const branchWhere = { is_active: true };
    if (provinsi_id) branchWhere.provinsi_id = provinsi_id;
    const branchOpts = { where: branchWhere, attributes: ['id'] };
    if (wilayah_id) {
      branchOpts.include = [{ model: Provinsi, as: 'Provinsi', attributes: [], required: true, where: { wilayah_id } }];
    }
    const branchIdsForInv = (await Branch.findAll(branchOpts)).map(r => r.id);
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
    include: [
      { model: Order, as: 'Order', attributes: ['id', 'order_number'] },
      { model: User, as: 'User', attributes: ['id', 'name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] }
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
  const { role, branch_id, wilayah_id, provinsi_id, region, is_active, limit = 25, page = 1, sort_by, sort_order } = req.query;
  const where = {};
  if (role === 'divisi') {
    where.role = { [Op.ne]: ROLES.OWNER };
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
  if (wilayah_id || provinsi_id) {
    const branchWhere = {};
    if (provinsi_id) branchWhere.provinsi_id = provinsi_id;
    const branchOpts = { attributes: ['id'] };
    if (wilayah_id && !provinsi_id) {
      branchOpts.include = [{ model: Provinsi, as: 'Provinsi', attributes: [], required: true, where: { wilayah_id } }];
    }
    const branches = await Branch.findAll({ where: branchWhere, ...branchOpts });
    branchIds = branches.map((b) => b.id);
    if (branchIds.length === 0) branchIds = [null];
  }
  if (branch_id) {
    branchIds = [branch_id];
  }

  if (branchIds != null) {
    where[Op.or] = [
      { branch_id: { [Op.in]: branchIds } },
      { '$OwnerProfile.preferred_branch_id$': { [Op.in]: branchIds } }
    ];
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
    attributes: ['id', 'status', 'preferred_branch_id', 'registration_payment_proof_url', 'registration_payment_amount', 'activation_generated_password'],
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

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'email', 'name', 'phone', 'role', 'branch_id', 'region', 'company_name', 'is_active', 'created_at'],
    include: [
      includeBranch,
      includeOwnerProfile
    ],
    order: [[sortCol, sortDir]],
    limit: lim,
    offset,
    distinct: true
  });

  const data = rows.map((u) => {
    const j = u.toJSON();
    const isOwner = j.role === ROLES.OWNER;
    const branchSource = isOwner && j.OwnerProfile?.PreferredBranch ? j.OwnerProfile.PreferredBranch : j.Branch;
    j.branch_name = branchSource?.name ?? null;
    j.branch_code = branchSource?.code ?? null;
    j.city = branchSource?.city ?? null;
    j.provinsi_name = branchSource?.Provinsi?.name ?? null;
    j.wilayah_name = branchSource?.Provinsi?.Wilayah?.name ?? null;
    if (j.OwnerProfile) {
      j.owner_profile_id = j.OwnerProfile.id;
      j.owner_status = j.OwnerProfile.status;
      j.registration_payment_proof_url = j.OwnerProfile.registration_payment_proof_url || null;
      j.registration_payment_amount = j.OwnerProfile.registration_payment_amount != null ? parseFloat(j.OwnerProfile.registration_payment_amount) : null;
      j.activation_generated_password = j.OwnerProfile.activation_generated_password != null ? String(j.OwnerProfile.activation_generated_password) : null;
      delete j.OwnerProfile;
    }
    delete j.Branch;
    return j;
  });
  const totalPages = Math.ceil(count / lim) || 1;
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
    attributes: ['id', 'email', 'name', 'phone', 'role', 'branch_id', 'company_name', 'is_active', 'created_at'],
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: OwnerProfile, as: 'OwnerProfile', attributes: ['id', 'status', 'activation_generated_password'], required: false }
    ]
  });
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
  const j = user.toJSON();
  if (j.OwnerProfile) {
    j.owner_profile_id = j.OwnerProfile.id;
    j.owner_status = j.OwnerProfile.status;
    j.activation_generated_password = j.OwnerProfile.activation_generated_password != null ? String(j.OwnerProfile.activation_generated_password) : null;
  }
  res.json({ success: true, data: j });
});

/**
 * POST /api/v1/admin-pusat/users
 * Buat akun: role_bus, role_hotel (Saudi), admin_wilayah, admin_provinsi
 */
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, branch_id, region } = req.body;
  const allowedRoles = [ROLES.ROLE_BUS, ROLES.ROLE_HOTEL, ROLES.ADMIN_WILAYAH, ROLES.ADMIN_PROVINSI];
  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'name, email, password, role wajib' });
  }
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Role harus role_bus, role_hotel, admin_wilayah, atau admin_provinsi' });
  }
  if (role === ROLES.ADMIN_WILAYAH && !region) {
    return res.status(400).json({ success: false, message: 'admin_wilayah wajib punya region (wilayah: Sumatra, Jawa, dll)' });
  }
  if (role === ROLES.ADMIN_PROVINSI && !region) {
    return res.status(400).json({ success: false, message: 'admin_provinsi wajib punya region (provinsi)' });
  }

  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });

  const finalBranchId = [ROLES.ROLE_BUS, ROLES.ROLE_HOTEL, ROLES.ADMIN_WILAYAH, ROLES.ADMIN_PROVINSI].includes(role) ? null : (branch_id || null);
  const finalRegion = [ROLES.ADMIN_WILAYAH, ROLES.ADMIN_PROVINSI].includes(role) ? (region || '').trim() : null;

  if (finalBranchId) {
    const branch = await Branch.findByPk(finalBranchId);
    if (!branch) return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan' });
  }

  const user = await User.create({
    email: email.toLowerCase(),
    password_hash: password,
    name,
    role,
    branch_id: finalBranchId,
    region: finalRegion,
    is_active: true
  });

  const u = user.toJSON();
  delete u.password_hash;
  res.status(201).json({ success: true, message: 'Akun berhasil dibuat', data: u });
});

/**
 * PATCH /api/v1/admin-pusat/users/:id
 * Update akun: name, email, phone, company_name, password (opsional), is_active.
 * Jika role owner: bisa sekaligus update owner profile (address, whatsapp, npwp, preferred_branch_id).
 */
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, company_name, password, is_active, address, whatsapp, npwp, preferred_branch_id } = req.body;
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
  if (Object.keys(updates).length > 0) await user.update(updates);

  if (user.role === ROLES.OWNER) {
    const profile = await OwnerProfile.findOne({ where: { user_id: id } });
    if (profile) {
      const profileUpdates = {};
      if (address !== undefined) profileUpdates.address = address != null ? String(address).trim() : null;
      if (whatsapp !== undefined) profileUpdates.whatsapp = whatsapp != null ? String(whatsapp).trim() : null;
      if (npwp !== undefined) profileUpdates.npwp = npwp != null ? String(npwp).trim() : null;
      if (preferred_branch_id !== undefined) profileUpdates.preferred_branch_id = preferred_branch_id || null;
      if (password && String(password).length >= 6) profileUpdates.activation_generated_password = null;
      if (Object.keys(profileUpdates).length > 0) await profile.update(profileUpdates);
    }
  }

  const u = await User.findByPk(id, {
    attributes: ['id', 'email', 'name', 'phone', 'role', 'branch_id', 'company_name', 'is_active', 'created_at'],
    include: [
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'], required: false },
      { model: OwnerProfile, as: 'OwnerProfile', required: false }
    ]
  });
  const out = u.toJSON();
  if (out.OwnerProfile) {
    out.owner_profile_id = out.OwnerProfile.id;
    out.owner_status = out.OwnerProfile.status;
  }
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
  const product = await Product.findByPk(id);
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

module.exports = {
  getDashboard,
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  setProductAvailability,
  listSeasons,
  createSeason,
  updateSeason,
  deleteSeason,
  setSeasonInventory
};
