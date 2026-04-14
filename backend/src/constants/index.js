const ROLES = {
  ADMIN: 'admin',
  USER: 'jamaah',
  ADMIN_PUSAT: 'admin_pusat',
  ADMIN_CABANG: 'admin_cabang',
  JAMAAH: 'jamaah'
};

function normalizeRole(role) {
  const raw = String(role || '').toLowerCase();
  if (raw === 'admin' || raw === ROLES.ADMIN_PUSAT) return ROLES.ADMIN_PUSAT;
  if (raw === ROLES.ADMIN_CABANG) return ROLES.ADMIN_CABANG;
  if (raw === 'user' || raw === ROLES.USER || raw === ROLES.JAMAAH) return ROLES.JAMAAH;
  return ROLES.JAMAAH;
}

function isAdminRole(role) {
  const normalized = normalizeRole(role);
  return normalized === ROLES.ADMIN_PUSAT || normalized === ROLES.ADMIN_CABANG;
}

function isAdminPusatRole(role) {
  return normalizeRole(role) === ROLES.ADMIN_PUSAT;
}

function isAdminCabangRole(role) {
  return normalizeRole(role) === ROLES.ADMIN_CABANG;
}

function isUserRole(role) {
  return normalizeRole(role) === ROLES.JAMAAH;
}

function isOwnerRole(role) {
  return normalizeRole(role) === ROLES.USER;
}

const OWNER_ROLES = [ROLES.JAMAAH];

const OWNER_STATUS = {
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  VERIFIED: 'verified',
  REJECTED: 'rejected'
};

const INVOICE_STATUS = {
  DRAFT: 'draft',
  TENTATIVE: 'tentative',
  PARTIAL_PAID: 'partial_paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELED: 'canceled'
};

const REFUND_STATUS = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REFUNDED: 'refunded'
};

const REFUND_SOURCE = {
  CANCEL: 'cancel',
  BALANCE: 'balance'
};

const ORDER_ITEM_TYPE = {
  HOTEL: 'hotel',
  VISA: 'visa',
  TICKET: 'ticket',
  BUS: 'bus',
  PACKAGE: 'package'
};

const BUSINESS_RULE_KEYS = {
  COMPANY_NAME: 'company_name',
  COMPANY_ADDRESS: 'company_address',
  BANK_ACCOUNTS: 'bank_accounts',
  MIN_DP_PERCENTAGE: 'min_dp_percentage',
  DP_DUE_DAYS: 'dp_due_days'
};

const NOTIFICATION_TRIGGER = {
  INVOICE_CREATED: 'invoice_created',
  PAYMENT_RECEIVED: 'payment_received',
  INSTALLMENT_REMINDER: 'installment_reminder',
  PROFILE_VERIFIED: 'profile_verified',
  PROFILE_REJECTED: 'profile_rejected'
};

module.exports = {
  ROLES,
  normalizeRole,
  isAdminRole,
  isAdminPusatRole,
  isAdminCabangRole,
  isUserRole,
  isOwnerRole,
  OWNER_ROLES,
  OWNER_STATUS,
  INVOICE_STATUS,
  REFUND_STATUS,
  REFUND_SOURCE,
  ORDER_ITEM_TYPE,
  BUSINESS_RULE_KEYS,
  NOTIFICATION_TRIGGER
};
