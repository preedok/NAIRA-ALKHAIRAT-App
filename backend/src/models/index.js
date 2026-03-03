const sequelize = require('../config/sequelize');
const Wilayah = require('./Wilayah');
const Provinsi = require('./Provinsi');
const Kabupaten = require('./Kabupaten');
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
const PaymentReallocation = require('./PaymentReallocation');
const AccountingBankAccount = require('./AccountingBankAccount');
const AccountingSupplier = require('./AccountingSupplier');
const PurchaseOrder = require('./PurchaseOrder');
const PurchaseOrderLine = require('./PurchaseOrderLine');
const PurchaseInvoice = require('./PurchaseInvoice');
const PurchaseInvoiceLine = require('./PurchaseInvoiceLine');
const PurchasePayment = require('./PurchasePayment');
const Bank = require('./Bank');
const InvoiceStatusHistory = require('./InvoiceStatusHistory');
const OrderRevision = require('./OrderRevision');

// Wilayah -> Provinsi -> Kabupaten, Branch
Wilayah.hasMany(Provinsi, { foreignKey: 'wilayah_id' });
Provinsi.belongsTo(Wilayah, { foreignKey: 'wilayah_id', as: 'Wilayah' });
Provinsi.hasMany(Kabupaten, { foreignKey: 'provinsi_id' });
Kabupaten.belongsTo(Provinsi, { foreignKey: 'provinsi_id', as: 'Provinsi' });
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
PaymentProof.belongsTo(Bank, { foreignKey: 'bank_id', as: 'Bank' });
PaymentProof.belongsTo(AccountingBankAccount, { foreignKey: 'recipient_bank_account_id', as: 'RecipientAccount' });
Bank.hasMany(PaymentProof, { foreignKey: 'bank_id' });
AccountingBankAccount.hasMany(PaymentProof, { foreignKey: 'recipient_bank_account_id' });
Invoice.hasMany(PaymentProof, { foreignKey: 'invoice_id', as: 'PaymentProofs' });
Invoice.hasMany(Refund, { foreignKey: 'invoice_id', as: 'Refunds' });
Invoice.hasOne(InvoiceFile, { foreignKey: 'invoice_id', as: 'InvoiceFile' });
InvoiceFile.belongsTo(Invoice, { foreignKey: 'invoice_id' });
InvoiceFile.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });
InvoiceFile.belongsTo(User, { foreignKey: 'generated_by', as: 'GeneratedBy' });

// Invoice status history & order revisions (audit)
InvoiceStatusHistory.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'Invoice' });
InvoiceStatusHistory.belongsTo(User, { foreignKey: 'changed_by', as: 'ChangedBy' });
Invoice.hasMany(InvoiceStatusHistory, { foreignKey: 'invoice_id', as: 'StatusHistories' });

OrderRevision.belongsTo(Order, { foreignKey: 'order_id', as: 'Order' });
OrderRevision.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'Invoice' });
OrderRevision.belongsTo(User, { foreignKey: 'changed_by', as: 'ChangedBy' });
Order.hasMany(OrderRevision, { foreignKey: 'order_id', as: 'Revisions' });
Invoice.hasMany(OrderRevision, { foreignKey: 'invoice_id', as: 'OrderRevisions' });

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

AccountingBankAccount.belongsTo(ChartOfAccount, { foreignKey: 'gl_account_id', as: 'GlAccount' });
AccountingBankAccount.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
Branch.hasMany(AccountingBankAccount, { foreignKey: 'branch_id', as: 'BankAccounts' });

AccountingSupplier.belongsTo(ChartOfAccount, { foreignKey: 'payable_account_id', as: 'PayableAccount' });
PurchaseOrder.belongsTo(AccountingSupplier, { foreignKey: 'supplier_id', as: 'Supplier' });
PurchaseOrder.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
PurchaseOrder.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
PurchaseOrder.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });
PurchaseOrder.hasMany(PurchaseOrderLine, { foreignKey: 'purchase_order_id', as: 'Lines' });
PurchaseOrderLine.belongsTo(PurchaseOrder, { foreignKey: 'purchase_order_id', as: 'PurchaseOrder' });
PurchaseOrderLine.belongsTo(ChartOfAccount, { foreignKey: 'account_id', as: 'Account' });

PurchaseInvoice.belongsTo(AccountingSupplier, { foreignKey: 'supplier_id', as: 'Supplier' });
PurchaseInvoice.belongsTo(Product, { foreignKey: 'product_id', as: 'Product' });
PurchaseInvoice.belongsTo(PurchaseOrder, { foreignKey: 'purchase_order_id', as: 'PurchaseOrder' });
PurchaseInvoice.belongsTo(Branch, { foreignKey: 'branch_id', as: 'Branch' });
PurchaseInvoice.belongsTo(JournalEntry, { foreignKey: 'journal_entry_id', as: 'JournalEntry' });
PurchaseInvoice.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });
PurchaseInvoice.hasMany(PurchaseInvoiceLine, { foreignKey: 'purchase_invoice_id', as: 'Lines' });
PurchaseInvoice.hasMany(PurchasePayment, { foreignKey: 'purchase_invoice_id', as: 'Payments' });
PurchaseInvoiceLine.belongsTo(PurchaseInvoice, { foreignKey: 'purchase_invoice_id', as: 'PurchaseInvoice' });
PurchaseInvoiceLine.belongsTo(PurchaseOrderLine, { foreignKey: 'purchase_order_line_id', as: 'PurchaseOrderLine' });
PurchaseInvoiceLine.belongsTo(ChartOfAccount, { foreignKey: 'account_id', as: 'Account' });

PurchasePayment.belongsTo(PurchaseInvoice, { foreignKey: 'purchase_invoice_id', as: 'PurchaseInvoice' });
PurchasePayment.belongsTo(AccountingSupplier, { foreignKey: 'supplier_id', as: 'Supplier' });
PurchasePayment.belongsTo(AccountingBankAccount, { foreignKey: 'bank_account_id', as: 'BankAccount' });
PurchasePayment.belongsTo(JournalEntry, { foreignKey: 'journal_entry_id', as: 'JournalEntry' });
PurchasePayment.belongsTo(User, { foreignKey: 'created_by', as: 'CreatedBy' });

// Payment reallocation (pemindahan dana antar invoice)
PaymentReallocation.belongsTo(Invoice, { foreignKey: 'source_invoice_id', as: 'SourceInvoice' });
PaymentReallocation.belongsTo(Invoice, { foreignKey: 'target_invoice_id', as: 'TargetInvoice' });
PaymentReallocation.belongsTo(User, { foreignKey: 'performed_by', as: 'PerformedBy' });
Invoice.hasMany(PaymentReallocation, { foreignKey: 'source_invoice_id', as: 'ReallocationsOut' });
Invoice.hasMany(PaymentReallocation, { foreignKey: 'target_invoice_id', as: 'ReallocationsIn' });
User.hasMany(PaymentReallocation, { foreignKey: 'performed_by', as: 'PaymentReallocations' });

const db = {
  sequelize,
  Sequelize: require('sequelize'),
  Wilayah,
  Provinsi,
  Kabupaten,
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
  PaymentReallocation,
  AccountingBankAccount,
  AccountingSupplier,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  PurchasePayment,
  Bank,
  InvoiceStatusHistory,
  OrderRevision
};

module.exports = db;
