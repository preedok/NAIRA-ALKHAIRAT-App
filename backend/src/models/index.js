const sequelize = require('../config/sequelize');

const User = require('./User');
const Branch = require('./Branch');
const Province = require('./Province');
const Wilayah = require('./Wilayah');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Invoice = require('./Invoice');
const PaymentProof = require('./PaymentProof');
const Notification = require('./Notification');
const AppSetting = require('./AppSetting');
const SystemLog = require('./SystemLog');
const MaintenanceNotice = require('./MaintenanceNotice');
const Product = require('./Product');
const BusinessRuleConfig = require('./BusinessRuleConfig');
const OtpVerification = require('./OtpVerification');

const JamaahProfile = require('./JamaahProfile');
const JamaahDocument = require('./JamaahDocument');
const Flyer = require('./Flyer');
const InstallmentPlan = require('./InstallmentPlan');
const InstallmentItem = require('./InstallmentItem');
const Kloter = require('./Kloter');
const KloterAssignment = require('./KloterAssignment');

// Core relations
Order.belongsTo(User, { foreignKey: 'owner_id', as: 'User' });
User.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
Branch.hasMany(User, { foreignKey: 'branch_id', as: 'Users' });

Province.hasMany(Wilayah, { foreignKey: 'province_id', as: 'Wilayahs' });
Wilayah.belongsTo(Province, { foreignKey: 'province_id', as: 'Province' });
Branch.belongsTo(Province, { foreignKey: 'province_id', as: 'Province' });
Branch.belongsTo(Wilayah, { foreignKey: 'wilayah_id', as: 'Wilayah' });
Province.hasMany(Branch, { foreignKey: 'province_id', as: 'Branches' });
Wilayah.hasMany(Branch, { foreignKey: 'wilayah_id', as: 'Branches' });
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'OrderItems' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });

Invoice.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });
Invoice.belongsTo(User, { foreignKey: 'owner_id', as: 'User' });
Order.hasMany(Invoice, { foreignKey: 'order_id', as: 'Invoices' });

PaymentProof.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'Invoice' });
Invoice.hasMany(PaymentProof, { foreignKey: 'invoice_id', as: 'PaymentProofs' });

Notification.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Notification, { foreignKey: 'user_id' });

OtpVerification.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
User.hasMany(OtpVerification, { foreignKey: 'user_id', as: 'OtpVerifications' });

Product.belongsTo(User, { foreignKey: 'created_by' });
OrderItem.belongsTo(Product, { foreignKey: 'product_ref_id', as: 'Product' });
Product.hasMany(OrderItem, { foreignKey: 'product_ref_id' });

// Jamaah profile/docs
JamaahProfile.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
User.hasOne(JamaahProfile, { foreignKey: 'user_id', as: 'JamaahProfile' });
JamaahProfile.belongsTo(User, { foreignKey: 'reviewed_by', as: 'ReviewedBy' });
JamaahDocument.belongsTo(JamaahProfile, { foreignKey: 'jamaah_profile_id', as: 'JamaahProfile' });
JamaahProfile.hasMany(JamaahDocument, { foreignKey: 'jamaah_profile_id', as: 'Documents' });
JamaahDocument.belongsTo(User, { foreignKey: 'verified_by', as: 'VerifiedBy' });

// Flyers
Flyer.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
Product.hasMany(Flyer, { foreignKey: 'product_id', as: 'Flyers' });
Flyer.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });
User.hasMany(Flyer, { foreignKey: 'created_by', as: 'Flyers' });

// Installments
InstallmentPlan.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });
Order.hasOne(InstallmentPlan, { foreignKey: 'order_id', as: 'InstallmentPlan' });
InstallmentPlan.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
User.hasMany(InstallmentPlan, { foreignKey: 'owner_id', as: 'InstallmentPlans' });
InstallmentItem.belongsTo(InstallmentPlan, { foreignKey: 'plan_id', as: 'Plan' });
InstallmentPlan.hasMany(InstallmentItem, { foreignKey: 'plan_id', as: 'Items' });
InstallmentItem.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'Invoice' });
Invoice.hasMany(InstallmentItem, { foreignKey: 'invoice_id', as: 'InstallmentItems' });

// Kloter
Kloter.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
Product.hasMany(Kloter, { foreignKey: 'product_id', as: 'Kloters' });
Kloter.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });
KloterAssignment.belongsTo(Kloter, { foreignKey: 'kloter_id', as: 'Kloter' });
Kloter.hasMany(KloterAssignment, { foreignKey: 'kloter_id', as: 'Assignments' });
KloterAssignment.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });
Order.hasMany(KloterAssignment, { foreignKey: 'order_id', as: 'KloterAssignments' });
KloterAssignment.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
KloterAssignment.belongsTo(User, { foreignKey: 'assigned_by', as: 'AssignedBy' });

module.exports = {
  sequelize,
  Sequelize: require('sequelize'),
  User,
  Branch,
  Province,
  Wilayah,
  Order,
  OrderItem,
  Invoice,
  PaymentProof,
  Notification,
  AppSetting,
  SystemLog,
  MaintenanceNotice,
  Product,
  BusinessRuleConfig,
  OtpVerification,
  JamaahProfile,
  JamaahDocument,
  Flyer,
  InstallmentPlan,
  InstallmentItem,
  Kloter,
  KloterAssignment
};
