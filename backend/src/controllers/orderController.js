const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Op } = require('sequelize');
const { Order, OrderItem, User, Branch, Provinsi, OwnerProfile, Invoice, Notification, Product, VisaProgress, TicketProgress, HotelProgress, BusProgress, Refund, OwnerBalanceTransaction, InvoiceStatusHistory, OrderRevision, OrderCancellationRequest, PaymentProof, PaymentReallocation, InvoiceFile, sequelize } = require('../models');
const { getRulesForBranch } = require('./businessRuleController');
const { NOTIFICATION_TRIGGER, ORDER_ITEM_TYPE, ROOM_CAPACITY, VISA_PROGRESS_STATUS, TICKET_PROGRESS_STATUS, REFUND_STATUS, REFUND_SOURCE, BANDARA_TIKET_CODES, TICKET_TRIP_TYPES, BUS_TRIP_TYPES, BUSINESS_RULES, DP_PAYMENT_STATUS, INVOICE_STATUS, ORDER_STATUS, isOwnerRole, ROLES } = require('../constants');
const { getHotelBranchIds } = require('../utils/hotelBranchScope');
const { getEffectivePrice } = require('./productController');
const { checkAvailability } = require('../services/hotelAvailabilityService');
const { calculateStayCostByNights } = require('../services/hotelMonthlyPricingService');
const { syncInvoiceFromOrder, createInvoiceForOrder } = require('./invoiceController');
const { getBranchIdsForWilayah } = require('../utils/wilayahScope');
const uploadConfig = require('../config/uploads');

const generateOrderNumber = () => {
  const y = new Date().getFullYear();
  const n = Math.floor(Math.random() * 99999) + 1;
  return `ORD-${y}-${String(n).padStart(5, '0')}`;
};

async function logInvoiceStatusChange({ invoice_id, from_status, to_status, changed_by, reason, meta }) {
  try {
    await InvoiceStatusHistory.create({
      invoice_id,
      from_status: from_status ?? null,
      to_status,
      changed_at: new Date(),
      changed_by: changed_by || null,
      reason: reason || null,
      meta: meta && typeof meta === 'object' ? meta : {}
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('orderController logInvoiceStatusChange failed:', e?.message || e);
  }
}

/** Jumlah malam dari check_in s/d check_out (tanggal saja, tanpa waktu). Return 0 jika invalid. */
function getNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(String(checkIn).slice(0, 10));
  const b = new Date(String(checkOut).slice(0, 10));
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b <= a) return 0;
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

/** Validasi invoice tujuan saat alokasi dana dari pembatalan order (sisa > 0, bukan batal/lunas, order tidak cancelled). */
function validateCancelReallocateTargetInvoice(targetInv, ownerId) {
  if (!targetInv) return { ok: false, code: 404, message: 'Invoice tujuan tidak ditemukan' };
  if (targetInv.owner_id !== ownerId) {
    return { ok: false, code: 400, message: 'Invoice tujuan harus milik owner yang sama' };
  }
  const targetStatus = (targetInv.status || '').toLowerCase();
  const disallowed = [
    INVOICE_STATUS.CANCELED,
    'cancelled',
    INVOICE_STATUS.CANCELLED_REFUND,
    INVOICE_STATUS.REFUNDED,
    INVOICE_STATUS.REFUND_CANCELED,
    INVOICE_STATUS.DRAFT,
    INVOICE_STATUS.PAID,
    INVOICE_STATUS.COMPLETED,
    INVOICE_STATUS.OVERPAID_TRANSFERRED
  ].map((s) => String(s).toLowerCase());
  if (disallowed.includes(targetStatus)) {
    return { ok: false, code: 400, message: 'Invoice tujuan tidak boleh yang sudah dibatalkan atau sudah lunas' };
  }
  const remain = parseFloat(targetInv.remaining_amount) || 0;
  if (remain <= 0) {
    return { ok: false, code: 400, message: 'Invoice tujuan harus masih punya sisa tagihan (belum lunas)' };
  }
  const ordSt = targetInv.Order && targetInv.Order.status != null ? String(targetInv.Order.status).toLowerCase() : '';
  if (ordSt === ORDER_STATUS.CANCELLED) {
    return { ok: false, code: 400, message: 'Order invoice tujuan tidak boleh yang sudah dibatalkan' };
  }
  return { ok: true };
}

/** Invoice lunas (sisa 0 atau status paid/completed) — owner tidak boleh batalkan langsung tanpa persetujuan admin pusat. */
function isInvoiceFullyPaidForOwnerCancel(inv, paidAmount) {
  if (!inv || paidAmount <= 0) return false;
  const rem = parseFloat(inv.remaining_amount) || 0;
  const st = (inv.status || '').toLowerCase();
  return rem <= 0.01 || st === 'paid' || st === 'completed';
}

const OWNER_CANCEL_MAX_CALENDAR_DAYS = 7;

/** true jika sudah lewat batas hari kalender — owner tidak boleh membatalkan / mengajukan batal sendiri (tim invoice tetap boleh). */
function ownerCancelWindowExpired(order) {
  if (!order) return false;
  const raw = typeof order.get === 'function' ? order.get('created_at') : (order.createdAt ?? order.created_at);
  if (!raw) return false;
  const start = new Date(raw);
  if (isNaN(start.getTime())) return false;
  const now = new Date();
  const dayUtc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.floor((dayUtc(now) - dayUtc(start)) / (24 * 60 * 60 * 1000));
  return days >= OWNER_CANCEL_MAX_CALENDAR_DAYS;
}

const OWNER_CANCEL_SERVICE_EXCLUSION_DAYS = 7;

function todayLocalYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pushServiceYmd(arr, val) {
  if (val == null || val === '') return;
  const s = String(val).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) arr.push(s);
}

function collectItemMeta(it) {
  const m = it.meta;
  if (!m) return {};
  if (typeof m === 'string') {
    try {
      return JSON.parse(m);
    } catch (_) {
      return {};
    }
  }
  if (typeof m === 'object') return m;
  return {};
}

function earliestServiceYmdFromOrderItems(items) {
  const all = [];
  for (const it of items || []) {
    const meta = collectItemMeta(it);
    pushServiceYmd(all, meta.check_in);
    pushServiceYmd(all, meta.departure_date);
    pushServiceYmd(all, meta.return_date);
    pushServiceYmd(all, meta.travel_date);
    pushServiceYmd(all, meta.service_date);
    const hp = it.HotelProgress;
    if (hp) {
      const cid = typeof hp.get === 'function' ? hp.get('check_in_date') : hp.check_in_date;
      pushServiceYmd(all, cid);
    }
  }
  if (all.length === 0) return null;
  return all.sort()[0];
}

