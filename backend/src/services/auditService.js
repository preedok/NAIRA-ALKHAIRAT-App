const { AuditLog } = require('../models');
const logger = require('../config/logger');

const createAuditLog = async (params) => {
  try {
    await AuditLog.create({
      user_id: params.userId,
      branch_id: params.branchId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_value: params.oldValue,
      new_value: params.newValue,
      ip_address: params.ip,
      user_agent: params.userAgent
    });
  } catch (err) {
    logger.error('Audit log create error:', err);
  }
};

module.exports = { createAuditLog };
