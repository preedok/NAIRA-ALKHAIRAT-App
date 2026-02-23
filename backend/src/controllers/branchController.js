const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const { Branch, User, Wilayah, Provinsi } = require('../models');
const { ROLES } = require('../constants');
const { Op } = require('sequelize');
const { getKabupatenByProvince, formatBranchName, extractCity } = require('../utils/indonesiaApi');
const { getCoordinatorForRegion } = require('../utils/coordinatorByRegion');

const ALLOWED_SORT = ['code', 'name', 'city', 'region', 'manager_name', 'is_active', 'created_at'];

const listProvinces = asyncHandler(async (req, res) => {
  const provinsi = await Provinsi.findAll({
    attributes: ['id', 'kode', 'name', 'wilayah_id'],
    include: [{ model: Wilayah, as: 'Wilayah', attributes: ['id', 'name'] }],
    order: [['kode', 'ASC']]
  });
  const data = provinsi.map((p) => ({
    id: p.id,
    kode: p.kode,
    nama: p.name,
    name: p.name,
    wilayah_id: p.wilayah_id,
    wilayah: p.Wilayah ? p.Wilayah.name : null
  }));
  res.json({ success: true, data });
});

const listWilayah = asyncHandler(async (req, res) => {
  const wilayah = await Wilayah.findAll({
    attributes: ['id', 'name'],
    order: [['name', 'ASC']]
  });
  const data = wilayah.map((w) => ({ id: w.id, name: w.name }));
  res.json({ success: true, data });
});

const listKabupaten = asyncHandler(async (req, res) => {
  const { provinceId } = req.params;
  if (!provinceId) return res.status(400).json({ success: false, message: 'Province ID required' });
  let kode = provinceId;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(String(provinceId).trim())) {
    const prov = await Provinsi.findByPk(provinceId, { attributes: ['kode'] });
    if (!prov) return res.status(404).json({ success: false, message: 'Provinsi tidak ditemukan' });
    kode = prov.kode;
  }
  const kabupaten = await getKabupatenByProvince(kode);
  res.json({ success: true, data: kabupaten });
});

const listPublic = asyncHandler(async (req, res) => {
  const { search, region, limit = 500 } = req.query;
  const lim = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 1000);
  const where = { is_active: true };
  if (region) where.region = region;
  if (search && typeof search === 'string' && search.trim()) {
    const q = `%${search.trim()}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: q } },
      { code: { [Op.iLike]: q } },
      { city: { [Op.iLike]: q } },
      { region: { [Op.iLike]: q } }
    ];
  }
  const rows = await Branch.findAll({
    where,
    attributes: ['id', 'code', 'name', 'city', 'region', 'koordinator_provinsi', 'koordinator_provinsi_phone', 'koordinator_provinsi_email', 'koordinator_wilayah', 'koordinator_wilayah_phone', 'koordinator_wilayah_email'],
    order: [['region', 'ASC'], ['name', 'ASC']],
    limit: lim
  });
  res.json({ success: true, data: rows });
});

const KOORDINATOR_ROLES = [ROLES.ADMIN_KOORDINATOR, ROLES.INVOICE_KOORDINATOR, ROLES.TIKET_KOORDINATOR, ROLES.VISA_KOORDINATOR];
const list = asyncHandler(async (req, res) => {
  const { limit = 25, page = 1, include_inactive, search, region, provinsi_id, wilayah_id: qWilayahId, city, is_active, sort_by, sort_order } = req.query;
  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  let wilayah_id = qWilayahId;
  if (KOORDINATOR_ROLES.includes(req.user?.role) && req.user?.wilayah_id) {
    wilayah_id = req.user.wilayah_id;
  }

  const where = {};
  if (is_active === 'true' || is_active === '1') where.is_active = true;
  else if (is_active === 'false' || is_active === '0') where.is_active = false;
  else if (include_inactive !== 'true' && include_inactive !== '1') where.is_active = true;
  if (region) where.region = region;
  if (provinsi_id) where.provinsi_id = provinsi_id;
  if (city && typeof city === 'string' && city.trim()) where.city = { [Op.iLike]: `%${city.trim()}%` };
  if (search && typeof search === 'string' && search.trim()) {
    const q = `%${search.trim()}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: q } },
      { code: { [Op.iLike]: q } },
      { city: { [Op.iLike]: q } },
      { region: { [Op.iLike]: q } }
    ];
  }

  const sortCol = ALLOWED_SORT.includes(sort_by) ? sort_by : 'code';
  const sortDir = (sort_order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const includeOpt = wilayah_id ? [{ model: Provinsi, as: 'Provinsi', attributes: [], required: true, where: { wilayah_id } }] : [];
  const { count, rows } = await Branch.findAndCountAll({
    where,
    include: includeOpt,
    order: [[sortCol, sortDir]],
    limit: lim,
    offset,
    distinct: true
  });
  const totalPages = Math.ceil(count / lim) || 1;
  res.json({
    success: true,
    data: rows,
    pagination: { total: count, page: pg, limit: lim, totalPages }
  });
});