function calendarDaysBetweenYmd(fromYmd, toYmd) {
  const parse = (s) => {
    const x = String(s).slice(0, 10).split('-').map(Number);
    if (x.length !== 3 || x.some((n) => Number.isNaN(n))) return NaN;
    return Date.UTC(x[0], x[1] - 1, x[2]);
  };
  const a = parse(fromYmd);
  const b = parse(toYmd);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

async function ownerCancelBlockedByUpcomingServiceDb(orderId) {
  const items = await OrderItem.findAll({
    where: { order_id: orderId },
    attributes: ['id', 'meta', 'type'],
    include: [{ model: HotelProgress, as: 'HotelProgress', attributes: ['check_in_date'], required: false }]
  });
  const earliest = earliestServiceYmdFromOrderItems(items);
  if (!earliest) return false;
  const daysUntil = calendarDaysBetweenYmd(todayLocalYmd(), earliest);
  if (Number.isNaN(daysUntil)) return false;
  if (daysUntil < 0) return true;
  return daysUntil < OWNER_CANCEL_SERVICE_EXCLUSION_DAYS;
}

/**
 * Fase tagihan DP (tentative / draft invoice, belum ada pembayaran) atau order draft belum terbit invoice:
 * owner tetap boleh batalkan tanpa batas 7 hari order / 7 hari menjelang layanan.
 */
function ownerInvoiceIsTagihanDpPhase(inv, order) {
  const ordSt = order && String(order.status || '').toLowerCase();
  if (!inv && ordSt === 'draft') return true;
  if (!inv) return false;
  const paid = parseFloat(inv.paid_amount) || 0;
  if (paid > 0.01) return false;
  const st = String(inv.status || '').toLowerCase();
  return st === 'tentative' || st === 'draft';
}

async function validatePaidCancelBody(order, inv, body) {
  if (!inv) {
    return { ok: false, status: 400, message: 'Order tidak memiliki invoice.' };
  }
  const paidAmount = parseFloat(inv.paid_amount) || 0;
  if (paidAmount <= 0) {
    return { ok: false, status: 400, message: 'Tidak ada pembayaran untuk skenario ini.' };
  }
  const action = body && ['to_balance', 'refund', 'allocate_to_order'].includes(body.action) ? body.action : null;
  if (!action) {
    return { ok: false, status: 400, message: 'Ada pembayaran. Pilih: to_balance (jadikan saldo), refund (minta refund ke rekening), atau allocate_to_order (pindah ke invoice lain).' };
  }
  const bankName = body && body.bank_name ? String(body.bank_name).trim() || null : null;
  const accountNumber = body && body.account_number ? String(body.account_number).trim() || null : null;
  const accountHolderName = body && body.account_holder_name ? String(body.account_holder_name).trim() || null : null;
  let refundAmount = body && body.refund_amount != null ? parseFloat(body.refund_amount) : null;
  const remainderAction = body && (body.remainder_action === 'to_balance' || body.remainder_action === 'allocate_to_order') ? body.remainder_action : null;
  const remainderTargetInvoiceId = body && body.remainder_target_invoice_id ? String(body.remainder_target_invoice_id).trim() || null : null;
  const targetInvoiceId = body && body.target_invoice_id ? String(body.target_invoice_id).trim() || null : null;

  if (action === 'refund') {
    if (!bankName || !accountNumber) {
      return { ok: false, status: 400, message: 'Untuk refund wajib isi bank_name dan account_number (rekening tujuan pengembalian).' };
    }
    if (refundAmount == null || Number.isNaN(refundAmount) || refundAmount <= 0) refundAmount = paidAmount;
    if (refundAmount > paidAmount) refundAmount = paidAmount;
    const remainder = paidAmount - refundAmount;
    if (remainder > 0 && !remainderAction) {
      return { ok: false, status: 400, message: 'Refund sebagian: pilih sisa dana: remainder_action = to_balance (jadikan saldo) atau allocate_to_order (alokasi ke invoice lain). Jika allocate_to_order wajib isi remainder_target_invoice_id.' };
    }
    if (remainder > 0 && remainderAction === 'allocate_to_order' && !remainderTargetInvoiceId) {
      return { ok: false, status: 400, message: 'Sisa dana dialokasikan ke invoice lain: wajib isi remainder_target_invoice_id.' };
    }
    if (remainder > 0 && remainderAction === 'allocate_to_order' && remainderTargetInvoiceId) {
      const remInv = await Invoice.findByPk(remainderTargetInvoiceId, {
        include: [{ model: Order, as: 'Order', attributes: ['id', 'status'] }]
      });
      const remCheck = validateCancelReallocateTargetInvoice(remInv, order.owner_id);
      if (!remCheck.ok) return { ok: false, status: remCheck.code, message: remCheck.message };
    }
  }
  if (action === 'allocate_to_order') {
    if (!targetInvoiceId) return { ok: false, status: 400, message: 'Untuk pindah ke order lain wajib isi target_invoice_id.' };
    const targetInv = await Invoice.findByPk(targetInvoiceId, {
      include: [{ model: Order, as: 'Order', attributes: ['id', 'status'] }]
    });
    const check = validateCancelReallocateTargetInvoice(targetInv, order.owner_id);
    if (!check.ok) return { ok: false, status: check.code, message: check.message };
  }

  const reason = body && body.reason ? String(body.reason).trim() || null : null;
  return {
    ok: true,
    paidAmount,
    action,
    reason,
    bankName,
    accountNumber,
    accountHolderName,
    refundAmount,
    remainderAction,
    remainderTargetInvoiceId,
    targetInvoiceId
  };
}

async function executePaidOrderCancellation(order, inv, parsed, ctx) {
  const {
    paidAmount,
    action,
    reason,
    bankName,
    accountNumber,
    accountHolderName,
    refundAmount: ra0,
    remainderAction,
    remainderTargetInvoiceId,
    targetInvoiceId
  } = parsed;
  let refundAmount = ra0;
  const { auditUserId, refundRequestedById, performedById } = ctx;

  let refund = null;
  let balanceAdded = null;
  let reallocationAdded = null;

  if (inv && paidAmount > 0 && action === 'to_balance') {
    const profile = await OwnerProfile.findOne({ where: { user_id: order.owner_id } });
    if (profile) {
      const currentBalance = parseFloat(profile.balance) || 0;
      const newBalance = currentBalance + paidAmount;
      await profile.update({ balance: newBalance });
      await OwnerBalanceTransaction.create({
        owner_id: order.owner_id,
        amount: paidAmount,
        type: 'cancel_credit',
        reference_type: 'order',
        reference_id: order.id,
        notes: `Pembatalan order ${order.order_number}; invoice ${inv.invoice_number}. Saldo +${Number(paidAmount).toLocaleString('id-ID')}`
      });
      balanceAdded = { previous: currentBalance, new: newBalance };
    }
  } else if (inv && paidAmount > 0 && action === 'refund') {
    const remainder = paidAmount - refundAmount;
    if (remainder > 0 && remainderAction === 'to_balance') {
      const profile = await OwnerProfile.findOne({ where: { user_id: order.owner_id } });
      if (profile) {
        const currentBalance = parseFloat(profile.balance) || 0;
        const newBalance = currentBalance + remainder;
        await profile.update({ balance: newBalance });
        await OwnerBalanceTransaction.create({
          owner_id: order.owner_id,
          amount: remainder,
          type: 'cancel_credit',
          reference_type: 'order',
          reference_id: order.id,
          notes: `Pembatalan order ${order.order_number}; sisa setelah refund. Saldo +${Number(remainder).toLocaleString('id-ID')}`
        });
        balanceAdded = { previous: currentBalance, new: newBalance, amount: remainder };
      }
    } else if (remainder > 0 && remainderAction === 'allocate_to_order' && remainderTargetInvoiceId) {
      const targetInv = await Invoice.findByPk(remainderTargetInvoiceId);
      const remainderTargetStatus = (targetInv?.status || '').toLowerCase();
      if (targetInv && targetInv.owner_id === order.owner_id && remainderTargetStatus !== 'canceled' && remainderTargetStatus !== 'cancelled' && remainderTargetStatus !== 'cancelled_refund') {
        const targetPaid = parseFloat(targetInv.paid_amount) || 0;
        const targetTotal = parseFloat(targetInv.total_amount) || 0;
        const newTargetPaid = targetPaid + remainder;
        const newTargetRemaining = Math.max(0, targetTotal - newTargetPaid);
        let newTargetStatus = targetInv.status;
        if (newTargetRemaining <= 0) newTargetStatus = INVOICE_STATUS.PAID;
        else if (newTargetPaid >= (parseFloat(targetInv.dp_amount) || 0)) newTargetStatus = INVOICE_STATUS.PARTIAL_PAID;
        const receivedNote = `Menerima pemindahan Rp ${Number(remainder).toLocaleString('id-ID')} dari invoice ${inv.invoice_number} (pembatalan order).`;
        const targetNotes = [receivedNote, (targetInv.notes || '').trim()].filter(Boolean).join('\n');
        await targetInv.update({ paid_amount: newTargetPaid, remaining_amount: newTargetRemaining, status: newTargetStatus, notes: targetNotes });
        if (newTargetStatus === INVOICE_STATUS.PAID) {
          const targetOrder = await Order.findByPk(targetInv.order_id, { attributes: ['id', 'status'] });
          if (targetOrder && !['completed', 'cancelled'].includes(targetOrder.status)) {
            await targetOrder.update({ status: ORDER_STATUS.PROCESSING });
          }
        }
        await PaymentReallocation.create({
          source_invoice_id: inv.id,
          target_invoice_id: remainderTargetInvoiceId,
          amount: remainder,
          performed_by: performedById,
          notes: `Pembatalan order ${order.order_number}; sisa setelah refund dialokasikan ke invoice ${targetInv.invoice_number}`
        });
        reallocationAdded = { target_invoice_id: remainderTargetInvoiceId, target_invoice_number: targetInv.invoice_number, amount: remainder };
      }
    }
    await inv.update({ paid_amount: 0, remaining_amount: 0 });
    refund = await Refund.create({
      invoice_id: inv.id,
      order_id: order.id,
      owner_id: order.owner_id,
      amount: refundAmount,
      status: REFUND_STATUS.REQUESTED,
      source: REFUND_SOURCE.CANCEL,
      reason: reason || null,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder_name: accountHolderName,
      requested_by: refundRequestedById
    });
  } else if (inv && paidAmount > 0 && action === 'allocate_to_order' && targetInvoiceId) {
    const targetInv = await Invoice.findByPk(targetInvoiceId);
    if (targetInv && targetInv.owner_id === order.owner_id) {
      const targetPaid = parseFloat(targetInv.paid_amount) || 0;
      const targetTotal = parseFloat(targetInv.total_amount) || 0;
      const newTargetPaid = targetPaid + paidAmount;
      const newTargetRemaining = Math.max(0, targetTotal - newTargetPaid);
      let newTargetStatus = targetInv.status;
      if (newTargetRemaining <= 0) newTargetStatus = INVOICE_STATUS.PAID;
      else if (newTargetPaid >= (parseFloat(targetInv.dp_amount) || 0)) newTargetStatus = INVOICE_STATUS.PARTIAL_PAID;
      const receivedNote = `Menerima pemindahan Rp ${Number(paidAmount).toLocaleString('id-ID')} dari invoice ${inv.invoice_number} (pembatalan order).`;
      const targetNotes = [receivedNote, (targetInv.notes || '').trim()].filter(Boolean).join('\n');
      await targetInv.update({ paid_amount: newTargetPaid, remaining_amount: newTargetRemaining, status: newTargetStatus, notes: targetNotes });
      if (newTargetStatus === INVOICE_STATUS.PAID) {
        const targetOrder = await Order.findByPk(targetInv.order_id, { attributes: ['id', 'status'] });
        if (targetOrder && !['completed', 'cancelled'].includes(targetOrder.status)) {
          await targetOrder.update({ status: ORDER_STATUS.PROCESSING });
        }
      }
      await PaymentReallocation.create({
        source_invoice_id: inv.id,
        target_invoice_id: targetInvoiceId,
        amount: paidAmount,
        performed_by: performedById,
        notes: `Pembatalan order ${order.order_number}; dana dialihkan ke invoice ${targetInv.invoice_number}`
      });
      reallocationAdded = { target_invoice_id: targetInvoiceId, target_invoice_number: targetInv.invoice_number, amount: paidAmount };
    }
    await inv.update({ paid_amount: 0, remaining_amount: 0 });
  }

  let cancellationHandlingNote = null;
  if (inv && paidAmount > 0 && action) {
    const fmt = (n) => Number(n).toLocaleString('id-ID');
    if (action === 'to_balance') {
      cancellationHandlingNote = `Dipindahkan ke saldo akun. Jumlah: Rp ${fmt(paidAmount)}`;
    } else if (action === 'refund') {
      if (reallocationAdded && reallocationAdded.target_invoice_number) {
        cancellationHandlingNote = `Sisa Rp ${fmt(reallocationAdded.amount)} dialihkan ke invoice ${reallocationAdded.target_invoice_number}.`;
      } else if (balanceAdded != null && balanceAdded.amount != null) {
        cancellationHandlingNote = `Sisa Rp ${fmt(balanceAdded.amount)} dipindahkan ke saldo akun.`;
      }
    } else if (action === 'allocate_to_order' && reallocationAdded) {
      cancellationHandlingNote = `Dipindahkan ke invoice ${reallocationAdded.target_invoice_number || 'lain'}. Jumlah: Rp ${fmt(reallocationAdded.amount)}`;
    }
  }

  await order.update({ status: ORDER_STATUS.CANCELLED });
  if (inv) {
    const newInvoiceStatus = paidAmount > 0 ? INVOICE_STATUS.CANCELLED_REFUND : INVOICE_STATUS.CANCELED;
    const invoiceUpdates = {
      status: newInvoiceStatus,
      ...(paidAmount > 0 ? { cancelled_refund_amount: paidAmount } : { cancelled_refund_amount: null }),
      ...(action === 'to_balance' ? { paid_amount: 0, remaining_amount: 0 } : {}),
      ...(action === 'refund' ? { paid_amount: 0, remaining_amount: 0 } : {}),
      ...(cancellationHandlingNote ? { cancellation_handling_note: cancellationHandlingNote } : {})
    };
    await inv.update(invoiceUpdates);
    await logInvoiceStatusChange({
      invoice_id: inv.id,
      from_status: inv.status,
      to_status: newInvoiceStatus,
      changed_by: auditUserId,
      reason: paidAmount > 0 ? 'canceled_with_payment' : 'canceled',
      meta: {
        action: action || null,
        refund_id: refund?.id || null,
        order_id: order.id,
        reallocation: reallocationAdded || null,
        ...(paidAmount > 0 ? { cancelled_refund_amount: paidAmount } : {})
      }
    });
    if (refund) {
      await logInvoiceStatusChange({
        invoice_id: inv.id,
        from_status: newInvoiceStatus,
        to_status: newInvoiceStatus,
        changed_by: auditUserId,
        reason: 'refund_requested',
        meta: { refund_id: refund.id, amount: refundAmount, bank_name: bankName, account_number: accountNumber }
      });
    } else if (balanceAdded != null) {
      await logInvoiceStatusChange({
        invoice_id: inv.id,
        from_status: newInvoiceStatus,
        to_status: newInvoiceStatus,
        changed_by: auditUserId,
        reason: 'to_balance',
        meta: { amount: balanceAdded.amount != null ? balanceAdded.amount : paidAmount }
      });
    } else if (reallocationAdded) {
      await logInvoiceStatusChange({
        invoice_id: inv.id,
        from_status: newInvoiceStatus,
        to_status: newInvoiceStatus,
        changed_by: auditUserId,
        reason: 'allocate_to_order',
        meta: reallocationAdded
      });
    }
  }

  let message = 'Invoice dibatalkan.';
  if (balanceAdded != null) {
    const amt = balanceAdded.amount != null ? balanceAdded.amount : paidAmount;
    message = `Invoice dibatalkan. Saldo akun +Rp ${Number(amt).toLocaleString('id-ID')}. Dapat digunakan untuk order baru atau alokasi ke tagihan.`;
  } else if (refund) {
    message = `Invoice dibatalkan. Permintaan refund Rp ${Number(refundAmount).toLocaleString('id-ID')} ke ${bankName} ${accountNumber} telah dicatat. Role accounting akan memproses.`;
    if (reallocationAdded) message += ` Sisa Rp ${Number(reallocationAdded.amount).toLocaleString('id-ID')} dialokasikan ke invoice lain.`;
    else if (balanceAdded != null) message += ` Sisa telah ditambahkan ke saldo akun.`;
  } else if (reallocationAdded) {
    message = `Invoice dibatalkan. Dana Rp ${Number(reallocationAdded.amount).toLocaleString('id-ID')} dialihkan ke invoice lain.`;
  }

  return { message, data: { order, refund, balance_added: balanceAdded, reallocation: reallocationAdded } };
}

function pickDiffMeta(type, meta) {
  const m = meta && typeof meta === 'object' ? meta : {};
  if (type === ORDER_ITEM_TYPE.HOTEL) return { room_type: m.room_type ?? null, with_meal: m.with_meal ?? m.meal ?? false, check_in: m.check_in ?? null, check_out: m.check_out ?? null, room_unit_price: m.room_unit_price ?? null, meal_unit_price: m.meal_unit_price ?? null };
  if (type === ORDER_ITEM_TYPE.TICKET) return { bandara: m.bandara ?? null, trip_type: m.trip_type ?? null, departure_date: m.departure_date ?? null, return_date: m.return_date ?? null };
  if (type === ORDER_ITEM_TYPE.BUS) return { travel_date: m.travel_date ?? null, route_type: m.route_type ?? null, bus_type: m.bus_type ?? null, trip_type: m.trip_type ?? null };
  if (type === ORDER_ITEM_TYPE.VISA) return { travel_date: m.travel_date ?? null };
  return {};
}

function orderItemDiffKey(it) {
  const type = String(it.type || '');
  const pid = String(it.product_ref_id || it.product_id || '');
  const meta = it.meta && typeof it.meta === 'object' ? it.meta : {};
  if (type === ORDER_ITEM_TYPE.HOTEL) {
    const rt = String(meta.room_type || it.room_type || '');
    const wm = (meta.with_meal ?? meta.meal) ? '1' : '0';
    return `${type}:${pid}:${rt}:${wm}`;
  }
  if (type === ORDER_ITEM_TYPE.TICKET) {
    const bandara = String(meta.bandara || '');
    const trip = String(meta.trip_type || '');
    return `${type}:${pid}:${bandara}:${trip}`;
  }
  if (type === ORDER_ITEM_TYPE.BUS) {
    const route = String(meta.route_type || '');
    const busType = String(meta.bus_type || '');
    const trip = String(meta.trip_type || '');
    return `${type}:${pid}:${route}:${busType}:${trip}`;
  }
  if (type === ORDER_ITEM_TYPE.SISKOPATUH) return `${type}:${pid}`;
  return `${type}:${pid}`;
}

/** Konversi unit_price ke IDR untuk hitung total order. Harga asli (unit_price + unit_price_currency) disimpan tidak berubah. */
function unitPriceToIdr(amount, currency, rates) {
  const amt = parseFloat(amount) || 0;
  const cur = (currency || 'IDR').toUpperCase();
  const s2i = (rates && rates.SAR_TO_IDR != null) ? rates.SAR_TO_IDR : 4200;
  const u2i = (rates && rates.USD_TO_IDR != null) ? rates.USD_TO_IDR : 15500;
  if (cur === 'SAR') return amt * s2i;
  if (cur === 'USD') return amt * u2i;
  return amt;
}

async function resolveHotelMonthlyPricing({
  item,
  productId,
  branchId,
  ownerId,
  qty,
  itemCurrency,
  unitPrice,
  rates
}) {
  const checkIn = item.check_in || item.meta?.check_in;
  const checkOut = item.check_out || item.meta?.check_out;
  if (!checkIn || !checkOut) {
    const unitPriceIdr = unitPriceToIdr(unitPrice, itemCurrency, rates);
    return {
      subtotal: qty * unitPriceIdr,
      unitPrice,
      unitPriceIdr,
      nights: 0,
      monthlyBreakdown: null,
      usedMonthlyPricing: false,
      room_unit_per_night_in_currency: null,
      meal_unit_per_person_per_night_in_currency: null
    };
  }

  let monthly;
  try {
    monthly = await calculateStayCostByNights({
      productId,
      branchId,
      ownerId,
      roomType: item.room_type || item.meta?.room_type,
      withMeal: item.meal ?? item.meta?.with_meal ?? item.meta?.meal ?? false,
      checkIn,
      checkOut,
      quantity: qty,
      currency: itemCurrency,
      rates
    });
  } catch (e) {
    if (e && (e.code === 'MISSING_HOTEL_MONTHLY_ROOM' || e.code === 'MISSING_HOTEL_MONTHLY_MEAL')) {
      const err = new Error(e.message);
      err.code = 'VALIDATION';
      throw err;
    }
    throw e;
  }

  if (!monthly.nights) {
    const unitPriceIdr = unitPriceToIdr(unitPrice, itemCurrency, rates);
    return {
      subtotal: qty * unitPriceIdr,
      unitPrice,
      unitPriceIdr,
      nights: 0,
      monthlyBreakdown: null,
      usedMonthlyPricing: false,
      room_unit_per_night_in_currency: null,
      meal_unit_per_person_per_night_in_currency: null
    };
  }

  return {
    subtotal: monthly.subtotal_idr,
    unitPrice: monthly.unit_price_in_currency,
    unitPriceIdr: unitPriceToIdr(monthly.unit_price_in_currency, itemCurrency, rates),
    nights: monthly.nights,
    monthlyBreakdown: monthly.breakdown,
    usedMonthlyPricing: true,
    usedFallbackDefault: monthly.used_fallback_default,
    room_unit_per_night_in_currency: monthly.room_unit_per_night_in_currency,
    meal_unit_per_person_per_night_in_currency: monthly.meal_unit_per_person_per_night_in_currency
  };
}

/** Ambil produk Hiace pertama dan harga efektif (untuk auto-add saat waive_bus_penalty). Return { productId, productName, unitPrice, unitPriceIdr, currency } atau null. */
async function getFirstHiaceProductAndPrice(branchId, ownerId) {
  const products = await Product.findAll({ where: { type: 'bus' }, attributes: ['id', 'name', 'code', 'meta'], raw: true });
  const hiace = products.find(p => {
    const meta = typeof p.meta === 'string' ? (() => { try { return JSON.parse(p.meta); } catch (e) { return {}; } })() : (p.meta || {});
    return meta.bus_kind === 'hiace';
  });
  if (!hiace) return null;
  const unitPrice = await getEffectivePrice(hiace.id, branchId, ownerId, { trip_type: 'round_trip' }, 'IDR');
  if (unitPrice == null || Number.isNaN(unitPrice)) return null;
  return { productId: hiace.id, productName: hiace.name || hiace.code, unitPrice, unitPriceIdr: unitPrice, currency: 'IDR' };
}

function groupForDiff(items) {
  const map = new Map();
  for (const raw of items || []) {
    const key = orderItemDiffKey(raw);
    const prev = map.get(key);
    const qty = Math.max(0, Number(raw.quantity) || 0);
    const unit = Number.parseFloat(raw.unit_price) || 0;
    const base = prev || {
      type: raw.type,
      product_ref_id: raw.product_ref_id || raw.product_id,
      quantity: 0,
      unit_price: unit,
      meta: pickDiffMeta(raw.type, raw.meta)
    };
    base.quantity += qty;
    // Jika unit_price berbeda antar item dengan key sama, simpan 0 agar UI tidak misleading
    if (prev && Math.abs((prev.unit_price || 0) - unit) > 0.01) base.unit_price = 0;
    map.set(key, base);
  }
  return map;
}

function diffGrouped(beforeMap, afterMap) {
  const added = [];
  const removed = [];
  const updated = [];
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  for (const k of keys) {
    const b = beforeMap.get(k);
    const a = afterMap.get(k);
    if (!b && a) added.push({ key: k, after: a });
    else if (b && !a) removed.push({ key: k, before: b });
    else if (b && a) {
      const changed = [];
      if (Math.abs((b.quantity || 0) - (a.quantity || 0)) > 0.0001) changed.push('quantity');
      if (Math.abs((b.unit_price || 0) - (a.unit_price || 0)) > 0.01) changed.push('unit_price');
      const bm = JSON.stringify(b.meta || {});
      const am = JSON.stringify(a.meta || {});
      if (bm !== am) changed.push('meta');
      if (changed.length) updated.push({ key: k, before: b, after: a, changed_fields: changed });
    }
  }
  return { added, removed, updated };
}

/**
 * GET /api/v1/orders
 * Acuan data: hanya order yang punya invoice (semua GET order/transaksi terintegrasi dengan data invoice).
 * Filter/tampil pakai nomor invoice; response selalu sertakan Invoice.invoice_number & status.
 */
const ALLOWED_SORT = ['created_at', 'total_amount', 'status'];

const list = asyncHandler(async (req, res) => {
  const { status, branch_id, owner_id, limit = 25, page = 1, sort_by, sort_order, date_from, date_to, invoice_number, provinsi_id, wilayah_id } = req.query;
  const where = {};
  if (status) where.status = status;
  if (branch_id) where.branch_id = branch_id;
  if (owner_id) where.owner_id = owner_id;
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const d = new Date(date_to);
      d.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = d;
    }
  }
  if (isOwnerRole(req.user.role)) where.owner_id = req.user.id;

  // Role invoice Saudi / super_admin / admin_pusat: lihat semua order (tanpa filter branch dari role)
  const isKoordinatorOrInvoiceKoordinator = ['invoice_koordinator'].includes(req.user.role);
  const seeAllOrdersByRole = ['super_admin', 'admin_pusat', 'invoice_saudi'].includes(req.user.role);
  let branchIdsWilayah = [];
  let effectiveWilayahId = req.user.wilayah_id;
  if (!seeAllOrdersByRole) {
    if (isKoordinatorOrInvoiceKoordinator) {
      if (!effectiveWilayahId && req.user.branch_id) {
        const branch = await Branch.findByPk(req.user.branch_id, {
          attributes: ['id'],
          include: [{ model: Provinsi, as: 'Provinsi', attributes: ['wilayah_id'], required: false }]
        });
        if (branch?.Provinsi?.wilayah_id) effectiveWilayahId = branch.Provinsi.wilayah_id;
      }
      if (effectiveWilayahId) {
        branchIdsWilayah = await getBranchIdsForWilayah(effectiveWilayahId);
        if (branchIdsWilayah.length > 0) {
          where.branch_id = branch_id ? (branchIdsWilayah.includes(branch_id) ? branch_id : 'none') : { [Op.in]: branchIdsWilayah };
        } else if (req.user.branch_id) {
          where.branch_id = req.user.branch_id;
        }
      } else if (req.user.branch_id) {
        where.branch_id = req.user.branch_id;
      }
    } else if (req.user.branch_id) {
      where.branch_id = req.user.branch_id;
    }
  }

  if (provinsi_id || wilayah_id) {
    let branchIds = [];
    if (wilayah_id) {
      branchIds = await getBranchIdsForWilayah(wilayah_id);
    } else if (provinsi_id) {
      const rows = await Branch.findAll({ where: { provinsi_id, is_active: true }, attributes: ['id'] });
      branchIds = rows.map((r) => r.id);
    }
    if (isKoordinatorOrInvoiceKoordinator && branchIdsWilayah.length > 0 && branchIds.length > 0) {
      branchIds = branchIds.filter(id => branchIdsWilayah.includes(id));
    }
    if (branchIds.length > 0) {
      where.branch_id = branch_id ? (branchIds.includes(branch_id) ? branch_id : 'none') : { [Op.in]: branchIds };
    } else {
      where.branch_id = 'none';
    }
  }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * lim;

  const sortCol = ALLOWED_SORT.includes(sort_by) ? sort_by : 'created_at';
  const sortDir = (sort_order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // Acuan data: hanya order yang punya invoice; filter/tampil pakai nomor invoice saja
  const invoiceInclude = { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status'], required: true };
  if (invoice_number && String(invoice_number).trim()) {
    invoiceInclude.where = { invoice_number: { [Op.iLike]: `%${String(invoice_number).trim()}%` } };
  }
  const { count, rows } = await Order.findAndCountAll({
    where,
    include: [
      invoiceInclude,
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch', attributes: ['id', 'code', 'name'] },
      { model: OrderItem, as: 'OrderItems' }
    ],
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

/** Cek apakah order items punya visa yang wajib hotel; jika ya, items harus ada hotel. */
async function visaRequiresHotel(items) {
  const visaProductIds = (items || [])
    .filter(i => i.type === ORDER_ITEM_TYPE.VISA && i.product_id)
    .map(i => i.product_id);
  if (visaProductIds.length === 0) return false;
  const products = await Product.findAll({
    where: { id: visaProductIds },
    attributes: ['id', 'meta'],
    raw: true
  });
  return products.some(p => (p.meta && p.meta.require_hotel === true));
}

function isDateOnlyValid(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(str || ''));
}

function normalizeDateOnly(str) {
  return String(str || '').slice(0, 10);
}

async function assertPackageIsInValidityWindow(productId, referenceDate) {
  if (!productId) return;
  const pkg = await Product.findByPk(productId, { attributes: ['id', 'type', 'is_active', 'meta'], raw: true });
  if (!pkg || pkg.type !== ORDER_ITEM_TYPE.PACKAGE) return;
  if (pkg.is_active === false) {
    const err = new Error('Paket tidak aktif');
    err.code = 'VALIDATION';
    throw err;
  }
  const m = pkg.meta && typeof pkg.meta === 'object' ? pkg.meta : {};
  const validFrom = m.valid_from ? normalizeDateOnly(m.valid_from) : null;
  const validUntil = m.valid_until ? normalizeDateOnly(m.valid_until) : null;
  const ref = normalizeDateOnly(referenceDate || new Date().toISOString().slice(0, 10));
  if (validFrom && isDateOnlyValid(validFrom) && ref < validFrom) {
    const err = new Error(`Paket belum berlaku. Berlaku mulai ${validFrom}`);
    err.code = 'VALIDATION';
    throw err;
  }
  if (validUntil && isDateOnlyValid(validUntil) && ref > validUntil) {
    const err = new Error(`Paket sudah tidak berlaku (berakhir ${validUntil})`);
    err.code = 'VALIDATION';
    throw err;
  }
}

/**
 * Buat order + invoice dari items (dipanggil dari AI chat saat owner minta buatkan invoice).
 * @param {{ ownerId: string, branchId: string, items: Array, createdByUserId: string }} params
 * items format: [{ type, product_id, quantity, unit_price, currency?, meta?, check_in?, check_out?, room_type?, meal? }]
 * @returns {Promise<{ order: import('../models').Order, invoice: import('../models').Invoice|null }>}
 */
async function createOrderAndInvoiceFromItemsForOwner({ ownerId, branchId, items, createdByUserId, waive_bus_penalty }) {
  const finalBranchId = branchId && String(branchId).trim().length >= 10 ? String(branchId).trim() : null;
  if (!finalBranchId || !ownerId) {
    const err = new Error('Branch dan owner wajib.');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    const err = new Error('Item invoice wajib');
    err.code = 'VALIDATION';
    throw err;
  }

  const rules = await getRulesForBranch(finalBranchId);
  const hasHotel = items.some(i => i.type === ORDER_ITEM_TYPE.HOTEL);
  const visaNeedsHotel = await visaRequiresHotel(items);
  if (visaNeedsHotel && !hasHotel) {
    const err = new Error('Visa wajib bersama hotel');
    err.code = 'VALIDATION';
    throw err;
  }

  let ratesForCreate = null;
  const cr = rules.currency_rates;
  const crObj = typeof cr === 'object' && cr != null ? cr : (typeof cr === 'string' ? (() => { try { return JSON.parse(cr); } catch (e) { return null; } })() : null);
  if (crObj && (typeof crObj.SAR_TO_IDR === 'number' || typeof crObj.USD_TO_IDR === 'number')) {
    ratesForCreate = {
      SAR_TO_IDR: typeof crObj.SAR_TO_IDR === 'number' ? crObj.SAR_TO_IDR : 4200,
      USD_TO_IDR: typeof crObj.USD_TO_IDR === 'number' ? crObj.USD_TO_IDR : 15500
    };
  }
  if (!ratesForCreate) ratesForCreate = { SAR_TO_IDR: 4200, USD_TO_IDR: 15500 };

  let subtotal = 0;
  let totalJamaah = 0;
  const orderItems = [];

  for (const it of items) {
    if (it.type === ORDER_ITEM_TYPE.PACKAGE && it.product_id) {
      await assertPackageIsInValidityWindow(it.product_id, new Date().toISOString().slice(0, 10));
    }
    if (it.type === ORDER_ITEM_TYPE.TICKET) {
      const bandara = it.meta?.bandara;
      if (!bandara || !BANDARA_TIKET_CODES.includes(bandara)) {
        const err = new Error('Item tiket wajib pilih bandara (BTH, CGK, SBY, atau UPG)');
        err.code = 'VALIDATION';
        throw err;
      }
      if (it.meta?.trip_type && !TICKET_TRIP_TYPES.includes(it.meta.trip_type)) {
        const err = new Error('trip_type tiket harus one_way, return_only, atau round_trip');
        err.code = 'VALIDATION';
        throw err;
      }
      const tripType = it.meta?.trip_type || 'round_trip';
      if (tripType === 'round_trip' && (!it.meta?.departure_date || !it.meta?.return_date)) {
        const err = new Error('Tiket pulang pergi wajib isi tanggal keberangkatan dan tanggal kepulangan');
        err.code = 'VALIDATION';
        throw err;
      }
      if (tripType === 'one_way' && !it.meta?.departure_date) {
        const err = new Error('Tiket pergi saja wajib isi tanggal keberangkatan');
        err.code = 'VALIDATION';
        throw err;
      }
      if (tripType === 'return_only' && !it.meta?.return_date) {
        const err = new Error('Tiket pulang saja wajib isi tanggal kepulangan');
        err.code = 'VALIDATION';
        throw err;
      }
    }
    if (it.type === ORDER_ITEM_TYPE.BUS) {
      if (it.meta?.trip_type && !BUS_TRIP_TYPES.includes(it.meta.trip_type)) {
        const err = new Error('Trip type bus harus one_way, return_only, atau round_trip (pulang pergi)');
        err.code = 'VALIDATION';
        throw err;
      }
    }
    const qty = parseInt(it.quantity, 10) || 1;
    const itemCurrency = (it.currency && ['IDR', 'SAR', 'USD'].includes(String(it.currency).toUpperCase())) ? String(it.currency).toUpperCase() : 'IDR';
    const checkIn = it.check_in || it.meta?.check_in;
    const checkOut = it.check_out || it.meta?.check_out;
    let unitPrice = parseFloat(it.unit_price);
    if (unitPrice == null || isNaN(unitPrice) || unitPrice < 0) {
      if (it.type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) {
        unitPrice = 0;
      } else {
        const productId = it.product_id;
        if (!productId) {
          const err = new Error('product_id atau unit_price wajib per item');
          err.code = 'VALIDATION';
          throw err;
        }
        unitPrice = await getEffectivePrice(productId, finalBranchId, ownerId, it.meta || {}, itemCurrency);
        if (unitPrice == null) {
          const err = new Error(`Harga tidak ditemukan untuk product ${productId}`);
          err.code = 'VALIDATION';
          throw err;
        }
      }
    }
    let unitPriceIdr = unitPriceToIdr(unitPrice, itemCurrency, ratesForCreate);
    if (it.type === ORDER_ITEM_TYPE.HOTEL && it.product_id && (it.room_type || it.meta?.room_type)) {
      const rt = it.room_type || it.meta?.room_type;
      if (checkIn && checkOut) {
        const avail = await checkAvailability(it.product_id, rt, checkIn, checkOut, qty, null);
        if (!avail.ok) {
          const err = new Error(avail.message || 'Kamar tidak tersedia untuk tanggal yang dipilih');
          err.code = 'VALIDATION';
          throw err;
        }
      }
    }
    let st;
    let monthlyBreakdown = null;
    let usedMonthlyPricing = false;
    let monthlyPricing = null;
    if (it.type === ORDER_ITEM_TYPE.HOTEL) {
      monthlyPricing = await resolveHotelMonthlyPricing({
        item: it,
        productId: it.product_id,
        branchId: finalBranchId,
        ownerId,
        qty,
        itemCurrency,
        unitPrice,
        rates: ratesForCreate
      });
      st = monthlyPricing.subtotal;
      unitPrice = monthlyPricing.unitPrice;
      unitPriceIdr = monthlyPricing.unitPriceIdr;
      monthlyBreakdown = monthlyPricing.monthlyBreakdown;
      usedMonthlyPricing = monthlyPricing.usedMonthlyPricing;
    } else {
      st = qty * unitPriceIdr;
    }
    subtotal += st;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.room_type || it.meta?.room_type) && ROOM_CAPACITY[it.room_type || it.meta?.room_type] != null) {
      totalJamaah += qty * ROOM_CAPACITY[it.room_type || it.meta?.room_type];
    }
    if (it.type === ORDER_ITEM_TYPE.BUS) {
      totalJamaah += qty;
    }
    const meta = {
      room_type: it.room_type || it.meta?.room_type,
      meal: it.meal ?? it.meta?.with_meal ?? it.meta?.meal,
      ...(it.meta || {})
    };
    if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.check_in || it.meta?.check_in)) meta.check_in = it.check_in || it.meta.check_in;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.check_out || it.meta?.check_out)) meta.check_out = it.check_out || it.meta.check_out;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) {
      const nights = getNights(checkIn, checkOut);
      if (nights > 0) meta.nights = nights;
    }
    if (it.type === ORDER_ITEM_TYPE.HOTEL && usedMonthlyPricing && Array.isArray(monthlyBreakdown)) {
      meta.monthly_price_breakdown = monthlyBreakdown;
    }
    if (it.type === ORDER_ITEM_TYPE.HOTEL && usedMonthlyPricing && monthlyPricing && monthlyPricing.room_unit_per_night_in_currency != null) {
      meta.room_unit_price = monthlyPricing.room_unit_per_night_in_currency;
      meta.meal_unit_price = monthlyPricing.meal_unit_per_person_per_night_in_currency != null
        ? monthlyPricing.meal_unit_per_person_per_night_in_currency
        : 0;
    } else {
      if (it.type === ORDER_ITEM_TYPE.HOTEL && it.meta?.room_unit_price != null) meta.room_unit_price = it.meta.room_unit_price;
      if (it.type === ORDER_ITEM_TYPE.HOTEL && it.meta?.meal_unit_price != null) meta.meal_unit_price = it.meta.meal_unit_price;
    }
    if (it.type === ORDER_ITEM_TYPE.BUS && !meta.trip_type) meta.trip_type = 'round_trip';
    orderItems.push({
      type: it.type,
      product_ref_id: it.product_id,
      product_ref_type: 'product',
      quantity: qty,
      unit_price: unitPrice,
      unit_price_currency: itemCurrency,
      subtotal: st,
      manifest_file_url: it.manifest_file_url || null,
      meta
    });
  }

  // Penalti bus: bus besar sudah include dengan visa. Jika visa < 35 pack → penalti flat (Rp 500.000). Bisa dihapus jika pakai Hiace saja (waive_bus_penalty).
  const waiveBusPenalty = (waive_bus_penalty === true || waive_bus_penalty === 'true');
  const hasVisaItems = orderItems.some((i) => i.type === ORDER_ITEM_TYPE.VISA);
  const totalVisaPacks = orderItems.filter((i) => i.type === ORDER_ITEM_TYPE.VISA).reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0);
  const minPack = parseInt(rules.bus_min_pack, 10) || BUSINESS_RULES.BUS_MIN_PACK || 35;
  const penaltyPerPackIdr = parseFloat(rules.bus_penalty_idr) || 500000;
  const shortfall = hasVisaItems && totalVisaPacks < minPack ? minPack - totalVisaPacks : 0;
  const penaltyAmount = !waiveBusPenalty && shortfall > 0 ? shortfall * penaltyPerPackIdr : 0;

  let ratesPayload = {};
  const crForPayload = typeof rules.currency_rates === 'object' && rules.currency_rates != null
    ? rules.currency_rates
    : (typeof rules.currency_rates === 'string' ? (() => { try { return JSON.parse(rules.currency_rates); } catch (e) { return null; } })() : null);
  if (crForPayload && (crForPayload.SAR_TO_IDR != null || crForPayload.USD_TO_IDR != null)) {
    ratesPayload = { currency_rates_override: crForPayload };
  }

  const order = await Order.create({
    order_number: generateOrderNumber(),
    owner_id: ownerId,
    branch_id: finalBranchId,
    total_jamaah: totalJamaah,
    subtotal,
    penalty_amount: penaltyAmount,
    total_amount: subtotal + penaltyAmount,
    status: 'draft',
    created_by: createdByUserId,
    notes: null,
    ...ratesPayload
  });

  for (const it of orderItems) {
    await OrderItem.create({ ...it, order_id: order.id });
  }

  const orderForInvoice = await Order.findByPk(order.id, {
    attributes: ['id', 'order_number', 'owner_id', 'branch_id', 'total_amount', 'currency_rates_override']
  });
  let invoice = null;
  try {
    invoice = await createInvoiceForOrder(orderForInvoice, {});
  } catch (invErr) {
    console.error('Auto-create invoice after order create (AI flow) failed:', invErr);
  }

  return { order, invoice };
}

