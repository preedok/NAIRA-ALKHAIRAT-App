import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Send, Loader2, Sparkles, ShoppingCart, ArrowRight, Bot, User } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import type { OrderDraftItemInput } from '../../../contexts/OrderDraftContext';
import { aiChatApi, type AiChatOrderDraftItem } from '../../../services/api';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import PageHeader from '../../../components/common/PageHeader';
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
      <div className="p-4">
        <p className="text-stone-600">Halaman ini hanya untuk role Owner.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Asisten AI"
        subtitle="Jawab pertanyaan dari data Anda, nego harga dengan pintar, lalu isi form order otomatis setelah sama-sama sepakat."
      />

      {contextLoading && (
        <div className="flex justify-center py-4">
          <ContentLoading minHeight={80} />
        </div>
      )}

      <Card className="overflow-hidden border-2 border-primary-100 bg-gradient-to-b from-white to-primary-50/30">
        <div className="px-4 py-3 border-b border-stone-200 bg-white/80 flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900">Bintang Global AI</h3>
            <p className="text-xs text-stone-500">Berdasarkan data database: produk, invoice, order. Nego harga → daftar pesanan → isi form order otomatis.</p>
          </div>
        </div>

        <div className="min-h-[320px] max-h-[50vh] overflow-y-auto p-4 space-y-4 bg-stone-50/50">
          {messages.length === 0 && !loading && (
            <div className="text-center py-6">
              <Bot className="w-12 h-12 mx-auto mb-3 text-primary-500" />
              <p className="font-semibold text-stone-800">Mulai percakapan</p>
              <p className="text-sm text-stone-600 mt-1 max-w-md mx-auto">Tanyakan produk, harga, atau minta penawaran. Setelah sepakat harga, beri daftar pesanan—AI akan mengisi form order untuk Anda.</p>
              <p className="text-xs text-stone-500 mt-3 mb-3">Contoh pertanyaan:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Tampilkan daftar produk hotel dan harganya',
                  'Saya butuh penawaran visa 10 orang',
                  'Berapa harga tiket CGK round trip?',
                  'Penawaran hotel Mekkah 4 malam paket makan',
                  'Buatkan draft: 2 kamar quad + visa 10 orang'
                ].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setInput(label)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-stone-300 text-stone-700 hover:bg-primary-50 hover:border-primary-300 transition-colors"
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
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-600" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  m.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white border border-stone-200 text-stone-800 shadow-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-stone-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-stone-600" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-600" />
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
                <span className="text-sm text-stone-500">AI sedang menjawab...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.some((m) => m.role === 'assistant' && m.content.trim() === AI_NOT_CONFIGURED_MSG) && (
          <div className="px-4 py-3 border-t border-amber-200 bg-amber-50">
            <p className="text-sm font-medium text-amber-900 mb-1">Asisten AI belum aktif</p>
            <p className="text-xs text-amber-800 mb-3">Admin server perlu menambahkan <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> di <code className="bg-amber-100 px-1 rounded">backend/.env</code> pada VPS, lalu restart backend. Dapatkan API key di platform.openai.com.</p>
            <Button variant="outline" size="sm" className="gap-2 border-amber-400 text-amber-800 hover:bg-amber-100" onClick={() => navigate('/dashboard/orders/new')}>
              <ShoppingCart className="w-4 h-4" />
              Buat order manual dari form
            </Button>
          </div>
        )}

        {lastOrderDraft?.items && lastOrderDraft.items.length > 0 && (
          <div className="px-4 py-3 border-t border-stone-200 bg-emerald-50/80">
            <p className="text-sm font-medium text-stone-800 mb-2">Draft order siap diisi ke form</p>
            <ul className="text-xs text-stone-600 space-y-1 mb-3">
              {lastOrderDraft.items.slice(0, 5).map((it, j) => (
                <li key={j}>
                  {it.product_name} × {it.quantity} — <span className="font-medium">{Number(it.unit_price_idr || 0).toLocaleString('id-ID')} IDR</span>
                </li>
              ))}
              {(lastOrderDraft.items.length > 5) && <li>+ {lastOrderDraft.items.length - 5} item lagi</li>}
            </ul>
            <Button variant="primary" size="sm" className="gap-2" onClick={handleApplyToOrder}>
              <ShoppingCart className="w-4 h-4" />
              Isi ke Form Order
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        <div className="p-4 border-t border-stone-200 bg-white">
          <div className="flex gap-2">
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
              placeholder="Ketik pertanyaan atau daftar pesanan..."
              className="flex-1 min-h-[44px] max-h-32 px-4 py-3 rounded-xl border border-stone-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none text-sm"
              rows={2}
              disabled={loading}
            />
            <Button
              type="button"
              variant="primary"
              className="shrink-0 h-[44px] px-4"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OwnerAIChatPage;
