import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Loader2, Sparkles, ShoppingCart, ArrowRight, Bot, User, MessageSquare } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import type { OrderDraftItemInput } from '../../../contexts/OrderDraftContext';
import { aiChatApi, type AiChatOrderDraftItem } from '../../../services/api';
import Button from '../../../components/common/Button';
import ContentLoading from '../../../components/common/ContentLoading';
import { useToast } from '../../../contexts/ToastContext';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** Pesan backend ketika OPENAI_API_KEY belum diset di server */
const AI_NOT_CONFIGURED_MSG = 'AI belum dikonfigurasi. Silakan set OPENAI_API_KEY di lingkungan server. Untuk sementara, Anda bisa langsung membuat order dari menu Invoice → Buat Order.';

/** Map AI order_draft item ke OrderDraftItemInput untuk form order (lengkap: meta + room_breakdown dengan room/meal price) */
function mapAiDraftToOrderDraftItem(ai: AiChatOrderDraftItem): OrderDraftItemInput {
  const meta = ai.meta || {};
  const qty = Math.max(1, Number(ai.quantity) || 1);
  const unitIdr = Number(ai.unit_price_idr) || 0;
  const roomUnit = meta.room_unit_price != null ? Number(meta.room_unit_price) : unitIdr;
  const base: OrderDraftItemInput = {
    type: ai.type as OrderDraftItemInput['type'],
    product_id: ai.product_id,
    product_name: ai.product_name,
    quantity: qty,
    unit_price_idr: unitIdr,
    check_in: meta.check_in as string | undefined,
    check_out: meta.check_out as string | undefined,
    meta: Object.keys(meta).length ? meta as Record<string, unknown> : undefined
  };
  if (ai.type === 'hotel' && (meta.room_type != null || meta.with_meal !== undefined)) {
    base.room_breakdown = [{
      room_type: (meta.room_type as string) || 'quad',
      quantity: qty,
      unit_price: roomUnit,
      with_meal: Boolean(meta.with_meal)
    }];
  }
  return base;
}

const OwnerAIChatPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const orderDraft = useOrderDraft();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [lastOrderDraft, setLastOrderDraft] = useState<{ items: AiChatOrderDraftItem[] } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    aiChatApi.getContext().then(() => setContextLoading(false)).catch(() => setContextLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setLastOrderDraft(null);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await aiChatApi.chat({ message: text, history });
      const data = res.data as { success?: boolean; reply?: string; order_draft?: { items: AiChatOrderDraftItem[] } };
      const reply = data?.reply ?? 'Maaf, tidak ada respons.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (data?.order_draft?.items?.length) {
        setLastOrderDraft(data.order_draft);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const msg = err?.response?.data?.message || err?.message || 'Gagal mengirim. Periksa koneksi atau OPENAI_API_KEY di server.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleApplyToOrder = () => {
    if (!lastOrderDraft?.items?.length) return;
    const mapped = lastOrderDraft.items.map(mapAiDraftToOrderDraftItem).filter((i) => i.product_id && i.quantity > 0);
    if (mapped.length === 0) {
      showToast('Draft order tidak valid (product_id atau quantity kosong).', 'error');
      return;
    }
    orderDraft.clear();
    orderDraft.setDraftItems(mapped);
    showToast('Draft order telah diisi ke form. Silakan periksa dan submit.', 'success');
    navigate('/dashboard/orders/new');
  };

  const isOwner = user?.role === 'owner_mou' || user?.role === 'owner_non_mou';
  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] px-4">
        <p className="text-slate-600">Halaman ini hanya untuk role Owner.</p>
      </div>
    );
  }

  const suggestedPrompts = [
    'Tampilkan daftar produk hotel dan harganya',
    'Saya butuh penawaran visa 10 orang',
    'Berapa harga tiket CGK round trip?',
    'Penawaran hotel Mekkah 4 malam paket makan',
    'Buatkan draft: 2 kamar quad + visa 10 orang'
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[820px] min-h-[520px] mx-auto max-w-4xl">
      {contextLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 rounded-2xl z-10">
          <ContentLoading minHeight={80} />
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 py-4 rounded-t-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg">
        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight">Asisten AI</h1>
          <p className="text-sm text-emerald-100 truncate">Tanya produk & harga, nego, lalu isi form order otomatis</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
          Siap
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/70 dark:bg-slate-900/50 rounded-b-2xl border border-slate-200 dark:border-slate-700 border-t-0 shadow-xl">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scroll-smooth">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[280px] text-center px-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 mb-5">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Mulai percakapan</h2>
              <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-sm text-sm leading-relaxed">
                Tanyakan produk, harga, atau minta penawaran. Setelah sepakat, beri daftar pesanan—AI akan mengisi form order untuk Anda.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-4 mb-3 font-medium uppercase tracking-wider">Coba pertanyaan</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedPrompts.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setInput(label)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:shadow-md transition-all duration-200"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                m.role === 'user'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
              }`}>
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[82%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-md'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-bl-md'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center gap-2 min-w-[140px]">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Mengetik...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* AI not configured / quota notice */}
        {messages.some((m) => m.role === 'assistant' && m.content.trim() === AI_NOT_CONFIGURED_MSG) && (
          <div className="flex-shrink-0 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">Asisten AI belum aktif</p>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 mb-3">Tambahkan <code className="bg-amber-200/50 dark:bg-amber-800/50 px-1 rounded">OPENAI_API_KEY</code> di server. Sementara itu:</p>
            <Button variant="outline" size="sm" className="gap-2 border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30" onClick={() => navigate('/dashboard/orders/new')}>
              <ShoppingCart className="w-4 h-4" />
              Buat order manual
            </Button>
          </div>
        )}

        {/* Draft order CTA */}
        {lastOrderDraft?.items && lastOrderDraft.items.length > 0 && (
          <div className="flex-shrink-0 px-4 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-t border-emerald-200 dark:border-emerald-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Draft order siap</p>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 mb-4 max-h-20 overflow-y-auto">
              {lastOrderDraft.items.slice(0, 5).map((it, j) => (
                <li key={j} className="flex justify-between gap-2">
                  <span>{it.product_name} × {it.quantity}</span>
                  <span className="font-medium tabular-nums">{Number(it.unit_price_idr || 0).toLocaleString('id-ID')} IDR</span>
                </li>
              ))}
              {lastOrderDraft.items.length > 5 && (
                <li className="text-slate-500">+ {lastOrderDraft.items.length - 5} item lagi</li>
              )}
            </ul>
            <Button variant="primary" size="sm" className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleApplyToOrder}>
              <ShoppingCart className="w-4 h-4" />
              Isi ke Form Order
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="flex-shrink-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ketik pesan atau daftar pesanan..."
              className="flex-1 min-h-[48px] max-h-32 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none text-sm transition-shadow"
              rows={2}
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 transition-all"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerAIChatPage;