/**
 * POST /api/v1/orders
 * Items: [{ product_id, type, quantity, unit_price (optional - resolved if not sent), room_type?, meal?, meta? }]
 * Validasi: visa wajib hotel dari product.meta.require_hotel; bus min pack penalty from business rules.
 */
const create = asyncHandler(async (req, res) => {
  const { items, branch_id, owner_id, owner_name_manual, owner_phone_manual, owner_input_mode, notes, currency_rates_override, waive_bus_penalty } = req.body;
  const isOwnerUser = isOwnerRole(req.user.role);
  const isInvoiceRole = ['invoice_koordinator', 'invoice_saudi'].includes(req.user.role);
  const ownerIdStr = typeof owner_id === 'string' && owner_id.trim() !== '' ? owner_id.trim() : null;
  const ownerInputMode = (owner_input_mode === 'manual' || owner_input_mode === 'registered') ? owner_input_mode : 'registered';
  const manualOwnerName = typeof owner_name_manual === 'string' ? owner_name_manual.trim() : '';
  const manualOwnerPhone = typeof owner_phone_manual === 'string' ? owner_phone_manual.trim() : '';
  const effectiveOwnerId = isOwnerUser ? req.user.id : ownerIdStr;
  // Gunakan branch_id dari body hanya jika benar-benar string non-kosong (body tanpa branch_id = undefined)
  const bodyBranchOk = typeof branch_id === 'string' && branch_id.trim() !== '';
  let effectiveBranchId = bodyBranchOk ? branch_id.trim() : (req.user.branch_id || null);
  const isManualOwnerFlow = !isOwnerUser && ownerInputMode === 'manual' && !effectiveOwnerId;

  // Untuk owner: ambil assigned_branch_id dari OwnerProfile jika belum ada branch_id
  if (isOwnerUser && !effectiveBranchId) {
    try {
      const profile = await OwnerProfile.findOne({
        where: { user_id: req.user.id },
        attributes: ['assigned_branch_id'],
        raw: true
      });
      if (profile && profile.assigned_branch_id) {
        const assigned = profile.assigned_branch_id;
        const assignedStr = typeof assigned === 'string' ? assigned.trim() : String(assigned).trim();
        if (assignedStr && assignedStr !== 'null' && assignedStr !== 'undefined' && assignedStr.length >= 10) {
          effectiveBranchId = assignedStr;
        }
      }
    } catch (err) {
      console.error('Error fetching owner profile:', err);
    }
  }

  // Role invoice (koordinator/saudi): jika kirim owner_id tanpa branch_id, ambil cabang dari owner tersebut
  if (isInvoiceRole && effectiveOwnerId && !effectiveBranchId) {
    try {
      const profile = await OwnerProfile.findOne({
        where: { user_id: effectiveOwnerId },
        attributes: ['assigned_branch_id'],
        raw: true
      });
      if (profile && profile.assigned_branch_id) {
        const assignedStr = String(profile.assigned_branch_id).trim();
        if (assignedStr.length >= 10) effectiveBranchId = assignedStr;
      }
    } catch (err) {
      console.error('Error fetching owner profile for invoice role:', err);
    }
  }
  
  // Validasi final: pastikan branchId adalah UUID string yang valid sebelum digunakan
  const branchIdStr = effectiveBranchId != null && effectiveBranchId !== undefined 
    ? String(effectiveBranchId).trim() 
    : '';
  
  // Validasi: harus ada, bukan string kosong, bukan 'undefined'/'null', dan minimal panjang UUID
  const finalBranchId = branchIdStr && branchIdStr !== 'undefined' && branchIdStr !== 'null' && branchIdStr.length >= 10 
    ? branchIdStr 
    : null;
  
  if (!finalBranchId) {
    console.log('Order create failed - no branch_id:', {
      role: req.user.role,
      bodyBranchId: branch_id,
      userBranchId: req.user.branch_id,
      effectiveBranchId,
      branchIdStr
    });
    const msg = isOwnerRole(req.user.role)
      ? 'Owner belum di-assign cabang. Hubungi admin/koordinator untuk assign cabang.'
      : isInvoiceRole
        ? (isManualOwnerFlow
            ? 'Untuk owner tanpa akun, pilih cabang secara manual.'
            : 'Owner yang dipilih belum memiliki cabang. Pilih owner lain atau hubungi admin untuk menetapkan cabang.')
        : 'Branch/cabang wajib. Pilih cabang atau pastikan akun owner sudah di-assign cabang.';
    return res.status(400).json({ success: false, message: msg });
  }

  if (!isOwnerUser && !effectiveOwnerId && !manualOwnerName) {
    return res.status(400).json({
      success: false,
      message: 'Pilih owner terdaftar, atau isi nama owner tanpa akun.'
    });
  }
  
  console.log('Order create - using branch_id:', finalBranchId, 'for user:', req.user.id, 'role:', req.user.role);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Item invoice wajib' });
  }

  // Validasi: hanya bus Hiace yang boleh dipesan. Bus besar sudah include dengan visa.
  const busProductIds = [...new Set(items.filter((i) => i.type === ORDER_ITEM_TYPE.BUS).map((i) => i.product_id).filter(Boolean))];
  if (busProductIds.length > 0) {
    const busProducts = await Product.findAll({ where: { id: busProductIds }, attributes: ['id', 'meta'], raw: true });
    for (const p of busProducts) {
      const meta = typeof p.meta === 'string' ? (() => { try { return JSON.parse(p.meta); } catch (e) { return {}; } })() : (p.meta || {});
      if (meta.bus_kind !== 'hiace') {
        return res.status(400).json({ success: false, message: 'Hanya bus Hiace yang dapat dipesan. Bus besar sudah include dengan visa.' });
      }
    }
  }

  const rules = await getRulesForBranch(finalBranchId);
  const hasHotel = items.some(i => i.type === ORDER_ITEM_TYPE.HOTEL);
  const visaNeedsHotel = await visaRequiresHotel(items);
  if (visaNeedsHotel && !hasHotel) {
    return res.status(400).json({ success: false, message: 'Visa wajib bersama hotel' });
  }

  const canSetRatesCreate = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
  let ratesForCreate = null;
  if (canSetRatesCreate && currency_rates_override && typeof currency_rates_override === 'object') {
    if (typeof currency_rates_override.SAR_TO_IDR === 'number' || typeof currency_rates_override.USD_TO_IDR === 'number') {
      ratesForCreate = {
        SAR_TO_IDR: typeof currency_rates_override.SAR_TO_IDR === 'number' ? currency_rates_override.SAR_TO_IDR : 4200,
        USD_TO_IDR: typeof currency_rates_override.USD_TO_IDR === 'number' ? currency_rates_override.USD_TO_IDR : 15500
      };
    }
  }
  if (!ratesForCreate) {
    const cr = rules.currency_rates;
    const crObj = typeof cr === 'object' && cr != null ? cr : (typeof cr === 'string' ? (() => { try { return JSON.parse(cr); } catch (e) { return null; } })() : null);
    if (crObj && (typeof crObj.SAR_TO_IDR === 'number' || typeof crObj.USD_TO_IDR === 'number')) {
      ratesForCreate = {
        SAR_TO_IDR: typeof crObj.SAR_TO_IDR === 'number' ? crObj.SAR_TO_IDR : 4200,
        USD_TO_IDR: typeof crObj.USD_TO_IDR === 'number' ? crObj.USD_TO_IDR : 15500
      };
    }
  }
  if (!ratesForCreate) ratesForCreate = { SAR_TO_IDR: 4200, USD_TO_IDR: 15500 };

  let subtotal = 0;
  let totalJamaah = 0;
  const orderItems = [];

  for (const it of items) {
    if (it.type === ORDER_ITEM_TYPE.PACKAGE && it.product_id) {
      await assertPackageIsInValidityWindow(it.product_id, new Date().toISOString().slice(0, 10));
    }
    if (it.type === ORDER_ITEM_TYPE.TICKET) {
      const bandara = it.meta?.bandara;
      if (!bandara || !BANDARA_TIKET_CODES.includes(bandara)) {
        return res.status(400).json({ success: false, message: 'Item tiket wajib pilih bandara (BTH, CGK, SBY, atau UPG)' });
      }
      if (it.meta?.trip_type && !TICKET_TRIP_TYPES.includes(it.meta.trip_type)) {
        return res.status(400).json({ success: false, message: 'trip_type tiket harus one_way, return_only, atau round_trip' });
      }
      const tripType = it.meta?.trip_type || 'round_trip';
      if (tripType === 'round_trip' && (!it.meta?.departure_date || !it.meta?.return_date)) {
        return res.status(400).json({ success: false, message: 'Tiket pulang pergi wajib isi tanggal keberangkatan dan tanggal kepulangan' });
      }
      if (tripType === 'one_way' && !it.meta?.departure_date) {
        return res.status(400).json({ success: false, message: 'Tiket pergi saja wajib isi tanggal keberangkatan' });
      }
      if (tripType === 'return_only' && !it.meta?.return_date) {
        return res.status(400).json({ success: false, message: 'Tiket pulang saja wajib isi tanggal kepulangan' });
      }
    }
    if (it.type === ORDER_ITEM_TYPE.BUS) {
      if (it.meta?.trip_type && !BUS_TRIP_TYPES.includes(it.meta.trip_type)) {
        return res.status(400).json({ success: false, message: 'Trip type bus harus one_way, return_only, atau round_trip (pulang pergi)' });
      }
    }
    const qty = parseInt(it.quantity, 10) || 1;
    const itemCurrency = (it.currency && ['IDR', 'SAR', 'USD'].includes(String(it.currency).toUpperCase())) ? String(it.currency).toUpperCase() : 'IDR';
    const checkIn = it.check_in || it.meta?.check_in;
    const checkOut = it.check_out || it.meta?.check_out;
    let unitPrice = parseFloat(it.unit_price);
    if (unitPrice == null || isNaN(unitPrice) || unitPrice < 0) {
      if (it.type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) {
        unitPrice = 0;
      } else {
        const productId = it.product_id;
        if (!productId) return res.status(400).json({ success: false, message: 'product_id atau unit_price wajib per item' });
        unitPrice = await getEffectivePrice(productId, finalBranchId, effectiveOwnerId, it.meta || {}, itemCurrency);
        if (unitPrice == null) return res.status(400).json({ success: false, message: `Harga tidak ditemukan untuk product ${productId}` });
      }
    }
    let unitPriceIdr = unitPriceToIdr(unitPrice, itemCurrency, ratesForCreate);
    if (it.type === ORDER_ITEM_TYPE.HOTEL && it.product_id && it.room_type) {
      if (checkIn && checkOut) {
        const avail = await checkAvailability(it.product_id, it.room_type, checkIn, checkOut, qty, null);
        if (!avail.ok) return res.status(400).json({ success: false, message: avail.message || 'Kamar tidak tersedia untuk tanggal yang dipilih' });
      }
    }
    // Hotel & makan: hitung dari jumlah malam (check-in s/d check-out). Subtotal dalam IDR untuk total order.
    let st;
    let monthlyBreakdown = null;
    let usedMonthlyPricing = false;
    let monthlyPricing = null;
    if (it.type === ORDER_ITEM_TYPE.HOTEL) {
      try {
        monthlyPricing = await resolveHotelMonthlyPricing({
          item: it,
          productId: it.product_id,
          branchId: finalBranchId,
          ownerId: effectiveOwnerId,
          qty,
          itemCurrency,
          unitPrice,
          rates: ratesForCreate
        });
      } catch (e) {
        if (e && e.code === 'VALIDATION') {
          return res.status(400).json({ success: false, message: e.message });
        }
        throw e;
      }
      st = monthlyPricing.subtotal;
      unitPrice = monthlyPricing.unitPrice;
      unitPriceIdr = monthlyPricing.unitPriceIdr;
      monthlyBreakdown = monthlyPricing.monthlyBreakdown;
      usedMonthlyPricing = monthlyPricing.usedMonthlyPricing;
    } else {
      st = qty * unitPriceIdr;
    }
    subtotal += st;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && it.room_type && ROOM_CAPACITY[it.room_type] != null) {
      totalJamaah += qty * ROOM_CAPACITY[it.room_type];
    }
    if (it.type === ORDER_ITEM_TYPE.BUS) {
      totalJamaah += qty;
    }
    const meta = {
      room_type: it.room_type,
      meal: it.meal,
      ...(it.meta || {})
    };
    if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.check_in || it.meta?.check_in)) meta.check_in = it.check_in || it.meta.check_in;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.check_out || it.meta?.check_out)) meta.check_out = it.check_out || it.meta.check_out;
    if (it.type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) {
      const nights = getNights(checkIn, checkOut);
      if (nights > 0) meta.nights = nights;
    }
    if (it.type === ORDER_ITEM_TYPE.HOTEL && usedMonthlyPricing && Array.isArray(monthlyBreakdown)) {
      meta.monthly_price_breakdown = monthlyBreakdown;
    }
    if (it.type === ORDER_ITEM_TYPE.HOTEL && usedMonthlyPricing && monthlyPricing && monthlyPricing.room_unit_per_night_in_currency != null) {
      meta.room_unit_price = monthlyPricing.room_unit_per_night_in_currency;
      meta.meal_unit_price = monthlyPricing.meal_unit_per_person_per_night_in_currency != null
        ? monthlyPricing.meal_unit_per_person_per_night_in_currency
        : 0;
    } else {
      if (it.type === ORDER_ITEM_TYPE.HOTEL && it.meta?.room_unit_price != null) meta.room_unit_price = it.meta.room_unit_price;
      if (it.type === ORDER_ITEM_TYPE.HOTEL && it.meta?.meal_unit_price != null) meta.meal_unit_price = it.meta.meal_unit_price;
    }
    if (it.type === ORDER_ITEM_TYPE.BUS && !meta.trip_type) meta.trip_type = 'round_trip';
    orderItems.push({
      type: it.type,
      product_ref_id: it.product_id,
      product_ref_type: 'product',
      quantity: qty,
      unit_price: unitPrice,
      unit_price_currency: itemCurrency,
      subtotal: st,
      manifest_file_url: it.manifest_file_url || null,
      meta
    });
  }

  // Penalti bus: bus besar sudah include dengan visa. Jika visa < 35 pack → penalti flat Rp 500.000. Bisa dihapus (waive_bus_penalty) jika pakai Hiace saja.
  const waiveBusPenaltyCreate = (waive_bus_penalty === true || waive_bus_penalty === 'true');
  const hasVisaItems = orderItems.some((i) => i.type === ORDER_ITEM_TYPE.VISA);
  const totalVisaPacks = orderItems.filter((i) => i.type === ORDER_ITEM_TYPE.VISA).reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0);
  const minPack = parseInt(rules.bus_min_pack, 10) || BUSINESS_RULES.BUS_MIN_PACK || 35;
  const penaltyPerPackIdr = parseFloat(rules.bus_penalty_idr) || 500000;
  const shortfallCreate = hasVisaItems && totalVisaPacks < minPack ? minPack - totalVisaPacks : 0;
  const penaltyAmount = !waiveBusPenaltyCreate && shortfallCreate > 0 ? shortfallCreate * penaltyPerPackIdr : 0;

  // Final safety check sebelum create
  if (!finalBranchId || typeof finalBranchId !== 'string' || finalBranchId.length < 10) {
    return res.status(400).json({
      success: false,
      message: isOwnerRole(req.user.role)
        ? 'Owner belum di-assign cabang. Hubungi admin/koordinator untuk assign cabang.'
        : 'Branch/cabang wajib. Pilih cabang atau pastikan akun owner sudah di-assign cabang.'
    });
  }

  const canSetRates = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
  let ratesOverride = canSetRates && currency_rates_override && typeof currency_rates_override === 'object'
    ? {
        SAR_TO_IDR: typeof currency_rates_override.SAR_TO_IDR === 'number' ? currency_rates_override.SAR_TO_IDR : null,
        USD_TO_IDR: typeof currency_rates_override.USD_TO_IDR === 'number' ? currency_rates_override.USD_TO_IDR : null
      }
    : null;
  if (!ratesOverride || (ratesOverride.SAR_TO_IDR == null && ratesOverride.USD_TO_IDR == null)) {
    const cr = rules.currency_rates;
    const crObj = typeof cr === 'object' && cr != null ? cr : (typeof cr === 'string' ? (() => { try { return JSON.parse(cr); } catch (e) { return null; } })() : null);
    if (crObj && (typeof crObj.SAR_TO_IDR === 'number' || typeof crObj.USD_TO_IDR === 'number')) {
      ratesOverride = {
        SAR_TO_IDR: typeof crObj.SAR_TO_IDR === 'number' ? crObj.SAR_TO_IDR : null,
        USD_TO_IDR: typeof crObj.USD_TO_IDR === 'number' ? crObj.USD_TO_IDR : null
      };
    }
  }
  const ratesPayload = (ratesOverride && (ratesOverride.SAR_TO_IDR != null || ratesOverride.USD_TO_IDR != null))
    ? { currency_rates_override: ratesOverride }
    : {};

  let order;
  try {
    order = await Order.create({
      order_number: generateOrderNumber(),
      owner_id: effectiveOwnerId || null,
      owner_name_manual: !effectiveOwnerId ? manualOwnerName : null,
      owner_phone_manual: !effectiveOwnerId ? (manualOwnerPhone || null) : null,
      owner_input_mode: effectiveOwnerId ? 'registered' : 'manual',
      branch_id: finalBranchId,
      total_jamaah: totalJamaah,
      subtotal,
      penalty_amount: penaltyAmount,
      total_amount: subtotal + penaltyAmount,
      status: 'draft',
      created_by: req.user.id,
      notes,
      waive_bus_penalty: !!waiveBusPenaltyCreate,
      ...ratesPayload
    });
  } catch (createErr) {
    console.error('Error creating order:', createErr);
    if (createErr.name === 'SequelizeValidationError' || createErr.name === 'SequelizeDatabaseError') {
      const field = createErr.errors?.[0]?.path || createErr.original?.constraint;
      if (field === 'branch_id' || (createErr.message && createErr.message.includes('branch_id'))) {
        return res.status(400).json({
          success: false,
          message: isOwnerRole(req.user.role)
            ? 'Owner belum di-assign cabang. Hubungi admin/koordinator untuk assign cabang.'
            : 'Branch/cabang wajib. Pilih cabang atau pastikan akun owner sudah di-assign cabang.'
        });
      }
    }
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat invoice: ' + (createErr.message || 'Unknown error')
    });
  }

  for (const it of orderItems) {
    await OrderItem.create({ ...it, order_id: order.id });
  }

  // Jika centang "Tanpa penalti bus (pakai Hiace saja)": tambah 1 item Hiace otomatis agar tampil di progress bus dan harga Hiace qty 1 dihitung.
  if (waiveBusPenaltyCreate && !orderItems.some((i) => i.type === ORDER_ITEM_TYPE.BUS)) {
    const hiace = await getFirstHiaceProductAndPrice(finalBranchId, effectiveOwnerId);
    if (hiace) {
      const hiaceMeta = { trip_type: 'round_trip', auto_hiace_waive: true };
      await OrderItem.create({
        order_id: order.id,
        type: ORDER_ITEM_TYPE.BUS,
        product_ref_id: hiace.productId,
        product_ref_type: 'product',
        quantity: 1,
        unit_price: hiace.unitPrice,
        unit_price_currency: hiace.currency,
        subtotal: hiace.unitPriceIdr,
        meta: hiaceMeta
      });
      const newSubtotal = (parseFloat(order.subtotal) || 0) + hiace.unitPriceIdr;
      await order.update({
        subtotal: newSubtotal,
        penalty_amount: 0,
        total_amount: newSubtotal,
        total_jamaah: totalJamaah + 1
      });
    }
  }

  const saveAsDraft = req.body.save_as_draft === true || req.body.save_as_draft === 'true';
  if (!saveAsDraft) {
    const orderForInvoice = await Order.findByPk(order.id, {
      attributes: ['id', 'order_number', 'owner_id', 'branch_id', 'total_amount']
    });
    if (orderForInvoice) {
      try {
        const opts = {};
        if (req.body.dp_percentage != null) opts.dp_percentage = req.body.dp_percentage;
        if (req.body.dp_amount != null) opts.dp_amount = req.body.dp_amount;
        const inv = await createInvoiceForOrder(orderForInvoice, opts);
        if (inv) {
          console.log('Auto-created invoice', inv.invoice_number, 'for order', order.order_number);
        }
      } catch (invErr) {
        console.error('Auto-create invoice after order create failed:', invErr);
      }
    }
  }

  const full = await Order.findByPk(order.id, {
    include: [
      { model: OrderItem, as: 'OrderItems' },
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status'], required: false }
    ]
  });
  res.status(201).json({ success: true, data: full });
});

