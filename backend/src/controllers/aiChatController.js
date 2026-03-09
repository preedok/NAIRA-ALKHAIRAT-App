const asyncHandler = require('express-async-handler');
const {
  buildContextForOwner,
  buildSystemPrompt,
  callChat
} = require('../services/aiChatService');

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

  const { contextText, branchId } = await buildContextForOwner(ownerId);
  const systemPrompt = buildSystemPrompt(contextText);

  const messages = (Array.isArray(history) ? history : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content }));
  messages.push({ role: 'user', content: userMessage });

  const { reply, order_draft } = await callChat(messages, systemPrompt);

  res.json({
    success: true,
    reply,
    order_draft: order_draft || undefined
  });
});

module.exports = {
  getContext,
  chat
};
