const asyncHandler = require('express-async-handler');
const {
  buildContextForOwner,
  buildSystemPrompt,
  callChat,
  validateOrderDraftAgainstDb,
  extractOrderFromConversation
} = require('../services/aiChatService');
const { createOrderAndInvoiceFromItemsForOwner } = require('./orderController');

/**
 * GET /api/v1/ai-chat/context
 * Mengembalikan ringkasan konteks untuk owner (produk, kurs) - opsional untuk tampilan di FE.
 */
const getContext = asyncHandler(async (req, res) => {
  const ownerId = req.user.id;
  const { contextText, productSummaries, sarToIdr, usdToIdr, branchId } = await buildContextForOwner(ownerId);
  res.json({
    success: true,
    data: {
      rates: { SAR_TO_IDR: sarToIdr, USD_TO_IDR: usdToIdr },
      branch_id: branchId,
      product_count: productSummaries.length,
      product_preview: productSummaries.slice(0, 20).map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        code: p.code,
        price_idr: p.price_idr,
        price_sar: p.price_sar,
        price_usd: p.price_usd
      }))
    }
  });
});

/**
 * POST /api/v1/ai-chat
 * Body: { message: string, history?: Array<{ role: 'user'|'assistant', content: string }> }
 * Mengembalikan: { success, reply, order_draft?: { items: [...] } }
 */
const chat = asyncHandler(async (req, res) => {
  const ownerId = req.user.id;
  const { message, history = [] } = req.body || {};
  const userMessage = typeof message === 'string' ? message.trim() : '';
  if (!userMessage) {
    return res.status(400).json({ success: false, message: 'Pesan wajib diisi' });
  }

  const { contextText, productSummaries, branchId } = await buildContextForOwner(ownerId);
  const systemPrompt = buildSystemPrompt(contextText);

  const messages = (Array.isArray(history) ? history : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content }));
  messages.push({ role: 'user', content: userMessage });

  const { reply } = await callChat(messages, systemPrompt);

  let createdInvoice = null;
  const isCreateInvoiceRequest = /buatkan\s*(invoice|invocenya|invice|order)?|buat\s*(invoice|order)|create\s*invoice|setuju\s*(buatkan)?|invoice\s*nya|proses\s*invoice|buatkan\s*order|buat\s*orderannya/i.test(userMessage.trim());
  if (isCreateInvoiceRequest && branchId) {
    let extracted = await extractOrderFromConversation(messages, contextText);
    if (!extracted?.items?.length && messages.length > 1) {
      extracted = await extractOrderFromConversation(messages, contextText);
    }
    const sanitizedDraft = extracted ? validateOrderDraftAgainstDb(extracted, productSummaries) : null;
    if (sanitizedDraft && sanitizedDraft.items && sanitizedDraft.items.length > 0) {
      const itemsForCreate = sanitizedDraft.items.map((it) => ({
        type: it.type,
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price_idr,
        currency: 'IDR',
        meta: it.meta || {},
        check_in: it.meta?.check_in,
        check_out: it.meta?.check_out,
        room_type: it.meta?.room_type,
        meal: it.meta?.with_meal ?? it.meta?.meal
      }));
      try {
        const { order, invoice } = await createOrderAndInvoiceFromItemsForOwner({
          ownerId,
          branchId,
          items: itemsForCreate,
          createdByUserId: req.user.id
        });
        if (invoice) {
          createdInvoice = { id: invoice.id, invoice_number: invoice.invoice_number };
        }
      } catch (err) {
        console.error('AI chat create order/invoice failed:', err?.message || err);
      }
    }
    if (!createdInvoice) {
      if (!extracted?.items?.length) {
        console.warn('AI chat: extractOrderFromConversation returned no items');
      } else if (!sanitizedDraft?.items?.length) {
        console.warn('AI chat: validateOrderDraftAgainstDb rejected all items');
      }
    }
  }

  let finalReply = reply;
  if (isCreateInvoiceRequest && !createdInvoice && branchId) {
    finalReply = 'Maaf, invoice belum bisa dibuat dari obrolan ini. Pastikan Anda sudah menyebutkan: nama produk, jumlah/kamar, dan tanggal (check-in/check-out untuk hotel). Silakan tulis ulang ringkasan pesanan lalu kirim lagi "buatkan invoice".';
  }

  res.json({
    success: true,
    reply: finalReply,
    ...(createdInvoice && { created_invoice: createdInvoice })
  });
});

module.exports = {
  getContext,
  chat
};
