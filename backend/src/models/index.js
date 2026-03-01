const sequelize = require('../config/sequelize');
const Wilayah = require('./Wilayah');
const Provinsi = require('./Provinsi');
const Branch = require('./Branch');
const User = require('./User');
const OwnerProfile = require('./OwnerProfile');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Invoice = require('./Invoice');
const InvoiceFile = require('./InvoiceFile');
const PaymentProof = require('./PaymentProof');
const Refund = require('./Refund');
const OwnerBalanceTransaction = require('./OwnerBalanceTransaction');
const AuditLog = require('./AuditLog');
const Notification = require('./Notification');
const AppSetting = require('./AppSetting');
const SystemLog = require('./SystemLog');
const MaintenanceNotice = require('./MaintenanceNotice');
const Product = require('./Product');
const ProductPrice = require('./ProductPrice');
const BusinessRuleConfig = require('./BusinessRuleConfig');
const HotelProgress = require('./HotelProgress');
const TicketProgress = require('./TicketProgress');
const VisaProgress = require('./VisaProgress');
const BusProgress = require('./BusProgress');
const ProductAvailability = require('./ProductAvailability');
const HotelSeason = require('./HotelSeason');
const HotelRoomInventory = require('./HotelRoomInventory');
const VisaSeason = require('./VisaSeason');
const VisaSeasonQuota = require('./VisaSeasonQuota');
const BusSeason = require('./BusSeason');
const BusSeasonQuota = require('./BusSeasonQuota');
const TicketSeason = require('./TicketSeason');
const TicketSeasonQuota = require('./TicketSeasonQuota');
const AccountingFiscalYear = require('./AccountingFiscalYear');
const AccountingPeriod = require('./AccountingPeriod');
const ChartOfAccount = require('./ChartOfAccount');
const AccountMapping = require('./AccountMapping');
const JournalEntry = require('./JournalEntry');
const JournalEntryLine = require('./JournalEntryLine');
const PayrollSetting = require('./PayrollSetting');
const EmployeeSalary = require('./EmployeeSalary');
const PayrollRun = require('./PayrollRun');
const PayrollItem = require('./PayrollItem');
const PaymentReallocation = require('./PaymentReallocation');
const BankStatementUpload = require('./BankStatementUpload');
const BankStatementLine = require('./BankStatementLine');
const AccurateQuotation = require('./AccurateQuotation');
const AccuratePurchaseOrder = require('./AccuratePurchaseOrder');
const AccurateWarehouse = require('./AccurateWarehouse');
const AccurateFixedAsset = require('./AccurateFixedAsset');
const AccurateDepreciationSchedule = require('./AccurateDepreciationSchedule');

// Wilayah -> Provinsi -> Branch
Wilayah.hasMany(Provinsi, { foreignKey: 'wilayah_id' });
Provinsi.belongsTo(Wilayah, { foreignKey: 'wilayah_id', as: 'Wilayah' });
Provinsi.hasMany(Branch, { foreignKey: 'provinsi_id' });
Branch.belongsTo(Provinsi, { foreignKey: 'provinsi_id', as: 'Provinsi' });

// Branch & Wilayah
User.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
Branch.hasMany(User, { foreignKey: 'branch_id' });
User.belongsTo(Wilayah, { foreignKey: 'wilayah_id', as: 'Wilayah' });
Wilayah.hasMany(User, { foreignKey: 'wilayah_id' });

// OwnerProfile -> User (pakai alias agar include dari OwnerProfile wajib: include: [{ model: User, as: 'User' }])
OwnerProfile.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
User.hasOne(OwnerProfile, { foreignKey: 'user_id', as: 'OwnerProfile' });
OwnerProfile.belongsTo(Branch, { foreignKey: 'preferred_branch_id', as: 'PreferredBranch' });
OwnerProfile.belongsTo(Branch, { foreignKey: 'assigned_branch_id', as: 'AssignedBranch' });

// Order
Order.belongsTo(User, { foreignKey: 'owner_id', as: 'User' });
Order.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });
Order.belongsTo(Branch, { foreignKey: 'branch_id' });
User.hasMany(Order, { foreignKey: 'owner_id' });
Branch.hasMany(Order, { foreignKey: 'branch_id' });

OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'OrderItems' });

// Invoice
Invoice.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });
Invoice.belongsTo(User, { foreignKey: 'owner_id', as: 'User' });
Invoice.belongsTo(Branch, { foreignKey: 'branch_id' });
Order.hasOne(Invoice, { foreignKey: 'order_id' });

PaymentProof.belongsTo(Invoice, { foreignKey: 'invoice_id' });
PaymentProof.belongsTo(User, { foreignKey: 'uploaded_by' });
PaymentProof.belongsTo(User, { foreignKey: 'verified_by', as: 'VerifiedBy' });
Invoice.hasMany(PaymentProof, { foreignKey: 'invoice_id', as: 'PaymentProofs' });
Invoice.hasMany(Refund, { foreignKey: 'invoice_id', as: 'Refunds' });
Invoice.hasOne(InvoiceFile, { foreignKey: 'invoice_id', as: 'InvoiceFile' });
InvoiceFile.belongsTo(Invoice, { foreignKey: 'invoice_id' });
InvoiceFile.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });
InvoiceFile.belongsTo(User, { foreignKey: 'generated_by', as: 'GeneratedBy' });

// Refund
Refund.belongsTo(Invoice, { foreignKey: 'invoice_id' });
Refund.belongsTo(Order, { foreignKey: 'order_id' });
Refund.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
Refund.belongsTo(User, { foreignKey: 'requested_by', as: 'RequestedBy' });
Refund.belongsTo(User, { foreignKey: 'approved_by', as: 'ApprovedBy' });

// Owner balance (saldo)
User.hasMany(OwnerBalanceTransaction, { foreignKey: 'owner_id' });
OwnerBalanceTransaction.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });

// AuditLog
AuditLog.belongsTo(User, { foreignKey: 'user_id' });
AuditLog.belongsTo(Branch, { foreignKey: 'branch_id' });

// Notification
Notification.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Notification, { foreignKey: 'user_id' });

// MaintenanceNotice
MaintenanceNotice.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });

// Product
Product.belongsTo(User, { foreignKey: 'created_by' });
Product.hasMany(ProductPrice, { foreignKey: 'product_id', as: 'ProductPrices' });
ProductPrice.belongsTo(Product, { foreignKey: 'product_id' });
ProductPrice.belongsTo(Branch, { foreignKey: 'branch_id' });
ProductPrice.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
ProductPrice.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });
Branch.hasMany(ProductPrice, { foreignKey: 'branch_id' });

OrderItem.belongsTo(Product, { foreignKey: 'product_ref_id', as: 'Product', required: false });
Product.hasMany(OrderItem, { foreignKey: 'product_ref_id' });

BusinessRuleConfig.belongsTo(Branch, { foreignKey: 'branch_id' });
BusinessRuleConfig.belongsTo(User, { foreignKey: 'updated_by' });
Branch.hasMany(BusinessRuleConfig, { foreignKey: 'branch_id' });

Order.belongsTo(User, { foreignKey: 'unblocked_by', as: 'UnblockedBy' });
Invoice.belongsTo(User, { foreignKey: 'unblocked_by', as: 'UnblockedBy' });
PaymentProof.belongsTo(User, { foreignKey: 'issued_by', as: 'IssuedBy' });

HotelProgress.belongsTo(OrderItem, { foreignKey: 'order_item_id' });
HotelProgress.belongsTo(User, { foreignKey: 'updated_by', as: 'UpdatedBy' });
OrderItem.hasOne(HotelProgress, { foreignKey: 'order_item_id', as: 'HotelProgress' });

TicketProgress.belongsTo(OrderItem, { foreignKey: 'order_item_id' });
TicketProgress.belongsTo(User, { foreignKey: 'updated_by', as: 'UpdatedBy' });
OrderItem.hasOne(TicketProgress, { foreignKey: 'order_item_id', as: 'TicketProgress' });

VisaProgress.belongsTo(OrderItem, { foreignKey: 'order_item_id' });
VisaProgress.belongsTo(User, { foreignKey: 'updated_by', as: 'UpdatedBy' });
OrderItem.hasOne(VisaProgress, { foreignKey: 'order_item_id', as: 'VisaProgress' });

