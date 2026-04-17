import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle, ArrowRight, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '../../components/common/Modal';

const COLORS = {
  accent: '#C9A04B',
  dark: '#18181b',
};

// Data Katalog untuk Carousel
const CATALOG_ITEMS = [
  {
    id: 1,
    title: 'Umroh Ramadhan Premium 1446H',
    price: '42.5',
    img: 'https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=2070&auto=format&fit=crop',
    tag: 'Limited Slot',
    hotel: 'Bintang 5 (Front Row)',
    date: 'Keberangkatan: Maret 2025'
  },
  {
    id: 2,
    title: 'Umroh Plus Turki & Cappadocia',
    price: '38.9',
    img: 'https://images.unsplash.com/photo-1527838832700-5059252407fa?q=80&w=1962&auto=format&fit=crop',
    tag: 'Favorit',
    hotel: 'Bintang 5 Combo',
    date: 'Keberangkatan: Nov 2025'
  },
  {
    id: 3,
    title: 'Haji Dakhili Premium VIP',
    price: '250',
    img: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=1974&auto=format&fit=crop',
    tag: 'VIP Access',
    hotel: 'Masyair VIP Service',
    date: 'Keberangkatan: Zulkaidah 1446H'
  }
];

export const ProductCatalogPopup: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsOpen(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === CATALOG_ITEMS.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? CATALOG_ITEMS.length - 1 : prev - 1));
  };

  const currentData = CATALOG_ITEMS[currentIndex];

  return (
    <Modal open={isOpen} onClose={() => setIsOpen(false)}>
      <div className="relative w-[92%] sm:w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[35px] md:rounded-[40px] overflow-hidden shadow-2xl text-white mx-auto transition-all duration-500">
        
        {/* Navigasi Carousel - Tombol Kiri */}
        <button 
          onClick={prevSlide}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center hover:bg-[#C9A04B] hover:text-black transition-all"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Navigasi Carousel - Tombol Kanan */}
        <button 
          onClick={nextSlide}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center hover:bg-[#C9A04B] hover:text-black transition-all"
        >
          <ChevronRight size={20} />
        </button>

        {/* Tombol Close */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 z-40 w-9 h-9 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center hover:bg-red-500 transition-all"
        >
          <X size={18} />
        </button>

        {/* Slide Content */}
        <div key={currentIndex} className="animate-in fade-in slide-in-from-right-5 duration-500">
          
          {/* Gambar */}
          <div className="relative h-48 md:h-64 overflow-hidden">
            <img 
              src={currentData.img} 
              alt={currentData.title} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
            
            <div className="absolute top-4 left-4 bg-[#C9A04B] text-black px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={10} />
              {currentData.tag}
            </div>

            {/* Indicator Dots */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-1.5">
              {CATALOG_ITEMS.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-[#C9A04B]' : 'w-2 bg-white/30'}`}
                />
              ))}
            </div>
          </div>

          {/* Info Konten */}
          <div className="p-6 md:p-10 -mt-10 relative z-10">
            <div className="flex items-center gap-2 mb-3 text-[10px] md:text-xs font-bold uppercase tracking-[0.15em]" style={{ color: COLORS.accent }}>
              <Calendar size={14} /> {currentData.date}
            </div>
            
            <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 leading-tight">
              {currentData.title}
            </h3>

            <div className="flex flex-col gap-3 mb-8">
              <div className="flex items-center gap-3 text-zinc-400 text-xs md:text-sm">
                <div className="w-5 h-5 shrink-0 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <CheckCircle size={12} style={{ color: COLORS.accent }} />
                </div>
                Hotel {currentData.hotel}
              </div>
              <div className="flex items-center gap-3 text-zinc-400 text-xs md:text-sm">
                <div className="w-5 h-5 shrink-0 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                  <CheckCircle size={12} style={{ color: COLORS.accent }} />
                </div>
                Layanan Full Handling & Muthawwif
              </div>
            </div>

            {/* Price & Action */}
            <div className="flex items-center justify-between pt-6 border-t border-white/5">
              <div>
                <div className="text-[9px] text-zinc-500 uppercase font-black mb-0.5">Harga Paket</div>
                <div className="text-2xl md:text-3xl font-black">
                  Rp {currentData.price}<span className="text-sm font-bold text-zinc-500 ml-0.5">jt</span>
                </div>
              </div>
              
              <button 
                onClick={() => window.location.href = '/catalog'}
                className="group flex items-center gap-2 bg-[#C9A04B] hover:bg-white text-black px-5 py-3 rounded-full text-sm font-bold transition-all shadow-xl shadow-[#C9A04B]/10 active:scale-95"
              >
                Detail
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Aksen */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#C9A04B]/0 via-[#C9A04B] to-[#C9A04B]/0 opacity-30" />
      </div>
    </Modal>
  );
};

export default ProductCatalogPopup;