/**
 * GET /api/v1/orders/:id
 */
const getById = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id, {
    include: [
      { model: User, as: 'User', attributes: ['id', 'name', 'email', 'company_name'] },
      { model: Branch, as: 'Branch' },
      {
        model: OrderItem,
        as: 'OrderItems',
        include: [
          { model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false },
          { model: VisaProgress, as: 'VisaProgress', required: false },
          { model: TicketProgress, as: 'TicketProgress', required: false }
        ]
      },
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'status'], required: false }
    ]
  });
  if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  if (isOwnerRole(req.user.role) && order.owner_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  res.json({ success: true, data: order });
});

/**
 * PATCH /api/v1/orders/:id
 * Update order (tambah/kurang/ubah item) - recalc totals. Invoice otomatis di-update bila ada.
 * Owner boleh ubah order sebelum dan setelah DP/lunas; sistem update invoice terbaru.
 */
const update = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id, { include: [{ model: OrderItem, as: 'OrderItems' }] });
  if (!order) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
  const canUpdate = ['invoice_koordinator', 'invoice_saudi'].includes(req.user.role) || (isOwnerRole(req.user.role) && order.owner_id === req.user.id);
  if (!canUpdate) {
    return res.status(403).json({ success: false, message: 'Hanya owner (invoice sendiri) atau invoice koordinator/Saudi yang dapat mengubah order' });
  }
  if (!['draft', 'tentative', 'confirmed', 'processing'].includes(order.status)) {
    return res.status(400).json({ success: false, message: 'Invoice hanya bisa diubah saat draft/tentative/confirmed/processing' });
  }
  const { items, notes, currency_rates_override, waive_bus_penalty } = req.body;
  const canSetRates = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
  const hasDpPayment = order.dp_payment_status === DP_PAYMENT_STATUS.PEMBAYARAN_DP;
  if (canSetRates && !hasDpPayment) {
    let ratesOverride = (currency_rates_override && typeof currency_rates_override === 'object')
      ? {
          SAR_TO_IDR: typeof currency_rates_override.SAR_TO_IDR === 'number' ? currency_rates_override.SAR_TO_IDR : null,
          USD_TO_IDR: typeof currency_rates_override.USD_TO_IDR === 'number' ? currency_rates_override.USD_TO_IDR : null
        }
      : null;
    if ((!ratesOverride || (ratesOverride.SAR_TO_IDR == null && ratesOverride.USD_TO_IDR == null)) && order.branch_id) {
      const rules = await getRulesForBranch(order.branch_id);
      const cr = rules.currency_rates;
      const crObj = typeof cr === 'object' && cr != null ? cr : (typeof cr === 'string' ? (() => { try { return JSON.parse(cr); } catch (e) { return null; } })() : null);
      if (crObj && (typeof crObj.SAR_TO_IDR === 'number' || typeof crObj.USD_TO_IDR === 'number')) {
        ratesOverride = {
          SAR_TO_IDR: typeof crObj.SAR_TO_IDR === 'number' ? crObj.SAR_TO_IDR : null,
          USD_TO_IDR: typeof crObj.USD_TO_IDR === 'number' ? crObj.USD_TO_IDR : null
        };
      }
    }
    const payload = (ratesOverride && (ratesOverride.SAR_TO_IDR != null || ratesOverride.USD_TO_IDR != null))
      ? { currency_rates_override: ratesOverride }
      : { currency_rates_override: null };
    await order.update(payload);
  }
  if (items && Array.isArray(items)) {
    const hasHotel = items.some(i => i.type === ORDER_ITEM_TYPE.HOTEL);
    const visaNeedsHotel = await visaRequiresHotel(items);
    if (visaNeedsHotel && !hasHotel) {
      return res.status(400).json({ success: false, message: 'Visa wajib bersama hotel' });
    }
    const busProductIdsUpdate = [...new Set(items.filter((i) => i.type === ORDER_ITEM_TYPE.BUS).map((i) => i.product_id).filter(Boolean))];
    if (busProductIdsUpdate.length > 0) {
      const busProductsUpdate = await Product.findAll({ where: { id: busProductIdsUpdate }, attributes: ['id', 'meta'], raw: true });
      for (const p of busProductsUpdate) {
        const meta = typeof p.meta === 'string' ? (() => { try { return JSON.parse(p.meta); } catch (e) { return {}; } })() : (p.meta || {});
        if (meta.bus_kind !== 'hiace') {
          return res.status(400).json({ success: false, message: 'Hanya bus Hiace yang dapat dipesan. Bus besar sudah include dengan visa.' });
        }
      }
    }

    const totalsBefore = {
      subtotal: parseFloat(order.subtotal) || 0,
      penalty_amount: parseFloat(order.penalty_amount) || 0,
      total_amount: parseFloat(order.total_amount) || 0
    };
    const beforeItemsRaw = (order.OrderItems || []).map((oi) => ({
      type: oi.type,
      product_ref_id: oi.product_ref_id,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      meta: oi.meta
    }));
    const beforeMap = groupForDiff(beforeItemsRaw);
    const afterItemsRaw = [];

    let ratesForUpdate = null;
    const ov = order.currency_rates_override && typeof order.currency_rates_override === 'object' ? order.currency_rates_override : null;
    if (ov && (ov.SAR_TO_IDR != null || ov.USD_TO_IDR != null)) {
      ratesForUpdate = { SAR_TO_IDR: ov.SAR_TO_IDR ?? 4200, USD_TO_IDR: ov.USD_TO_IDR ?? 15500 };
    }
    if (!ratesForUpdate && order.branch_id) {
      const rulesUp = await getRulesForBranch(order.branch_id);
      const cr = rulesUp.currency_rates;
      const crObj = typeof cr === 'object' && cr != null ? cr : (typeof cr === 'string' ? (() => { try { return JSON.parse(cr); } catch (e) { return null; } })() : null);
      if (crObj && (typeof crObj.SAR_TO_IDR === 'number' || typeof crObj.USD_TO_IDR === 'number')) {
        ratesForUpdate = { SAR_TO_IDR: crObj.SAR_TO_IDR ?? 4200, USD_TO_IDR: crObj.USD_TO_IDR ?? 15500 };
      }
    }
    if (!ratesForUpdate) ratesForUpdate = { SAR_TO_IDR: 4200, USD_TO_IDR: 15500 };

    await OrderItem.destroy({ where: { order_id: order.id } });
    let subtotal = 0, totalJamaah = 0;
    for (const it of items) {
      if (it.type === ORDER_ITEM_TYPE.PACKAGE && it.product_id) {
        await assertPackageIsInValidityWindow(it.product_id, new Date().toISOString().slice(0, 10));
      }
      if (it.type === ORDER_ITEM_TYPE.TICKET) {
        const bandara = it.meta?.bandara;
        if (!bandara || !BANDARA_TIKET_CODES.includes(bandara)) {
          return res.status(400).json({ success: false, message: 'Item tiket wajib pilih bandara (BTH, CGK, SBY, atau UPG)' });
        }
        if (it.meta?.trip_type && !TICKET_TRIP_TYPES.includes(it.meta.trip_type)) {
          return res.status(400).json({ success: false, message: 'trip_type tiket harus one_way, return_only, atau round_trip' });
        }
        const tripType = it.meta?.trip_type || 'round_trip';
        if (tripType === 'round_trip' && (!it.meta?.departure_date || !it.meta?.return_date)) {
          return res.status(400).json({ success: false, message: 'Tiket pulang pergi wajib isi tanggal keberangkatan dan tanggal kepulangan' });
        }
        if (tripType === 'one_way' && !it.meta?.departure_date) {
          return res.status(400).json({ success: false, message: 'Tiket pergi saja wajib isi tanggal keberangkatan' });
        }
        if (tripType === 'return_only' && !it.meta?.return_date) {
          return res.status(400).json({ success: false, message: 'Tiket pulang saja wajib isi tanggal kepulangan' });
        }
      }
      if (it.type === ORDER_ITEM_TYPE.BUS) {
        if (it.meta?.trip_type && !BUS_TRIP_TYPES.includes(it.meta.trip_type)) {
          return res.status(400).json({ success: false, message: 'Trip type bus harus one_way, return_only, atau round_trip (pulang pergi)' });
        }
      }
      const qty = parseInt(it.quantity, 10) || 1;
      const itemCurrency = (it.currency && ['IDR', 'SAR', 'USD'].includes(String(it.currency).toUpperCase())) ? String(it.currency).toUpperCase() : 'IDR';
      const checkIn = it.check_in || it.meta?.check_in;
      const checkOut = it.check_out || it.meta?.check_out;
      let unitPrice = parseFloat(it.unit_price);
      if (unitPrice == null || isNaN(unitPrice) || unitPrice < 0) {
        if (it.type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) {
          unitPrice = 0;
        } else {
          unitPrice = await getEffectivePrice(it.product_id, order.branch_id, order.owner_id, it.meta || {}, itemCurrency) || 0;
        }
      }
      let unitPriceIdr = unitPriceToIdr(unitPrice || 0, itemCurrency, ratesForUpdate);
      if (it.type === ORDER_ITEM_TYPE.HOTEL && it.product_id && it.room_type) {
        if (checkIn && checkOut) {
          const avail = await checkAvailability(it.product_id, it.room_type, checkIn, checkOut, qty, order.id);
          if (!avail.ok) return res.status(400).json({ success: false, message: avail.message || 'Kamar tidak tersedia untuk tanggal yang dipilih' });
        }
      }
      // Hotel & makan: hitung dari jumlah malam (check-in s/d check-out). Subtotal dalam IDR.
      let st;
      let monthlyBreakdown = null;
      let usedMonthlyPricing = false;
      let monthlyPricing = null;
      if (it.type === ORDER_ITEM_TYPE.HOTEL) {
        try {
          monthlyPricing = await resolveHotelMonthlyPricing({
            item: it,
            productId: it.product_id,
            branchId: order.branch_id,
            ownerId: order.owner_id,
            qty,
            itemCurrency,
            unitPrice,
            rates: ratesForUpdate
          });
        } catch (e) {
          if (e && e.code === 'VALIDATION') {
            return res.status(400).json({ success: false, message: e.message });
          }
          throw e;
        }
        st = monthlyPricing.subtotal;
        unitPrice = monthlyPricing.unitPrice;
        unitPriceIdr = monthlyPricing.unitPriceIdr;
        monthlyBreakdown = monthlyPricing.monthlyBreakdown;
        usedMonthlyPricing = monthlyPricing.usedMonthlyPricing;
      } else {
        st = qty * unitPriceIdr;
      }
      subtotal += st;
      if (it.type === ORDER_ITEM_TYPE.HOTEL && it.room_type && ROOM_CAPACITY[it.room_type] != null) {
        totalJamaah += qty * ROOM_CAPACITY[it.room_type];
      }
      if (it.type === ORDER_ITEM_TYPE.BUS) {
        totalJamaah += qty;
      }
      const meta = { room_type: it.room_type, meal: it.meal, ...(it.meta || {}) };
      if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.check_in || it.meta?.check_in)) meta.check_in = it.check_in || it.meta.check_in;
      if (it.type === ORDER_ITEM_TYPE.HOTEL && (it.check_out || it.meta?.check_out)) meta.check_out = it.check_out || it.meta.check_out;
      if (it.type === ORDER_ITEM_TYPE.HOTEL && checkIn && checkOut) {
        const nights = getNights(checkIn, checkOut);
        if (nights > 0) meta.nights = nights;
      }
      if (it.type === ORDER_ITEM_TYPE.HOTEL && usedMonthlyPricing && Array.isArray(monthlyBreakdown)) {
        meta.monthly_price_breakdown = monthlyBreakdown;
      }
      if (it.type === ORDER_ITEM_TYPE.HOTEL && usedMonthlyPricing && monthlyPricing && monthlyPricing.room_unit_per_night_in_currency != null) {
        meta.room_unit_price = monthlyPricing.room_unit_per_night_in_currency;
        meta.meal_unit_price = monthlyPricing.meal_unit_per_person_per_night_in_currency != null
          ? monthlyPricing.meal_unit_per_person_per_night_in_currency
          : 0;
      } else {
        if (it.type === ORDER_ITEM_TYPE.HOTEL && it.meta?.room_unit_price != null) meta.room_unit_price = it.meta.room_unit_price;
        if (it.type === ORDER_ITEM_TYPE.HOTEL && it.meta?.meal_unit_price != null) meta.meal_unit_price = it.meta.meal_unit_price;
      }
      if (it.type === ORDER_ITEM_TYPE.BUS && !meta.trip_type) meta.trip_type = 'round_trip';
      afterItemsRaw.push({
        type: it.type,
        product_id: it.product_id,
        quantity: qty,
        unit_price: unitPrice || 0,
        currency: itemCurrency,
        meta
      });
      const itemRates = hasDpPayment && it.currency_rates_override && typeof it.currency_rates_override === 'object'
        ? {
            SAR_TO_IDR: typeof it.currency_rates_override.SAR_TO_IDR === 'number' ? it.currency_rates_override.SAR_TO_IDR : null,
            USD_TO_IDR: typeof it.currency_rates_override.USD_TO_IDR === 'number' ? it.currency_rates_override.USD_TO_IDR : null
          }
        : null;
      const itemRatesPayload = (itemRates && (itemRates.SAR_TO_IDR != null || itemRates.USD_TO_IDR != null)) ? { currency_rates_override: itemRates } : {};
      await OrderItem.create({
        order_id: order.id,
        type: it.type,
        product_ref_id: it.product_id,
        product_ref_type: it.product_ref_type || 'product',
        quantity: qty,
        unit_price: unitPrice || 0,
        unit_price_currency: itemCurrency,
        subtotal: st,
        manifest_file_url: it.manifest_file_url || null,
        meta,
        ...itemRatesPayload
      });
    }
    // Penalti bus: jika waive = pakai 1 Hiace (tambah item otomatis), tampil di progress bus; jika tidak waive = penalti per pack shortfall.
    const waiveBusPenaltyUpdate = (waive_bus_penalty === true || waive_bus_penalty === 'true');
    let penaltyAmountUpdate;
    if (waiveBusPenaltyUpdate && !items.some((i) => i.type === ORDER_ITEM_TYPE.BUS)) {
      const hiaceUpdate = await getFirstHiaceProductAndPrice(order.branch_id, order.owner_id);
      if (hiaceUpdate) {
        const hiaceMeta = { trip_type: 'round_trip', auto_hiace_waive: true };
        await OrderItem.create({
          order_id: order.id,
          type: ORDER_ITEM_TYPE.BUS,
          product_ref_id: hiaceUpdate.productId,
          product_ref_type: 'product',
          quantity: 1,
          unit_price: hiaceUpdate.unitPrice,
          unit_price_currency: hiaceUpdate.currency,
          subtotal: hiaceUpdate.unitPriceIdr,
          meta: hiaceMeta
        });
        subtotal += hiaceUpdate.unitPriceIdr;
        totalJamaah += 1;
      }
      penaltyAmountUpdate = 0;
    } else {
      const hasVisaItemsUpdate = items.some((i) => i.type === ORDER_ITEM_TYPE.VISA);
      const totalVisaPacksUpdate = items.filter((i) => i.type === ORDER_ITEM_TYPE.VISA).reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0);
      const rulesUpdate = await getRulesForBranch(order.branch_id);
      const minPackUpdate = parseInt(rulesUpdate.bus_min_pack, 10) || BUSINESS_RULES.BUS_MIN_PACK || 35;
      const penaltyPerPackIdrUpdate = parseFloat(rulesUpdate.bus_penalty_idr) || 500000;
      const shortfallUpdate = hasVisaItemsUpdate && totalVisaPacksUpdate < minPackUpdate ? minPackUpdate - totalVisaPacksUpdate : 0;
      penaltyAmountUpdate = shortfallUpdate > 0 ? shortfallUpdate * penaltyPerPackIdrUpdate : 0;
    }
    await order.update({
      subtotal,
      total_jamaah: totalJamaah,
      penalty_amount: penaltyAmountUpdate,
      total_amount: subtotal + penaltyAmountUpdate,
      waive_bus_penalty: !!waiveBusPenaltyUpdate
    });
    const orderReloaded = await Order.findByPk(order.id, { attributes: ['id', 'total_amount', 'subtotal', 'penalty_amount'] });

    // Simpan revisi (diff) untuk audit perubahan order
    const afterMap = groupForDiff(afterItemsRaw.map((x) => ({ ...x, product_ref_id: x.product_id })));
    const diff = diffGrouped(beforeMap, afterMap);
    const hasChanges = (diff.added?.length || 0) + (diff.removed?.length || 0) + (diff.updated?.length || 0) > 0;

    let revision = null;
    const inv = await Invoice.findOne({ where: { order_id: order.id } });
    if (hasChanges) {
      const maxNo = await OrderRevision.max('revision_no', { where: { order_id: order.id } });
      const revisionNo = (Number.isFinite(maxNo) ? Number(maxNo) : 0) + 1;

      const productIds = [...new Set([
        ...Array.from(beforeMap.values()).map((v) => v.product_ref_id).filter(Boolean),
        ...Array.from(afterMap.values()).map((v) => v.product_ref_id).filter(Boolean)
      ])];
      const productRows = productIds.length ? await Product.findAll({ where: { id: productIds }, attributes: ['id', 'name'], raw: true }) : [];
      const productNameMap = new Map(productRows.map((p) => [p.id, p.name]));
      const attachNames = (obj) => {
        if (!obj) return obj;
        const pid = obj.product_ref_id;
        return { ...obj, product_name: productNameMap.get(pid) || null };
      };
      const diffWithNames = {
        added: (diff.added || []).map((x) => ({ ...x, after: attachNames(x.after) })),
        removed: (diff.removed || []).map((x) => ({ ...x, before: attachNames(x.before) })),
        updated: (diff.updated || []).map((x) => ({ ...x, before: attachNames(x.before), after: attachNames(x.after) }))
      };

      revision = await OrderRevision.create({
        order_id: order.id,
        invoice_id: inv ? inv.id : null,
        revision_no: revisionNo,
        changed_at: new Date(),
        changed_by: req.user.id,
        diff: diffWithNames,
        totals_before: totalsBefore,
        totals_after: { subtotal, penalty_amount: penaltyAmountUpdate, total_amount: subtotal + penaltyAmountUpdate }
      });
    }

    // Sinkronkan invoice & tandai “DP + Update Invoice” jika sudah ada pembayaran
    const paid = inv ? (parseFloat(inv.paid_amount) || 0) : 0;
    const shouldMarkUpdated = inv && paid > 0;
    await syncInvoiceFromOrder(orderReloaded || order, {
      changed_by: req.user.id,
      reason: hasChanges ? (shouldMarkUpdated ? 'order_updated_after_payment' : 'sync_from_order') : 'sync_from_order',
      order_updated_at: hasChanges ? new Date() : null,
      last_order_revision_id: revision ? revision.id : null,
      meta: revision ? { revision_id: revision.id, revision_no: revision.revision_no } : null
    });
  }
  if (notes !== undefined) await order.update({ notes });
  const full = await Order.findByPk(req.params.id, {
    include: [{ model: OrderItem, as: 'OrderItems', include: [{ model: Product, as: 'Product', attributes: ['id', 'name', 'code', 'type'], required: false }] }]
  });
  res.json({ success: true, data: full });
});

