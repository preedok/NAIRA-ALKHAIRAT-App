import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrderDraft } from '../../../contexts/OrderDraftContext';
import type { OrderDraftItemInput } from '../../../contexts/OrderDraftContext';
import { aiChatApi, type AiChatOrderDraftItem } from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** Map item draft dari AI ke OrderDraftItemInput untuk form order */
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
    meta: Object.keys(meta).length ? (meta as Record<string, unknown>) : undefined,
  };
  if (ai.type === 'hotel' && (meta.room_type != null || meta.with_meal !== undefined)) {
    base.room_breakdown = [{
      room_type: (meta.room_type as string) || 'quad',
      quantity: qty,
      unit_price: roomUnit,
      with_meal: Boolean(meta.with_meal),
    }];
  }
  return base;
}

const suggestedPrompts = [
  { icon: '🏨', label: 'Daftar produk hotel & harga' },
  { icon: '📋', label: 'Penawaran visa 10 orang' },
  { icon: '✈️', label: 'Tiket CGK round trip' },
  { icon: '🕌', label: 'Hotel Mekkah 4 malam + makan' },
  { icon: '📦', label: 'Draft: 2 kamar quad + visa 10' },
];

// ─── Components ─────────────────────────────────────────────────────────
const Avatar = ({ role }: { role: 'user' | 'assistant' }) => (
  <div
    style={{
      width: 36, height: 36, borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      background: role === 'user'
        ? 'linear-gradient(135deg, #10b981, #059669)'
        : 'linear-gradient(135deg, #1e293b, #334155)',
      boxShadow: role === 'user'
        ? '0 4px 12px rgba(16,185,129,0.35)'
        : '0 4px 12px rgba(0,0,0,0.2)',
      fontSize: 15,
    }}
  >
    {role === 'user' ? '👤' : '🤖'}
  </div>
);

const TypingDots = () => (
  <div style={{ display: 'flex', gap: 5, padding: '4px 2px', alignItems: 'center' }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 7, height: 7, borderRadius: '50%',
        background: '#10b981',
        animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
      }} />
    ))}
  </div>
);

