
import React, { useState, useRef, useEffect } from 'react';
import { SOAPField, SOAPRecord, LabResults, DiagnosisReference, ClinicSettings } from '../types';
import { supabase } from '../services/supabaseClient';
import { uploadImage } from '../services/imageService';

const SectionHeader: React.FC<{ 
  icon: string; 
  title: string; 
  colorClass: string;
  onQuickSave?: () => void;
  isSaving?: boolean;
}> = ({ icon, title, colorClass, onQuickSave, isSaving }) => (
  <div className="flex items-center justify-between mb-3 border-b border-slate-300 pb-2">
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded flex items-center justify-center text-white shadow ${colorClass}`}>
        <i className={`fas ${icon} text-sm`}></i>
      </div>
      <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{title}</h2>
    </div>
    
    {onQuickSave && (
      <button 
        onClick={(e) => { e.preventDefault(); onQuickSave(); }}
        disabled={isSaving}
        className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded font-black text-[11px] uppercase tracking-wider hover:bg-blue-700 active:scale-95 disabled:opacity-50"
      >
        <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    )}
  </div>
);

interface SOAPEditorProps {
  activeStep: 'S' | 'O' | 'A' | 'P';
  onStepChange: (step: 'S' | 'O' | 'A' | 'P') => void;
  record: Partial<SOAPRecord>;
  onUpdate: (field: SOAPField, value: any) => void;
  isSaving: boolean;
  onSave: () => void;
  onSuggestTests: () => void;
  onSuggestDdx: () => void;
  onSuggestTx: () => void;
  onSuggestRx: () => void;
  onSuggestSummary: () => void;
  onImageDoubleClick: (src: string) => void;
  onDeleteImage?: (soapId: string, url: string) => void; 
  clinicSettings?: ClinicSettings;
}

export const SOAPEditor: React.FC<SOAPEditorProps> = ({ 
  activeStep, onStepChange, record, onUpdate, onSuggestTests, onSuggestDdx, onSuggestTx, onSuggestRx, onSuggestSummary, isSaving, onSave, onImageDoubleClick, onDeleteImage, clinicSettings
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const steps = ['S', 'O', 'A', 'P'] as const;
  const currentIndex = steps.indexOf(activeStep);
  const [isUploading, setIsUploading] = useState(false);
  const [draggedDdxIndex, setDraggedDdxIndex] = useState<number | null>(null);
  const [ddxDragOverIndex, setDdxDragOverIndex] = useState<number | null>(null);
  const [ddxInput, setDdxInput] = useState('');
  const [ddxSuggestions, setDdxSuggestions] = useState<DiagnosisReference[]>([]);
  const [showDdxSuggestions, setShowDdxSuggestions] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  const handleDdxDragStart = (index: number) => setDraggedDdxIndex(index);
  const handleDdxDrop = (targetIndex: number) => {
    if (draggedDdxIndex === null || draggedDdxIndex === targetIndex) return;
    const newDdx = [...(record.assessmentDdx || [])];
    const draggedItem = newDdx[draggedDdxIndex];
    newDdx.splice(draggedDdxIndex, 1);
    newDdx.splice(targetIndex, 0, draggedItem);
    onUpdate('assessmentDdx', newDdx);
    setDraggedDdxIndex(null); setDdxDragOverIndex(null);
  };

  const handleDdxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value; setDdxInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value.trim().length > 0) {
      searchTimeoutRef.current = setTimeout(async () => {
        const { data } = await supabase.from('reference_diagnoses').select('*').ilike('name', `%${value}%`).limit(10);
        if (data) { setDdxSuggestions(data); setShowDdxSuggestions(true); }
      }, 300);
    } else { setDdxSuggestions([]); setShowDdxSuggestions(false); }
  };

  const addDdxItem = (name: string) => {
    const currentList = record.assessmentDdx || [];
    if (!currentList.includes(name)) onUpdate('assessmentDdx', [...currentList, name]);
    setDdxInput(''); setDdxSuggestions([]); setShowDdxSuggestions(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadImage(file, clinicSettings?.imageServerUrl);
      if (url) {
        onUpdate('images', [...(record.images || []), url]);
      }
    } catch (err) {
      console.error("SOAP Asset upload failed:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (url: string) => {
    if (record.id && onDeleteImage) {
      onDeleteImage(record.id, url);
    } else {
      const newImages = (record.images || []).filter(img => img !== url);
      onUpdate('images', newImages);
    }
  };

  const renderSubjective = () => (
    <div className="space-y-4">
      <SectionHeader icon="fa-notes-medical" title="Subjective (History)" colorClass="bg-blue-600" onQuickSave={onSave} isSaving={isSaving} />
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 rounded border border-slate-200"><span className="text-[10px] font-black text-blue-700 uppercase">Chief Complaint</span></div>
        <input type="text" value={record.cc || ''} onChange={(e) => onUpdate('cc', e.target.value)} placeholder="Chief Complaint..." className="w-full px-3 py-2 text-base font-black text-slate-950 bg-white rounded border border-slate-400 outline-none focus:border-blue-600 shadow-sm" />
        <textarea value={record.subjective || ''} onChange={(e) => onUpdate('subjective', e.target.value)} placeholder="Record detailed history..." className="w-full min-h-[400px] p-4 text-sm font-bold text-slate-950 bg-white rounded border border-slate-400 outline-none focus:border-blue-600 leading-relaxed shadow-sm" />
      </div>
    </div>
  );

  const renderObjective = () => (
    <div className="space-y-4">
      <SectionHeader icon="fa-heartbeat" title="Objective (Clinical Exam)" colorClass="bg-emerald-600" onQuickSave={onSave} isSaving={isSaving} />
      <div className="flex gap-2 mb-2 items-center">
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded text-[11px] font-bold hover:bg-slate-200 disabled:opacity-50">
            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-camera'} mr-1`}></i> 
            {isUploading ? 'Uploading...' : 'Attach Photo'}
          </button>
          <button onClick={onSuggestTests} className="px-3 py-1.5 bg-slate-800 text-white rounded text-[11px] font-bold hover:bg-black"><i className="fas fa-microscope mr-1"></i> AI Diagnostics</button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileUpload} />
          {isUploading && <span className="text-[9px] font-black text-blue-500 uppercase animate-pulse">Processing media...</span>}
      </div>
      <textarea value={record.objective || ''} onChange={(e) => onUpdate('objective', e.target.value)} placeholder="Vitals, physical exam findings..." className="w-full min-h-[500px] p-4 text-sm font-bold text-slate-950 bg-white rounded border border-slate-400 outline-none focus:border-emerald-600 shadow-sm" />
    </div>
  );

  const renderAssessment = () => (
    <div className="space-y-4">
      <SectionHeader icon="fa-list-check" title="Assessment (Diagnosis)" colorClass="bg-amber-500" onQuickSave={onSave} isSaving={isSaving} />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
           <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Problem List</span>
           <textarea value={record.assessmentProblems || ''} onChange={(e) => onUpdate('assessmentProblems', e.target.value)} placeholder="List clinical problems..." className="w-full min-h-[300px] p-4 text-sm font-black text-slate-950 bg-white border border-slate-400 rounded outline-none focus:border-amber-500 shadow-sm" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center"><span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">DDx (Differential Diagnosis)</span><button onClick={onSuggestDdx} className="text-[10px] text-indigo-600 font-black underline">AI Recommendations</button></div>
          <div className="bg-slate-50 border border-slate-300 rounded p-2 min-h-[300px] space-y-1 relative">
             {record.assessmentDdx?.map((d, i) => (
               <div key={i} draggable onDragStart={() => handleDdxDragStart(i)} onDragOver={(e) => { e.preventDefault(); setDdxDragOverIndex(i); }} onDrop={() => handleDdxDrop(i)} className={`flex justify-between items-center bg-white border px-2 py-1.5 rounded group shadow-sm cursor-move transition-all ${draggedDdxIndex === i ? 'opacity-30' : ''} ${ddxDragOverIndex === i ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                 <div className="flex items-center gap-2"><i className="fas fa-grip-vertical text-slate-300 text-[10px]"></i><span className="text-xs font-black text-slate-950">{d}</span></div>
                 <button onClick={() => { const newDdx = [...(record.assessmentDdx || [])]; newDdx.splice(i, 1); onUpdate('assessmentDdx', newDdx); }} className="text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-times"></i></button>
               </div>
             ))}
             <div className="relative mt-2">
               <input value={ddxInput} onChange={handleDdxInputChange} onKeyDown={(e) => e.key === 'Enter' && addDdxItem(ddxInput)} onFocus={() => ddxInput && setShowDdxSuggestions(true)} className="w-full bg-white border border-slate-300 p-2 text-xs font-black text-slate-950 outline-none focus:border-indigo-500 rounded shadow-inner" placeholder="+ Search or Type DDx..." />
               {showDdxSuggestions && ddxSuggestions.length > 0 && (
                 <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-b shadow-lg max-h-48 overflow-y-auto">
                   {ddxSuggestions.map(item => <div key={item.id} onMouseDown={() => addDdxItem(item.name)} className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 cursor-pointer border-b last:border-0">{item.name}</div>)}
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlan = () => (
    <div className="space-y-4">
      <SectionHeader icon="fa-clipboard-check" title="Plan (Management)" colorClass="bg-purple-600" onQuickSave={onSave} isSaving={isSaving} />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
           <div className="flex justify-between items-center"><span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Tx (Treatment/Surgery)</span><button onClick={onSuggestTx} className="text-[10px] text-blue-600 font-black underline">AI Recommendations</button></div>
           <textarea value={record.planTx || ''} onChange={(e) => onUpdate('planTx', e.target.value)} className="w-full min-h-[200px] p-3 text-sm font-bold text-slate-950 bg-white border border-slate-400 rounded outline-none focus:border-blue-500 shadow-sm" placeholder="Treatment details..." />
        </div>
        <div className="space-y-2">
           <div className="flex justify-between items-center"><span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Rx (Prescription)</span><button onClick={onSuggestRx} className="text-[10px] text-emerald-600 font-black underline">AI Recommendations</button></div>
           <textarea value={record.planRx || ''} onChange={(e) => onUpdate('planRx', e.target.value)} className="w-full min-h-[200px] p-3 text-sm font-bold text-slate-950 bg-white border border-slate-400 rounded outline-none focus:border-emerald-500 shadow-sm" placeholder="Prescription details..." />
        </div>
      </div>
      <div className="bg-slate-50 p-4 rounded-xl mt-4 border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center mb-3"><span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Discharge Summary & Education</span><button onClick={onSuggestSummary} className="px-3 py-1.5 bg-slate-800 text-white rounded text-[10px] font-black hover:bg-black shadow-sm">AI Summary</button></div>
         <textarea value={record.planSummary || ''} onChange={(e) => onUpdate('planSummary', e.target.value)} className="w-full min-h-[400px] p-4 text-sm font-bold text-slate-950 bg-white border border-slate-400 rounded-lg outline-none focus:border-blue-500 leading-relaxed shadow-sm" placeholder="Enter summary information for the owner..." />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white p-4 relative">
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32">
        {activeStep === 'S' && renderSubjective()}
        {activeStep === 'O' && renderObjective()}
        {activeStep === 'A' && renderAssessment()}
        {activeStep === 'P' && renderPlan()}
        
        {/* Linked Media List (PREVIEW REMOVED) */}
        {record.images && record.images.length > 0 && (
          <div className="mt-10 pt-6 border-t border-slate-200">
             <div className="flex items-center gap-2 mb-4"><i className="fas fa-images text-blue-500 text-sm"></i><h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Linked Clinical Assets</h3><span className="bg-slate-100 text-slate-400 text-[9px] px-1.5 py-0.5 rounded font-black">{record.images.length}</span></div>
             <div className="flex flex-wrap gap-3">
               {record.images.map((img, idx) => (
                 <div 
                  key={idx} 
                  onDoubleClick={() => onImageDoubleClick(img)}
                  className="relative w-48 h-16 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex items-center p-3 gap-3"
                 >
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-blue-500">
                       <i className="fas fa-file-image text-lg"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                       <span className="text-[10px] font-black text-slate-800 uppercase block truncate">Asset {idx + 1}</span>
                       <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Linked from Order</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeImage(img); }} className="text-slate-300 hover:text-rose-500 transition-colors"><i className="fas fa-times"></i></button>
                    <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100"><i className="fas fa-search-plus text-[8px] text-blue-400"></i></div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md px-6 py-4 border-t border-slate-200 z-10 flex justify-between shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
        <button onClick={() => currentIndex > 0 && onStepChange(steps[currentIndex - 1])} disabled={currentIndex === 0} className="px-6 py-2.5 bg-slate-100 border border-slate-300 rounded-xl font-black text-xs text-slate-500 disabled:opacity-20 hover:bg-slate-200 transition-all">Previous</button>
        {currentIndex < steps.length - 1 ? (
          <button onClick={() => onStepChange(steps[currentIndex + 1])} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-black shadow-lg shadow-slate-900/20 active:scale-95 transition-all">Next Section</button>
        ) : (
          <button onClick={onSave} disabled={isSaving} className="px-10 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs shadow-lg shadow-blue-500/20 disabled:opacity-50 uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all">Finish & Save Chart</button>
        )}
      </div>
    </div>
  );
};
