
import React, { useEffect } from 'react';

interface ImageModalProps {
  src: string;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ src, onClose }) => {
  // ESC 키를 누르면 닫히도록 설정
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-300 p-4 md:p-10"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all z-[110]"
      >
        <i className="fas fa-times text-xl"></i>
      </button>
      
      <div 
        className="relative max-w-full max-h-full flex items-center justify-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <img 
          src={src} 
          alt="Enlarged clinical view" 
          className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border-4 border-white/10"
        />
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/50 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
          Double click image to close or press ESC
        </div>
      </div>
    </div>
  );
};