BusProgress.belongsTo(OrderItem, { foreignKey: 'order_item_id' });
BusProgress.belongsTo(User, { foreignKey: 'updated_by', as: 'UpdatedBy' });
OrderItem.hasOne(BusProgress, { foreignKey: 'order_item_id', as: 'BusProgress' });

ProductAvailability.belongsTo(Product, { foreignKey: 'product_id' });
ProductAvailability.belongsTo(User, { foreignKey: 'updated_by', as: 'UpdatedBy' });
Product.hasOne(ProductAvailability, { foreignKey: 'product_id', as: 'ProductAvailability' });

// Hotel seasons & room inventory (per musim)
HotelSeason.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
Product.hasMany(HotelSeason, { foreignKey: 'product_id', as: 'HotelSeasons' });
HotelRoomInventory.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
HotelRoomInventory.belongsTo(HotelSeason, { foreignKey: 'season_id', as: 'Season' });
HotelSeason.hasMany(HotelRoomInventory, { foreignKey: 'season_id', as: 'RoomInventory' });
Product.hasMany(HotelRoomInventory, { foreignKey: 'product_id', as: 'HotelRoomInventory' });

// Visa seasons & quota (kalender visa)
VisaSeason.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
Product.hasMany(VisaSeason, { foreignKey: 'product_id', as: 'VisaSeasons' });
VisaSeasonQuota.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
VisaSeasonQuota.belongsTo(VisaSeason, { foreignKey: 'season_id', as: 'Season' });
VisaSeason.hasOne(VisaSeasonQuota, { foreignKey: 'season_id', as: 'Quota' });
Product.hasMany(VisaSeasonQuota, { foreignKey: 'product_id', as: 'VisaSeasonQuotas' });

// Bus seasons & quota (kalender bus)
BusSeason.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
Product.hasMany(BusSeason, { foreignKey: 'product_id', as: 'BusSeasons' });
BusSeasonQuota.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
BusSeasonQuota.belongsTo(BusSeason, { foreignKey: 'season_id', as: 'Season' });
BusSeason.hasOne(BusSeasonQuota, { foreignKey: 'season_id', as: 'Quota' });
Product.hasMany(BusSeasonQuota, { foreignKey: 'product_id', as: 'BusSeasonQuotas' });

// Ticket seasons & quota (kuota tiket per periode)
TicketSeason.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
Product.hasMany(TicketSeason, { foreignKey: 'product_id', as: 'TicketSeasons' });
TicketSeasonQuota.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
TicketSeasonQuota.belongsTo(TicketSeason, { foreignKey: 'season_id', as: 'Season' });
TicketSeason.hasOne(TicketSeasonQuota, { foreignKey: 'season_id', as: 'Quota' });
Product.hasMany(TicketSeasonQuota, { foreignKey: 'product_id', as: 'TicketSeasonQuotas' });

// Accounting
AccountingFiscalYear.hasMany(AccountingPeriod, { foreignKey: 'fiscal_year_id', as: 'Periods' });
AccountingPeriod.belongsTo(AccountingFiscalYear, { foreignKey: 'fiscal_year_id', as: 'FiscalYear' });
ChartOfAccount.hasMany(ChartOfAccount, { foreignKey: 'parent_id', as: 'Children' });
ChartOfAccount.belongsTo(ChartOfAccount, { foreignKey: 'parent_id', as: 'Parent' });
AccountMapping.belongsTo(ChartOfAccount, { foreignKey: 'debit_account_id', as: 'DebitAccount' });
AccountMapping.belongsTo(ChartOfAccount, { foreignKey: 'credit_account_id', as: 'CreditAccount' });
JournalEntry.belongsTo(AccountingPeriod, { foreignKey: 'period_id', as: 'Period' });
JournalEntry.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
JournalEntry.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });
JournalEntry.hasMany(JournalEntryLine, { foreignKey: 'journal_entry_id', as: 'Lines' });
JournalEntryLine.belongsTo(JournalEntry, { foreignKey: 'journal_entry_id', as: 'JournalEntry' });
JournalEntryLine.belongsTo(ChartOfAccount, { foreignKey: 'account_id', as: 'Account' });