/**
 * DELETE /api/v1/orders/:id
 * Batalkan order (soft: status = cancelled). Jika ada pembayaran, body wajib: action = 'to_balance' | 'refund' | 'allocate_to_order'.
 * - to_balance: seluruh pembayaran jadi saldo akun (untuk order baru atau alokasi ke tagihan).
 * - refund: permintaan refund; wajib bank_name, account_number. Opsional: refund_amount (default full). Jika partial: remainder_action = 'to_balance' | 'allocate_to_order', remainder_target_invoice_id jika allocate.
 * - allocate_to_order: pindahkan seluruh pembayaran ke invoice lain; wajib target_invoice_id.
 */
const destroy = asyncHandler(async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  const canDelete = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role) || (isOwnerRole(req.user.role) && order.owner_id === req.user.id);
  if (!canDelete) {
    return res.status(403).json({ success: false, message: 'Hanya owner (invoice sendiri) atau tim invoice/admin yang dapat membatalkan order' });
  }
  if (!['draft', 'tentative', 'confirmed', 'processing'].includes(order.status)) {
    return res.status(400).json({ success: false, message: 'Invoice hanya bisa dibatalkan saat draft/tentative/confirmed/processing' });
  }

  const inv = await Invoice.findOne({ where: { order_id: order.id } });
  const paidAmountZero = inv ? parseFloat(inv.paid_amount) || 0 : 0;

  const isStaffCancelRoleEarly = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
  const isOwnerSelfOrderEarly = isOwnerRole(req.user.role) && order.owner_id === req.user.id;
  const ownerSkipTimeServiceRules = ownerInvoiceIsTagihanDpPhase(inv, order);
  if (isOwnerSelfOrderEarly && !isStaffCancelRoleEarly && !ownerSkipTimeServiceRules) {
    if (await ownerCancelBlockedByUpcomingServiceDb(order.id)) {
      return res.status(403).json({
        success: false,
        code: 'OWNER_CANCEL_SERVICE_TOO_SOON',
        message: 'Pembatalan oleh owner tidak tersedia karena tanggal layanan (check-in/keberangkatan) sudah dalam 7 hari. Silakan hubungi tim invoice.'
      });
    }
    if (ownerCancelWindowExpired(order)) {
      return res.status(403).json({
        success: false,
        code: 'OWNER_CANCEL_WINDOW_EXPIRED',
        message: 'Pembatalan oleh owner hanya dalam 7 hari sejak order dibuat. Silakan hubungi tim invoice untuk pembatalan selanjutnya.'
      });
    }
  }

  // Jika masih tagihan DP (belum ada pembayaran): hapus data (delete), bukan sekadar ubah status.
  if (inv && paidAmountZero === 0) {
    const orderItemIds = (await OrderItem.findAll({ where: { order_id: order.id }, attributes: ['id'], raw: true })).map(r => r.id);
    await sequelize.transaction(async (tx) => {
      await PaymentReallocation.destroy({ where: { [Op.or]: [{ source_invoice_id: inv.id }, { target_invoice_id: inv.id }] }, transaction: tx });
      await PaymentProof.destroy({ where: { invoice_id: inv.id }, transaction: tx });
      await InvoiceFile.destroy({ where: { invoice_id: inv.id }, transaction: tx });
      await InvoiceStatusHistory.destroy({ where: { invoice_id: inv.id }, transaction: tx });
      await Refund.update({ invoice_id: null, order_id: null }, { where: { [Op.or]: [{ invoice_id: inv.id }, { order_id: order.id }] }, transaction: tx });
      await OrderRevision.destroy({ where: { order_id: order.id }, transaction: tx });
      if (orderItemIds.length > 0) {
        await HotelProgress.destroy({ where: { order_item_id: { [Op.in]: orderItemIds } }, transaction: tx });
        await VisaProgress.destroy({ where: { order_item_id: { [Op.in]: orderItemIds } }, transaction: tx });
        await TicketProgress.destroy({ where: { order_item_id: { [Op.in]: orderItemIds } }, transaction: tx });
        await BusProgress.destroy({ where: { order_item_id: { [Op.in]: orderItemIds } }, transaction: tx });
      }
      await OrderItem.destroy({ where: { order_id: order.id }, transaction: tx });
      await Invoice.destroy({ where: { id: inv.id }, transaction: tx });
      await Order.destroy({ where: { id: order.id }, transaction: tx });
    });
    return res.json({ success: true, message: 'Order dan invoice telah dihapus (belum ada pembayaran DP).', data: { deleted: true } });
  }

  if (!inv && String(order.status || '').toLowerCase() === 'draft') {
    const orderItemIdsDraft = (await OrderItem.findAll({ where: { order_id: order.id }, attributes: ['id'], raw: true })).map((r) => r.id);
    await sequelize.transaction(async (tx) => {
      await Refund.update({ order_id: null }, { where: { order_id: order.id }, transaction: tx });
      await OrderRevision.destroy({ where: { order_id: order.id }, transaction: tx });
      if (orderItemIdsDraft.length > 0) {
        await HotelProgress.destroy({ where: { order_item_id: { [Op.in]: orderItemIdsDraft } }, transaction: tx });
        await VisaProgress.destroy({ where: { order_item_id: { [Op.in]: orderItemIdsDraft } }, transaction: tx });
        await TicketProgress.destroy({ where: { order_item_id: { [Op.in]: orderItemIdsDraft } }, transaction: tx });
        await BusProgress.destroy({ where: { order_item_id: { [Op.in]: orderItemIdsDraft } }, transaction: tx });
      }
      await OrderItem.destroy({ where: { order_id: order.id }, transaction: tx });
      await Order.destroy({ where: { id: order.id }, transaction: tx });
    });
    return res.json({ success: true, message: 'Order draft telah dihapus.', data: { deleted: true } });
  }

  if (!inv) {
    return res.status(400).json({ success: false, message: 'Order tidak memiliki invoice.' });
  }

  const v = await validatePaidCancelBody(order, inv, req.body);
  if (!v.ok) return res.status(v.status).json({ success: false, message: v.message });

  const isStaffCancel = ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin'].includes(req.user.role);
  const isOwnerSelfCancel = isOwnerRole(req.user.role) && order.owner_id === req.user.id;
  if (isOwnerSelfCancel && !isStaffCancel && isInvoiceFullyPaidForOwnerCancel(inv, v.paidAmount)) {
    return res.status(403).json({
      success: false,
      code: 'CANCEL_REQUIRES_ADMIN_APPROVAL',
      message: 'Invoice sudah lunas. Ajukan pembatalan ke Admin Pusat terlebih dahulu. Setelah disetujui, pembatalan akan diproses otomatis dan Anda akan menerima notifikasi.'
    });
  }

  const { ok: _ok, ...cancelParsed } = v;
  const cancelResult = await executePaidOrderCancellation(order, inv, cancelParsed, {
    auditUserId: req.user.id,
    refundRequestedById: order.owner_id,
    performedById: req.user.id
  });
  res.json({ success: true, message: cancelResult.message, data: cancelResult.data });
});