const getById = asyncHandler(async (req, res) => {
  const branch = await Branch.findByPk(req.params.id);
  if (!branch) return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan' });
  const adminUser = await User.findOne({
    where: { branch_id: branch.id, role: ROLES.ADMIN_CABANG },
    attributes: ['id', 'email', 'name', 'role', 'is_active']
  });
  const data = branch.toJSON();
  data.admin_user = adminUser ? adminUser.toJSON() : null;
  res.json({ success: true, data });
});

const generateCode = async (region, city) => {
  const prefix = (region || 'ID').replace(/\s+/g, '').slice(0, 3).toUpperCase() || 'BR';
  const existing = await Branch.findOne({
    where: { code: { [Op.like]: `${prefix}-%` } },
    order: [['created_at', 'DESC']],
    attributes: ['code']
  });
  let num = 1;
  if (existing && existing.code) {
    const m = existing.code.match(/-(\d+)$/);
    if (m) num = parseInt(m[1], 10) + 1;
  }
  return `${prefix}-${String(num).padStart(3, '0')}`;
};

const create = asyncHandler(async (req, res) => {
  const {
    code, name, city, region, manager_name, phone, email, address,
    province_id, kabupaten_id,
    create_admin_account
  } = req.body;

  let finalCode = code;
  let finalName = name;
  let finalCity = city;
  let finalRegion = region;

  if (province_id && kabupaten_id) {
    const prov = await Provinsi.findByPk(province_id);
    if (!prov) return res.status(400).json({ success: false, message: 'Provinsi tidak ditemukan' });
    const kabList = await getKabupatenByProvince(prov.kode);
    const kab = kabList.find((k) => String(k.id) === String(kabupaten_id));
    if (!kab) return res.status(400).json({ success: false, message: 'Kabupaten/kota tidak ditemukan' });
    const kabCode = String(kab.id || '').trim();
    const existingByKabCode = await Branch.findOne({ where: { code: kabCode } });
    if (existingByKabCode) {
      return res.status(400).json({ success: false, message: 'Kabupaten/kota ini sudah terdaftar sebagai cabang' });
    }
    finalCode = kabCode;
    finalName = formatBranchName(kab.nama);
    finalCity = extractCity(kab.nama) || finalName;
    finalRegion = (prov.name || '').trim();
  }

  if (!finalName || !finalCity || !finalRegion) {
    return res.status(400).json({ success: false, message: 'Nama, kota, dan provinsi wajib diisi' });
  }

  let codeToUse = finalCode;
  if (!codeToUse || codeToUse.length < 2) {
    codeToUse = await generateCode(finalRegion, finalCity);
  } else {
    const existingByCode = await Branch.findOne({ where: { code: codeToUse } });
    if (existingByCode) {
      return res.status(400).json({ success: false, message: `Kode ${codeToUse} sudah digunakan` });
    }
  }

  const coord = finalRegion ? getCoordinatorForRegion(finalRegion) : null;
  const koordWilayah = finalName ? `Koord. ${finalName}` : null;

  const provinsiIdForBranch = (province_id && kabupaten_id) ? province_id : null;

  const branch = await Branch.create({
    code: codeToUse,
    name: finalName,
    city: finalCity,
    region: finalRegion || null,
    provinsi_id: provinsiIdForBranch,
    manager_name: manager_name || null,
    phone: phone || null,
    email: email || null,
    address: address || null,
    koordinator_provinsi: coord ? coord.name : null,
    koordinator_provinsi_phone: coord ? coord.phone : null,
    koordinator_provinsi_email: coord ? coord.email : null,
    koordinator_wilayah: koordWilayah,
    koordinator_wilayah_phone: coord ? coord.phone : null,
    koordinator_wilayah_email: coord ? coord.email : null
  });

  let adminUser = null;
  if (create_admin_account && typeof create_admin_account === 'object') {
    const { name: accName, email: accEmail, password: accPassword } = create_admin_account;
    if (accName && accEmail && accPassword) {
      const existing = await User.findOne({ where: { email: accEmail.toLowerCase() } });
      if (existing) {
        await branch.destroy();
        return res.status(400).json({ success: false, message: 'Email untuk akun admin cabang sudah terdaftar' });
      }
      adminUser = await User.create({
        email: accEmail.toLowerCase(),
        password_hash: accPassword,
        name: accName,
        role: ROLES.ADMIN_CABANG,
        branch_id: branch.id,
        is_active: true
      });
      adminUser = adminUser.toJSON();
      delete adminUser.password_hash;
    }
  }

  const data = branch.toJSON();
  if (adminUser) data.created_admin_account = adminUser;
  res.status(201).json({ success: true, data, message: adminUser ? 'Cabang dan akun admin cabang berhasil dibuat' : 'Cabang berhasil dibuat' });
});

