import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import Modal from '../../components/common/Modal';

const COLORS = {
  accent: '#C9A04B',
  dark: '#18181b',
};

export const ProductCatalogPopup: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const promoData = {
    title: 'Umroh Ramadhan Premium 1446H',
    price: '42.5',
    img: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=1974&auto=format&fit=crop',
    tag: 'Limited Slot',
    hotel: 'Bintang 5 (Front Row)',
    date: 'Keberangkatan: Maret 2025'
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Modal open={isOpen} onClose={() => setIsOpen(false)}>
      {/* Container utama: Lebar disesuaikan untuk mobile (w-[92%]) dan desktop (max-w-lg) */}
      <div className="relative w-[92%] sm:w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[30px] md:rounded-[40px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-500 text-white mx-auto">
        
        {/* Tombol Close - Ukuran disesuaikan untuk touch area mobile */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 md:top-6 md:right-6 z-30 w-9 h-9 md:w-10 md:h-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center hover:bg-[#C9A04B] hover:text-black transition-all"
        >
          <X size={18} />
        </button>

        {/* Bagian Gambar Produk - Tinggi lebih pendek di mobile */}
        <div className="relative h-48 md:h-72 overflow-hidden">
          <img 
            src={promoData.img} 
            alt={promoData.title} 
            className="w-full h-full object-cover transition-transform duration-1000 hover:scale-110" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
          
          <div className="absolute top-4 left-4 md:top-6 md:left-6 bg-[#C9A04B] text-black px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg">
            <Sparkles size={10} className="md:w-3 md:h-3" />
            {promoData.tag}
          </div>
        </div>

        {/* Bagian Konten */}
        <div className="p-6 md:p-10 -mt-8 md:-mt-10 relative z-10">
          <div className="flex items-center gap-2 mb-3 md:mb-4 text-[10px] md:text-xs font-bold uppercase tracking-[0.15em]" style={{ color: COLORS.accent }}>
            <Calendar size={14} /> {promoData.date}
          </div>
          
          <h3 className="text-xl md:text-3xl font-bold mb-4 md:mb-6 tracking-tight leading-tight">
            {promoData.title}
          </h3>

          {/* List Fitur - Jarak lebih rapat di mobile */}
          <div className="flex flex-col gap-3 md:gap-4 mb-8 md:mb-10">
            <div className="flex items-start gap-3 text-zinc-400 text-xs md:text-sm leading-snug">
              <div className="w-5 h-5 md:w-6 md:h-6 shrink-0 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <CheckCircle size={12} className="md:w-3.5 md:h-3.5" style={{ color: COLORS.accent }} />
              </div>
              Pesawat Direct Saudi Arabian Airlines
            </div>
            <div className="flex items-start gap-3 text-zinc-400 text-xs md:text-sm leading-snug">
              <div className="w-5 h-5 md:w-6 md:h-6 shrink-0 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <CheckCircle size={12} className="md:w-3.5 md:h-3.5" style={{ color: COLORS.accent }} />
              </div>
              Hotel {promoData.hotel}
            </div>
          </div>

          {/* Footer & Price - Stack vertical di layar sangat kecil, horizontal di tablet/desktop */}
          <div className="flex flex-row items-center justify-between pt-6 md:pt-8 border-t border-white/5 gap-4">
            <div className="shrink-0">
              <div className="text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-0.5 md:mb-1">Mulai Dari</div>
              <div className="text-2xl md:text-4xl font-black tracking-tighter">
                Rp {promoData.price}<span className="text-sm md:text-xl font-bold text-zinc-500 ml-0.5">jt</span>
              </div>
            </div>
            
            <button 
              onClick={() => window.location.href = '/catalog'}
              className="group flex items-center gap-2 md:gap-3 bg-[#C9A04B] hover:bg-white text-black px-4 py-3 md:px-6 md:py-4 rounded-full text-sm md:text-base font-bold transition-all duration-300 shadow-xl shadow-[#C9A04B]/10 active:scale-95"
            >
              <span className="hidden xs:inline">Lihat Detail</span>
              <span className="xs:hidden">Detail</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        {/* Dekorasi Aksen Emas Bawah */}
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#C9A04B] to-transparent opacity-50" />
      </div>
    </Modal>
  );
};

export default ProductCatalogPopup;