const MessageBubble = ({ msg, isNew }: { msg: ChatMessage; isNew: boolean }) => {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 12,
      alignItems: 'flex-end',
      animation: isNew ? 'slideIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
    }}>
      <Avatar role={msg.role} />
      <div style={{
        maxWidth: '72%',
        background: isUser
          ? 'linear-gradient(135deg, #10b981, #059669)'
          : '#ffffff',
        color: isUser ? '#fff' : '#334155',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        padding: '12px 16px',
        fontSize: 14,
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
        boxShadow: isUser
          ? '0 4px 16px rgba(16,185,129,0.3)'
          : '0 1px 3px rgba(0,0,0,0.08)',
        border: isUser ? 'none' : '1px solid #e2e8f0',
        letterSpacing: '0.01em',
      }}>
        {msg.content}
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────
export default function OwnerAIChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const orderDraft = useOrderDraft();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastOrderDraft, setLastOrderDraft] = useState<{ items: AiChatOrderDraftItem[] } | null>(null);
  const [newIdx, setNewIdx] = useState<number | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isOwner = user?.role === 'owner_mou' || user?.role === 'owner_non_mou';

  useEffect(() => {
    if (isOwner) {
      aiChatApi.getContext().then(() => setContextLoading(false)).catch(() => setContextLoading(false));
    } else {
      setContextLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  /** Isi draft ke form order lalu navigate ke Buat invoice baru (orders/new). Saat user klik Simpan di form → invoice terbit di daftar. */
  const applyDraftAndNavigate = (draft: { items: AiChatOrderDraftItem[] }) => {
    const mapped = draft.items.map(mapAiDraftToOrderDraftItem).filter((i) => i.product_id && i.quantity > 0);
    if (mapped.length === 0) {
      showToast('Draft order tidak valid.', 'error');
      return;
    }
    orderDraft.clear();
    orderDraft.setDraftItems(mapped);
    showToast('Draft order telah diisi ke form. Klik Simpan/Order untuk menerbitkan invoice.', 'success');
    navigate('/dashboard/orders/new');
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '48px';
    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setNewIdx(messages.length);
    setLoading(true);
    setLastOrderDraft(null);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await aiChatApi.chat({ message: text, history });
      const data = res.data as { success?: boolean; reply?: string; order_draft?: { items: AiChatOrderDraftItem[] } };
      const reply = data?.reply ?? 'Maaf, tidak ada respons.';
      setMessages((prev) => {
        const next: ChatMessage[] = [...prev, { role: 'assistant', content: reply }];
        setNewIdx(next.length - 1);
        return next;
      });
      if (data?.order_draft?.items?.length) {
        setLastOrderDraft(data.order_draft);
        // Setelah obrolan selesai + dapat order draft → data otomatis masuk ke form dan navigate ke Buat invoice baru
        applyDraftAndNavigate(data.order_draft);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const msg = err?.response?.data?.message || err?.message || 'Gagal mengirim. Periksa koneksi.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const isEmpty = messages.length === 0 && !loading;

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] px-4">
        <p className="text-slate-600">Halaman ini hanya untuk role Owner.</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes bounce {
          0%,80%,100% { transform: translateY(0); opacity:.5 }
          40% { transform: translateY(-6px); opacity:1 }
        }
        @keyframes slideIn {
          from { opacity:0; transform: translateY(10px) scale(0.97) }
          to { opacity:1; transform: translateY(0) scale(1) }
        }
        @keyframes fadeUp {
          from { opacity:0; transform: translateY(16px) }
          to { opacity:1; transform: translateY(0) }
        }
        @keyframes shimmer {
          0%,100% { opacity:.6 }
          50% { opacity:1 }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity:.7 }
          100% { transform: scale(1.6); opacity:0 }
        }
        .chat-page * { box-sizing: border-box; }
        .chat-page { font-family: 'Sora', sans-serif; }
        .prompt-chip:hover {
          background: rgba(16,185,129,0.15) !important;
          border-color: rgba(16,185,129,0.5) !important;
          color: #10b981 !important;
          transform: translateY(-2px);
        }
        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 8px 28px rgba(16,185,129,0.45) !important;
        }
        .send-btn:active:not(:disabled) { transform: scale(0.96); }
        .send-btn:disabled { opacity:.4; cursor:not-allowed; }
        .chat-input:focus { outline:none; border-color:rgba(16,185,129,0.6) !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.12) !important; }
        .msg-area::-webkit-scrollbar { width:6px }
        .msg-area::-webkit-scrollbar-track { background:#f1f5f9 }
        .msg-area::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px }
        .draft-item { transition: background .15s; }
        .draft-item:hover { background: rgba(16,185,129,0.08) !important; }
        .apply-btn:hover { background: linear-gradient(135deg,#059669,#047857) !important; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(16,185,129,0.4) !important; }
      `}</style>

      {/* Wrapper: card dengan jarak, tidak fullscreen */}
      <div
        className="chat-page-wrapper max-w-4xl mx-auto py-4 sm:py-6"
        style={{ minHeight: 520, maxHeight: 'calc(100vh - 6rem)' }}
      >
      <div className="chat-page" style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 480,
        maxHeight: 'calc(100vh - 6rem)',
        background: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
      }}>

        {/* ── HEADER ── */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 20px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
        }}>
          {/* Logo mark */}
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 60%, #0d9488 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
            boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
          }}>
            🤖
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{
                margin: 0, fontSize: 16, fontWeight: 700,
                color: '#0f172a', letterSpacing: '-0.02em',
              }}>Asisten AI</h1>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                color: '#059669',
                textTransform: 'uppercase',
              }}>PRO</span>
            </div>
            <p style={{
              margin: 0, fontSize: 12, color: '#64748b',
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.01em',
            }}>
              Tanya produk · nego · buat order otomatis
            </p>
          </div>

          {/* Status pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 100,
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#10b981',
              animation: 'shimmer 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', letterSpacing: '0.04em' }}>
              AKTIF
            </span>
          </div>
        </div>

        {/* ── MESSAGES ── */}
        <div className="msg-area" style={{
          flex: 1, overflowY: 'auto',
          padding: '24px 20px',
          display: 'flex', flexDirection: 'column', gap: 18,
          position: 'relative', zIndex: 1,
          background: '#fafafa',
        }}>
          {isEmpty && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '20px 16px',
              animation: 'fadeUp .5s ease',
            }}>
              {/* Hero icon */}
              <div style={{
                width: 80, height: 80, borderRadius: 28,
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))',
                border: '1px solid rgba(16,185,129,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, marginBottom: 20,
                boxShadow: '0 4px 20px rgba(16,185,129,0.15)',
              }}>✨</div>

              <h2 style={{
                margin: '0 0 8px', fontSize: 22, fontWeight: 700,
                color: '#0f172a', letterSpacing: '-0.03em',
              }}>Mulai percakapan</h2>
              <p style={{
                margin: '0 0 28px', fontSize: 13, color: '#64748b',
                maxWidth: 320, lineHeight: 1.7,
              }}>
                Tanyakan produk, harga, atau minta penawaran. AI akan mengisi form order secara otomatis.
              </p>

              {/* Divider */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, width: '100%', maxWidth: 400,
              }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Coba tanya
                </span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>

              {/* Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 480 }}>
                {suggestedPrompts.map((p, i) => (
                  <button
                    key={i}
                    className="prompt-chip"
                    onClick={() => { setInput(p.label); inputRef.current?.focus(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 14px', borderRadius: 100,
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      color: '#475569', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', transition: 'all .2s ease',
                      fontFamily: 'Sora, sans-serif',
                      animation: `fadeUp .4s ease ${i * 0.07}s both`,
                    }}
                  >
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} isNew={i === newIdx} />
          ))}

          {loading && (
            <div style={{
              display: 'flex', gap: 12, alignItems: 'flex-end',
              animation: 'slideIn .3s ease',
            }}>
              <Avatar role="assistant" />
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '18px 18px 18px 4px',
                padding: '12px 18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}>
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── DRAFT CTA (jika AI mengembalikan order_draft; biasanya auto-navigate, ini fallback) ── */}
        {lastOrderDraft?.items && lastOrderDraft.items.length > 0 && (
          <div style={{
            position: 'relative', zIndex: 2,
            margin: '0 16px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 0,
            animation: 'fadeUp .4s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📦</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>Draft Order Siap</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, color: '#047857',
                background: 'rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: 100,
              }}>{lastOrderDraft.items.length} item</span>
            </div>

            {lastOrderDraft.items.slice(0, 5).map((item, i) => (
              <div key={i} className="draft-item" style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '5px 8px', borderRadius: 8,
                fontSize: 12, color: '#475569',
              }}>
                <span>{item.product_name} × {item.quantity}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#334155', fontWeight: 500 }}>
                  {((Number(item.unit_price_idr) || 0) * (item.quantity || 1)).toLocaleString('id-ID')} IDR
                </span>
              </div>
            ))}
            {lastOrderDraft.items.length > 5 && (
              <div style={{ fontSize: 11, color: '#64748b', padding: '4px 8px' }}>+ {lastOrderDraft.items.length - 5} item lagi</div>
            )}

            <button
              type="button"
              className="apply-btn"
              onClick={() => applyDraftAndNavigate(lastOrderDraft)}
              style={{
                marginTop: 12, width: '100%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none', borderRadius: 12,
                padding: '11px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', transition: 'all .2s ease',
                fontFamily: 'Sora, sans-serif',
                boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
              }}
            >
              <span>🛒</span>
              Buka Buat invoice baru
              <span style={{ fontSize: 16 }}>→</span>
            </button>
          </div>
        )}

        {/* ── INPUT BAR ── */}
        <div style={{
          position: 'relative', zIndex: 2,
          padding: '16px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
        }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 18,
            padding: '8px 8px 8px 16px',
            transition: 'border-color .2s',
          }}>
            <textarea
              ref={(el) => { inputRef.current = el; textareaRef.current = el; }}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Ketik pesan atau daftar pesanan... (Enter untuk kirim)"
              className="chat-input"
              disabled={loading}
              rows={1}
              style={{
                flex: 1, minHeight: 48, maxHeight: 120,
                background: 'transparent', border: '1px solid transparent',
                resize: 'none', outline: 'none',
                color: '#334155', fontSize: 14,
                fontFamily: 'Sora, sans-serif',
                lineHeight: 1.6,
                caretColor: '#10b981',
                paddingTop: 12,
              }}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                background: input.trim()
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : '#e2e8f0',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, transition: 'all .2s ease',
                boxShadow: input.trim() ? '0 4px 16px rgba(16,185,129,0.35)' : 'none',
              }}
            >
              {loading ? (
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  animation: 'spin 0.7s linear infinite',
                }} />
              ) : '↑'}
            </button>
          </div>
          <p style={{
            margin: '8px 0 0', textAlign: 'center',
            fontSize: 10, color: '#64748b',
            letterSpacing: '0.03em',
          }}>
            Shift+Enter untuk baris baru · AI dapat membuat kesalahan, harap verifikasi
          </p>
        </div>
      </div>
      </div>
    </>
  );
}