const createBulkByProvince = asyncHandler(async (req, res) => {
  const { province_id } = req.body;
  if (!province_id) return res.status(400).json({ success: false, message: 'Province ID wajib diisi' });

  const prov = await Provinsi.findByPk(province_id);
  if (!prov) return res.status(400).json({ success: false, message: 'Provinsi tidak ditemukan' });

  const kabList = await getKabupatenByProvince(prov.kode);
  const region = (prov.name || '').trim();
  const coord = region ? getCoordinatorForRegion(region) : null;

  const allExisting = await Branch.findAll({ attributes: ['code'] });
  const existingCodes = new Set(allExisting.map((b) => b.code));

  const toCreate = [];
  for (const kab of kabList) {
    const code = String(kab.id || '').trim();
    if (!code || existingCodes.has(code)) continue;
    existingCodes.add(code);
    const name = formatBranchName(kab.nama);
    const city = extractCity(kab.nama) || name;
    toCreate.push({
      code,
      name,
      city,
      region,
      provinsi_id: prov.id,
      koordinator_provinsi: coord ? coord.name : null,
      koordinator_provinsi_phone: coord ? coord.phone : null,
      koordinator_provinsi_email: coord ? coord.email : null,
      koordinator_wilayah: `Koord. ${name}`,
      koordinator_wilayah_phone: coord ? coord.phone : null,
      koordinator_wilayah_email: coord ? coord.email : null,
      is_active: true
    });
  }

  if (toCreate.length === 0) {
    return res.json({ success: true, data: [], message: 'Semua kabupaten/kota di provinsi ini sudah terdaftar', created: 0 });
  }

  await Branch.bulkCreate(toCreate);
  res.status(201).json({
    success: true,
    data: toCreate,
    message: `${toCreate.length} cabang berhasil ditambahkan untuk provinsi ${region}`,
    created: toCreate.length
  });
});

const COORDINATOR_FIELDS = [
  'koordinator_provinsi', 'koordinator_provinsi_phone', 'koordinator_provinsi_email',
  'koordinator_wilayah', 'koordinator_wilayah_phone', 'koordinator_wilayah_email'
];

const update = asyncHandler(async (req, res) => {
  const branch = await Branch.findByPk(req.params.id);
  if (!branch) return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan' });

  const { admin_account } = req.body;
  if (admin_account && typeof admin_account === 'object') {
    const adminUser = await User.findOne({
      where: { branch_id: branch.id, role: ROLES.ADMIN_CABANG }
    });
    if (adminUser && admin_account.email !== undefined) {
      const newEmail = admin_account.email.toLowerCase().trim();
      if (newEmail !== adminUser.email) {
        const existing = await User.findOne({ where: { email: newEmail } });
        if (existing) {
          return res.status(400).json({ success: false, message: 'Email akun admin sudah digunakan oleh pengguna lain' });
        }
      }
    }
  }

  const allowed = ['manager_name', 'phone', 'email', 'address', ...COORDINATOR_FIELDS];
  const updates = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k] || null;
  }
  await branch.update(updates);

  if (admin_account && typeof admin_account === 'object') {
    const adminUser = await User.findOne({
      where: { branch_id: branch.id, role: ROLES.ADMIN_CABANG }
    });
    if (adminUser) {
      const userUpdates = {};
      if (admin_account.email !== undefined) userUpdates.email = admin_account.email.toLowerCase().trim();
      if (admin_account.name !== undefined) userUpdates.name = admin_account.name.trim();
      if (admin_account.password && String(admin_account.password).length >= 6) {
        const salt = await bcrypt.genSalt(10);
        userUpdates.password_hash = await bcrypt.hash(admin_account.password, salt);
      }
      if (Object.keys(userUpdates).length > 0) {
        await adminUser.update(userUpdates);
      }
    }
  }

  const updated = await Branch.findByPk(branch.id);
  const adminUser = await User.findOne({
    where: { branch_id: branch.id, role: ROLES.ADMIN_CABANG },
    attributes: ['id', 'email', 'name', 'role', 'is_active']
  });
  const data = updated.toJSON();
  data.admin_user = adminUser ? adminUser.toJSON() : null;
  res.json({ success: true, data });
});

module.exports = {
  listPublic,
  list,
  listProvinces,
  listWilayah,
  listKabupaten,
  getById,
  create,
  createBulkByProvince,
  update
};
