
import React, { useState } from 'react';
import { SOAPRecord } from '../types';

interface HistoryCardProps {
  entry: SOAPRecord;
  isExpanded: boolean;
  onToggle: () => void;
  onLoadRecord: (record: SOAPRecord) => void;
  onImageDoubleClick: (src: string) => void;
  onDeleteImage?: (recordId: string, imgUrl: string) => void;
}

export const HistoryCard: React.FC<HistoryCardProps> = ({ 
  entry, 
  isExpanded, 
  onToggle, 
  onLoadRecord,
  onImageDoubleClick,
  onDeleteImage
}) => {
  return (
    <div className={`mb-3 transition-all duration-300 ${isExpanded ? 'scale-[1.01]' : ''}`}>
      <div 
        className={`bg-white border rounded-[20px] overflow-hidden transition-all duration-300 ${isExpanded ? 'border-blue-500 shadow-xl' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
      >
        <div onClick={onToggle} className="p-4 cursor-pointer flex justify-between items-center group">
          <div className="flex-1 min-w-0">
            <span className={`text-[10px] font-black uppercase tracking-widest ${isExpanded ? 'text-blue-600' : 'text-slate-400'}`}>{entry.date}</span>
            <h4 className={`font-black text-sm mt-1 leading-snug line-clamp-1 ${isExpanded ? 'text-slate-900' : 'text-slate-700'}`}>{entry.cc || 'No symptom recorded'}</h4>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isExpanded ? 'rotate-180 bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}><i className="fas fa-chevron-down text-[10px]"></i></div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
              {[
                { label: 'S', color: 'bg-blue-50 text-blue-700', val: entry.subjective },
                { label: 'O', color: 'bg-emerald-50 text-emerald-700', val: entry.objective },
                { label: 'A', color: 'bg-amber-50 text-amber-700', val: entry.assessmentProblems },
                { label: 'P', color: 'bg-purple-50 text-purple-700', val: entry.planSummary }
              ].map(d => (
                <div key={d.label} className={`p-2.5 rounded-xl border border-transparent ${d.color.split(' ')[0]}`}>
                  <span className={`font-black text-[9px] block mb-1 tracking-widest ${d.color.split(' ')[1]}`}>{d.label} SECTION</span>
                  <p className="text-[10px] font-bold text-slate-800 line-clamp-2 leading-relaxed">{d.val || 'No record'}</p>
                </div>
              ))}
            </div>

            {/* Media Assets (PREVIEW REMOVED) */}
            {entry.images && entry.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clinical Assets ({entry.images.length})</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {entry.images.map((img, idx) => (
                    <div 
                      key={idx} 
                      onDoubleClick={() => onImageDoubleClick(img)}
                      className="relative flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer group"
                    >
                      <i className="fas fa-file-image text-slate-300 group-hover:text-blue-400 text-xs"></i>
                      <span className="text-[9px] font-black text-slate-600 truncate uppercase flex-1">Asset_{idx + 1}.png</span>
                      {onDeleteImage && (
                        <button onClick={(e) => { e.stopPropagation(); onDeleteImage(entry.id, img); }} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-times text-[10px]"></i></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={(e) => { e.stopPropagation(); onLoadRecord(entry); }} className="w-full py-3 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95">Load to Chart Editor</button>
          </div>
        )}
      </div>
    </div>
  );
};