PayrollSetting.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
Branch.hasOne(PayrollSetting, { foreignKey: 'branch_id', as: 'PayrollSetting' });
EmployeeSalary.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
User.hasMany(EmployeeSalary, { foreignKey: 'user_id', as: 'EmployeeSalaries' });
PayrollRun.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
PayrollRun.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });
Branch.hasMany(PayrollRun, { foreignKey: 'branch_id', as: 'PayrollRuns' });
PayrollRun.hasMany(PayrollItem, { foreignKey: 'payroll_run_id', as: 'PayrollItems' });
PayrollItem.belongsTo(PayrollRun, { foreignKey: 'payroll_run_id', as: 'PayrollRun' });
PayrollItem.belongsTo(User, { foreignKey: 'user_id', as: 'User' });
User.hasMany(PayrollItem, { foreignKey: 'user_id', as: 'PayrollItems' });

// Payment reallocation (pemindahan dana antar invoice)
PaymentReallocation.belongsTo(Invoice, { foreignKey: 'source_invoice_id', as: 'SourceInvoice' });
PaymentReallocation.belongsTo(Invoice, { foreignKey: 'target_invoice_id', as: 'TargetInvoice' });
PaymentReallocation.belongsTo(User, { foreignKey: 'performed_by', as: 'PerformedBy' });
Invoice.hasMany(PaymentReallocation, { foreignKey: 'source_invoice_id', as: 'ReallocationsOut' });
Invoice.hasMany(PaymentReallocation, { foreignKey: 'target_invoice_id', as: 'ReallocationsIn' });
User.hasMany(PaymentReallocation, { foreignKey: 'performed_by', as: 'PaymentReallocations' });

BankStatementUpload.belongsTo(User, { foreignKey: 'uploaded_by', as: 'UploadedBy' });
  User.hasMany(BankStatementUpload, { foreignKey: 'uploaded_by', as: 'BankStatementUploads' });
  BankStatementUpload.hasMany(BankStatementLine, { foreignKey: 'upload_id', as: 'Lines' });
  BankStatementLine.belongsTo(BankStatementUpload, { foreignKey: 'upload_id', as: 'Upload' });

  AccurateQuotation.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
  AccuratePurchaseOrder.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
  AccurateWarehouse.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
  AccurateFixedAsset.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
  AccurateFixedAsset.hasMany(AccurateDepreciationSchedule, { foreignKey: 'fixed_asset_id', as: 'DepreciationSchedules' });
  AccurateDepreciationSchedule.belongsTo(AccurateFixedAsset, { foreignKey: 'fixed_asset_id', as: 'FixedAsset' });

const db = {
  sequelize,
  Sequelize: require('sequelize'),
  Wilayah,
  Provinsi,
  Branch,
  User,
  OwnerProfile,
  Order,
  OrderItem,
  Invoice,
  InvoiceFile,
  PaymentProof,
  Refund,
  OwnerBalanceTransaction,
  AuditLog,
  Notification,
  AppSetting,
  SystemLog,
  MaintenanceNotice,
  Product,
  ProductPrice,
  BusinessRuleConfig,
  HotelProgress,
  TicketProgress,
  VisaProgress,
  BusProgress,
  ProductAvailability,
  HotelSeason,
  HotelRoomInventory,
  VisaSeason,
  VisaSeasonQuota,
  BusSeason,
  BusSeasonQuota,
  TicketSeason,
  TicketSeasonQuota,
  AccountingFiscalYear,
  AccountingPeriod,
  ChartOfAccount,
  AccountMapping,
  JournalEntry,
  JournalEntryLine,
  PayrollSetting,
  EmployeeSalary,
  PayrollRun,
  PayrollItem,
  PaymentReallocation,
  BankStatementUpload,
  BankStatementLine,
  AccurateQuotation,
  AccuratePurchaseOrder,
  AccurateWarehouse,
  AccurateFixedAsset,
  AccurateDepreciationSchedule
};

module.exports = db;