/**
 * POST /api/v1/orders/:id/send-result
 * Kirim notifikasi hasil order ke owner. Scope: koordinator (order wilayahnya).
 */
const sendOrderResult = asyncHandler(async (req, res) => {
  const { id: orderId } = req.params;
  const { channel } = req.body || {};
  const order = await Order.findByPk(orderId, {
    include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }]
  });
  if (!order) return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });

  const role = req.user.role;
  let allowed = false;
  if (['invoice_koordinator', 'tiket_koordinator', 'visa_koordinator'].includes(role) && req.user.wilayah_id) {
    const branchIds = await getBranchIdsForWilayah(req.user.wilayah_id);
    if (branchIds.includes(order.branch_id)) allowed = true;
  }
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Invoice tidak dalam scope Anda' });
  }

  const notif = await Notification.create({
    user_id: order.owner_id,
    trigger: NOTIFICATION_TRIGGER.ORDER_COMPLETED,
    title: 'Trip selesai',
    message: `Invoice ${order.order_number} telah selesai. Hasil dapat diunduh/dilihat di aplikasi.`,
    data: { order_id: order.id, order_number: order.order_number },
    channel_in_app: true,
    channel_email: channel === 'email' || channel === 'both',
    channel_whatsapp: channel === 'whatsapp' || channel === 'both'
  });
  const sendEmail = channel === 'email' || channel === 'both';
  if (sendEmail && order.User?.email) {
    const { sendOrderResultEmail } = require('../utils/emailService');
    const msg = `Order ${order.order_number} telah selesai. Hasil dapat diunduh/dilihat di aplikasi.`;
    sendOrderResultEmail(order.User.email, order.User.name, order.order_number, msg)
      .then((sent) => {
        if (sent && notif.id) return Notification.update({ email_sent_at: new Date() }, { where: { id: notif.id } });
      })
      .catch((err) => require('../config/logger').error('sendOrderResultEmail failed: ' + (err.message || String(err))));
  }

  res.json({ success: true, message: 'Notifikasi telah dikirim ke owner.', data: { order_id: order.id } });
});

