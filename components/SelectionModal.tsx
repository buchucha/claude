
import React, { useState, useEffect } from 'react';

interface Option {
  id: string;
  title: string;
  subtitle?: string;
  extra?: string;
  fullContent: string;
}

interface SelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  options: Option[];
  isLoading: boolean;
  onConfirm: (selectedContents: string[]) => void;
}

export const SelectionModal: React.FC<SelectionModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  options,
  isLoading,
  onConfirm
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) setSelectedIds(new Set());
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleOption = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleConfirm = () => {
    const selected = options
      .filter(opt => selectedIds.has(opt.id))
      .map(opt => opt.fullContent);
    onConfirm(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <div 
        className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <i className={`fas ${icon} text-xl`}></i>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">AI Clinical Recommendations</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-200 text-slate-400 transition-all">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-6">
              <div className="w-16 h-16 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Analyzing Patient Data...</p>
            </div>
          ) : options.length === 0 ? (
            <div className="py-20 text-center">
              <i className="fas fa-robot text-4xl text-slate-100 mb-4"></i>
              <p className="text-slate-400 font-medium">추천 항목을 찾지 못했습니다.</p>
            </div>
          ) : (
            options.map((opt) => (
              <div 
                key={opt.id}
                onClick={() => toggleOption(opt.id)}
                className={`p-6 rounded-[28px] border-2 transition-all cursor-pointer group flex items-start gap-5 ${
                  selectedIds.has(opt.id) 
                    ? 'border-slate-900 bg-slate-50 shadow-md scale-[1.01]' 
                    : 'border-slate-100 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                  selectedIds.has(opt.id) ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 group-hover:border-slate-400'
                }`}>
                  {selectedIds.has(opt.id) && <i className="fas fa-check text-[10px]"></i>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-black text-slate-900 text-base">{opt.title}</h4>
                    {opt.extra && (
                      <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-tighter ${
                        opt.extra.includes('High') ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {opt.extra}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">{opt.subtitle}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
            {selectedIds.size} Items Selected
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-8 py-4 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:text-slate-900 transition-all"
            >
              Cancel
            </button>
            <button 
              disabled={selectedIds.size === 0 || isLoading}
              onClick={handleConfirm}
              className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              Apply to Chart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
