const ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};

function normalizeRole(role) {
  return role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USER;
}

function isAdminRole(role) {
  return normalizeRole(role) === ROLES.ADMIN;
}

function isUserRole(role) {
  return normalizeRole(role) === ROLES.USER;
}

function isOwnerRole(role) {
  return normalizeRole(role) === ROLES.USER;
}

const OWNER_ROLES = [ROLES.USER];

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