const jamaahDataDir = uploadConfig.getDir(uploadConfig.SUBDIRS.JAMAAH_DATA);
const jamaahStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, jamaahDataDir),
  filename: (req, file, cb) => {
    const { dateTimeForFilename } = uploadConfig;
    const { date, time } = dateTimeForFilename();
    const id6 = (req.params.itemId || '').toString().slice(-6);
    const raw = (path.extname(file.originalname || '').toLowerCase());
    const ext = (raw === '.xlsx' || raw === '.xls') ? raw : (raw === '.zip' ? '.zip' : '.zip');
    cb(null, `JAMAAH_${id6}_${date}_${time}${ext}`);
  }
});
const uploadJamaahFile = multer({ storage: jamaahStorage, limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * POST /api/v1/orders/:orderId/items/:itemId/jamaah-data
 * Owner atau Invoice: upload data jamaah (ZIP / Excel hotel) atau link Google Drive.
 * Untuk item: visa, tiket, hotel, siskopatuh.
 */
const uploadJamaahData = [
  uploadJamaahFile.single('jamaah_file'),
  asyncHandler(async (req, res) => {
    const { orderId, itemId } = req.params;
    const order = await Order.findByPk(orderId, { include: [{ model: OrderItem, as: 'OrderItems' }] });
    if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    const canUpload = (isOwnerRole(req.user.role) && order.owner_id === req.user.id) ||
      ['invoice_koordinator', 'invoice_saudi', 'role_siskopatuh', 'admin_pusat', 'super_admin'].includes(req.user.role);
    if (!canUpload) return res.status(403).json({ success: false, message: 'Hanya owner atau tim invoice/siskopatuh yang dapat mengupload data jamaah' });

    const item = order.OrderItems.find(i => i.id === itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Order item tidak ditemukan' });
    const jamaahAllowed =
      item.type === ORDER_ITEM_TYPE.VISA ||
      item.type === ORDER_ITEM_TYPE.TICKET ||
      item.type === ORDER_ITEM_TYPE.HOTEL ||
      item.type === ORDER_ITEM_TYPE.SISKOPATUH;
    if (!jamaahAllowed) {
      return res.status(400).json({ success: false, message: 'Data jamaah hanya untuk item visa, tiket, hotel, atau siskopatuh' });
    }

    const link = (req.body.jamaah_data_link != null ? String(req.body.jamaah_data_link).trim() : '') || null;
    const hasFile = !!req.file;
    if (!hasFile && !link) return res.status(400).json({ success: false, message: 'Upload file (ZIP / Excel untuk hotel) atau isi link Google Drive' });
    if (hasFile && link) return res.status(400).json({ success: false, message: 'Pilih salah satu: file atau link Google Drive' });

    let jamaahDataType = null;
    let jamaahDataValue = null;
    if (hasFile) {
      const finalName = uploadConfig.jamaahDataFilename(order.order_number, item.id, req.file.originalname);
      const newPath = path.join(jamaahDataDir, finalName);
      try { fs.renameSync(req.file.path, newPath); } catch (e) { /* keep temp name */ }
      jamaahDataType = 'file';
      jamaahDataValue = uploadConfig.toUrlPath(uploadConfig.SUBDIRS.JAMAAH_DATA, finalName);
    } else {
      if (!/^https?:\/\//i.test(link)) return res.status(400).json({ success: false, message: 'Link Google Drive harus berupa URL yang valid' });
      jamaahDataType = 'link';
      jamaahDataValue = link;
    }

    await item.update({
      jamaah_data_type: jamaahDataType,
      jamaah_data_value: jamaahDataValue,
      jamaah_uploaded_at: new Date(),
      jamaah_uploaded_by: req.user.id
    });

    if (item.type === ORDER_ITEM_TYPE.VISA) {
      let prog = await VisaProgress.findOne({ where: { order_item_id: item.id } });
      if (!prog) {
        prog = await VisaProgress.create({
          order_item_id: item.id,
          status: VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED,
          notes: 'Data jamaah diupload oleh owner/invoice',
          updated_by: req.user.id
        });
      } else if (prog.status !== VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED && prog.status !== VISA_PROGRESS_STATUS.SUBMITTED) {
        await prog.update({ status: VISA_PROGRESS_STATUS.DOCUMENT_RECEIVED, updated_by: req.user.id });
      }
    }
    if (item.type === ORDER_ITEM_TYPE.TICKET) {
      let prog = await TicketProgress.findOne({ where: { order_item_id: item.id } });
      if (!prog) {
        prog = await TicketProgress.create({
          order_item_id: item.id,
          status: TICKET_PROGRESS_STATUS.DATA_RECEIVED,
          notes: 'Data jamaah diupload oleh owner/invoice',
          updated_by: req.user.id
        });
      } else if (prog.status === TICKET_PROGRESS_STATUS.PENDING) {
        await prog.update({ status: TICKET_PROGRESS_STATUS.DATA_RECEIVED, updated_by: req.user.id });
      }
    }

    const updated = await OrderItem.findByPk(item.id, {
      include: [
        { model: VisaProgress, as: 'VisaProgress', required: false },
        { model: TicketProgress, as: 'TicketProgress', required: false },
        { model: HotelProgress, as: 'HotelProgress', required: false }
      ]
    });
    res.json({
      success: true,
      data: updated,
      message: 'Data jamaah berhasil disimpan. Divisi terkait dapat mengambil dokumen untuk proses selanjutnya.'
    });
  })
];

/** Resolve URL path (/uploads/jamaah-data/xxx) ke path absolut file */
function resolveJamaahDataPath(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') return null;
  const norm = urlPath.replace(/\\/g, '/').trim().replace(/^\/+/, '');
  const withoutUploads = norm.replace(/^uploads\/?/i, '');
  const dir = uploadConfig.getDir(uploadConfig.SUBDIRS.JAMAAH_DATA);
  const filename = path.basename(withoutUploads.replace(/^jamaah-data\/?/i, ''));
  if (!filename) return null;
  return path.join(dir, filename);
}

const MIME_JAMAAH = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.zip': 'application/zip'
};

/**
 * GET /api/v1/orders/:orderId/items/:itemId/jamaah-file
 * Stream file data jamaah (Excel/ZIP) agar unduh tidak 404.
 */
const getJamaahFile = asyncHandler(async (req, res) => {
  const { orderId, itemId } = req.params;
  const order = await Order.findByPk(orderId, { attributes: ['id', 'owner_id', 'branch_id'], include: [{ model: OrderItem, as: 'OrderItems', where: { id: itemId }, required: true, attributes: ['id', 'jamaah_data_type', 'jamaah_data_value'] }] });
  if (!order || !order.OrderItems || order.OrderItems.length === 0) {
    return res.status(404).json({ success: false, message: 'Order item tidak ditemukan' });
  }
  const item = order.OrderItems[0];
  if ((item.jamaah_data_type || '').toLowerCase() !== 'file' || !item.jamaah_data_value) {
    return res.status(404).json({ success: false, message: 'File data jamaah tidak tersedia' });
  }
  let canAccess =
    (isOwnerRole(req.user.role) && order.owner_id === req.user.id) ||
    ['invoice_koordinator', 'invoice_saudi', 'admin_pusat', 'super_admin', 'visa_koordinator', 'tiket_koordinator', 'role_siskopatuh'].includes(req.user.role);
  if (!canAccess && req.user.role === ROLES.ROLE_HOTEL) {
    const branchIds = await getHotelBranchIds(req.user);
    canAccess = !!(order.branch_id && branchIds.includes(order.branch_id));
  }
  if (!canAccess) return res.status(403).json({ success: false, message: 'Akses ditolak' });

  const filePath = resolveJamaahDataPath(item.jamaah_data_value);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File tidak ada di server' });
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_JAMAAH[ext] || 'application/octet-stream';
  const downloadName = path.basename(filePath);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName.replace(/"/g, '%22')}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(filePath).pipe(res);
});

/**
 * POST /api/v1/orders/:id/cancellation-requests
 * Owner: ajukan pembatalan invoice lunas ke Admin Pusat (payload sama seperti DELETE dengan pembayaran).
 */
const createOrderCancellationRequest = asyncHandler(async (req, res) => {
  if (!isOwnerRole(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Hanya owner yang dapat mengajukan pembatalan lewat fitur ini.' });
  }
  const order = await Order.findByPk(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
  if (order.owner_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Anda hanya dapat mengajukan pembatalan untuk order Anda sendiri.' });
  }
  if (!['draft', 'tentative', 'confirmed', 'processing'].includes(order.status)) {
    return res.status(400).json({ success: false, message: 'Invoice hanya bisa dibatalkan saat draft/tentative/confirmed/processing' });
  }
  if (await ownerCancelBlockedByUpcomingServiceDb(order.id)) {
    return res.status(403).json({
      success: false,
      code: 'OWNER_CANCEL_SERVICE_TOO_SOON',
      message: 'Pengajuan pembatalan tidak tersedia karena tanggal layanan (check-in/keberangkatan) sudah dalam 7 hari. Silakan hubungi tim invoice.'
    });
  }
  if (ownerCancelWindowExpired(order)) {
    return res.status(403).json({
      success: false,
      code: 'OWNER_CANCEL_WINDOW_EXPIRED',
      message: 'Pengajuan pembatalan hanya dalam 7 hari sejak order dibuat. Silakan hubungi tim invoice.'
    });
  }
  const inv = await Invoice.findOne({ where: { order_id: order.id } });
  if (!inv) return res.status(400).json({ success: false, message: 'Order tidak memiliki invoice.' });
  const paidAmount = parseFloat(inv.paid_amount) || 0;
  if (paidAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Untuk order tanpa pembayaran, batalkan langsung dari daftar invoice.' });
  }
  if (!isInvoiceFullyPaidForOwnerCancel(inv, paidAmount)) {
    return res.status(400).json({
      success: false,
      message: 'Pengajuan ke Admin Pusat hanya untuk invoice yang sudah lunas. Untuk pembayaran sebagian, Anda dapat membatalkan langsung.'
    });
  }
  const pending = await OrderCancellationRequest.findOne({ where: { order_id: order.id, status: 'pending' } });
  if (pending) {
    return res.status(409).json({ success: false, message: 'Sudah ada pengajuan pembatalan yang menunggu persetujuan Admin Pusat.' });
  }
  const v = await validatePaidCancelBody(order, inv, req.body);
  if (!v.ok) return res.status(v.status).json({ success: false, message: v.message });

  const ownerNote = req.body && req.body.owner_note ? String(req.body.owner_note).trim() || null : null;
  const payload = {
    action: v.action,
    reason: v.reason,
    bank_name: v.bankName,
    account_number: v.accountNumber,
    account_holder_name: v.accountHolderName,
    refund_amount: v.refundAmount,
    remainder_action: v.remainderAction,
    remainder_target_invoice_id: v.remainderTargetInvoiceId,
    target_invoice_id: v.targetInvoiceId
  };

  const row = await OrderCancellationRequest.create({
    order_id: order.id,
    invoice_id: inv.id,
    owner_id: order.owner_id,
    status: 'pending',
    payload,
    owner_note: ownerNote
  });

  res.status(201).json({
    success: true,
    message: 'Pengajuan pembatalan telah dikirim ke Admin Pusat. Anda akan menerima notifikasi setelah ditinjau.',
    data: row
  });
});

/**
 * GET /api/v1/order-cancellation-requests
 */
const listOrderCancellationRequests = asyncHandler(async (req, res) => {
  const status = req.query.status === 'all' ? undefined : (req.query.status || 'pending');
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20));
  const where = {};
  if (status) where.status = status;

  const { count, rows } = await OrderCancellationRequest.findAndCountAll({
    where,
    include: [
      { model: Order, as: 'Order', attributes: ['id', 'order_number', 'status', 'branch_id'] },
      { model: Invoice, as: 'Invoice', attributes: ['id', 'invoice_number', 'paid_amount', 'total_amount', 'remaining_amount', 'status'] },
      { model: User, as: 'Owner', attributes: ['id', 'name', 'email', 'company_name'] }
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit
  });

  res.json({
    success: true,
    data: rows,
    pagination: { total: count, page, limit, totalPages: Math.max(1, Math.ceil(count / limit)) }
  });
});

/**
 * PATCH /api/v1/order-cancellation-requests/:id
 * body: { decision: 'approve' | 'reject', rejection_reason? }
 */
const reviewOrderCancellationRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { decision, rejection_reason: rejectionReasonRaw } = req.body || {};
  if (decision !== 'approve' && decision !== 'reject') {
    return res.status(400).json({ success: false, message: 'decision wajib: approve atau reject' });
  }
  const reqRow = await OrderCancellationRequest.findByPk(id);
  if (!reqRow) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
  if (reqRow.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Pengajuan ini sudah diproses.' });
  }

  if (decision === 'reject') {
    const reason = rejectionReasonRaw != null ? String(rejectionReasonRaw).trim() || null : null;
    await reqRow.update({
      status: 'rejected',
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      rejection_reason: reason
    });
    await Notification.create({
      user_id: reqRow.owner_id,
      trigger: NOTIFICATION_TRIGGER.CANCEL,
      title: 'Pengajuan pembatalan ditolak',
      message: reason
        ? `Admin menolak pengajuan pembatalan invoice. Alasan: ${reason}`
        : 'Admin menolak pengajuan pembatalan invoice Anda.',
      data: { order_cancellation_request_id: reqRow.id, order_id: reqRow.order_id },
      channel_in_app: true
    });
    return res.json({ success: true, message: 'Pengajuan ditolak.', data: reqRow });
  }

  const order = await Order.findByPk(reqRow.order_id);
  const inv = order ? await Invoice.findOne({ where: { order_id: order.id } }) : null;
  if (!order || !inv) {
    return res.status(400).json({ success: false, message: 'Order atau invoice tidak ditemukan.' });
  }
  if (!['draft', 'tentative', 'confirmed', 'processing'].includes(order.status)) {
    await reqRow.update({
      status: 'rejected',
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      rejection_reason: 'Status order sudah berubah; tidak dapat membatalkan.'
    });
    return res.status(409).json({ success: false, message: 'Status order sudah berubah. Pengajuan ditandai ditolak otomatis.' });
  }

  const v = await validatePaidCancelBody(order, inv, reqRow.payload || {});
  if (!v.ok) {
    await reqRow.update({
      status: 'rejected',
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      rejection_reason: v.message
    });
    return res.status(409).json({ success: false, message: `Validasi gagal: ${v.message}. Pengajuan ditolak otomatis.` });
  }

  const { ok: _ok, ...cancelParsed } = v;
  const cancelResult = await executePaidOrderCancellation(order, inv, cancelParsed, {
    auditUserId: req.user.id,
    refundRequestedById: order.owner_id,
    performedById: req.user.id
  });

  await reqRow.update({
    status: 'completed',
    reviewed_by: req.user.id,
    reviewed_at: new Date(),
    rejection_reason: null
  });

  await Notification.create({
    user_id: reqRow.owner_id,
    trigger: NOTIFICATION_TRIGGER.CANCEL,
    title: 'Pembatalan invoice disetujui',
    message: `Admin menyetujui pembatalan untuk order ${order.order_number}. ${cancelResult.message}`,
    data: { order_cancellation_request_id: reqRow.id, order_id: order.id },
    channel_in_app: true
  });

  res.json({ success: true, message: cancelResult.message, data: { request: reqRow, ...cancelResult.data } });
});

module.exports = {
  list,
  create,
  getById,
  update,
  destroy,
  sendOrderResult,
  uploadJamaahData,
  getJamaahFile,
  createOrderAndInvoiceFromItemsForOwner,
  createOrderCancellationRequest,
  listOrderCancellationRequests,
  reviewOrderCancellationRequest
};
