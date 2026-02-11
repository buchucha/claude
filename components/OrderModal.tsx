
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Veterinarian, DepartmentOrder, DepartmentType, BillingItem, ServiceCatalogItem, OrderImage, ClinicSettings } from '../types';
import { supabase } from '../services/supabaseClient';
import { uploadImage } from '../services/imageService';

const DEPARTMENTS: { value: DepartmentType; label: string; icon: string; color: string }[] = [
  { value: 'Treatment', label: '처치실', icon: 'fa-briefcase-medical', color: 'text-indigo-600' },
  { value: 'Pharmacy', label: '약제실', icon: 'fa-pills', color: 'text-emerald-600' },
  { value: 'X-ray', label: 'X-ray', icon: 'fa-radiation', color: 'text-slate-700' },
  { value: 'Ultrasound', label: '초음파', icon: 'fa-wave-square', color: 'text-blue-600' }
];

const QuantityCalculator = ({ item, onConfirm, onCancel }: { item: ServiceCatalogItem, onConfirm: (qty: number) => void, onCancel: () => void }) => {
  const [days, setDays] = useState(1); const [freq, setFreq] = useState(2); const [dose, setDose] = useState(1);
  const total = days * freq * dose;
  return (
    <div className="absolute top-0 left-0 right-0 z-20 bg-slate-800 text-white p-3 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-200">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">{item.name}</h4>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div><label className="text-[9px] font-bold text-slate-400 block">Days</label><input type="number" min="1" value={days} onChange={e => setDays(Number(e.target.value))} className="w-full bg-slate-700 rounded px-1 text-xs text-center outline-none" /></div>
        <div><label className="text-[9px] font-bold text-slate-400 block">Freq</label><input type="number" min="1" value={freq} onChange={e => setFreq(Number(e.target.value))} className="w-full bg-slate-700 rounded px-1 text-xs text-center outline-none" /></div>
        <div><label className="text-[9px] font-bold text-slate-400 block">Unit</label><input type="number" min="0.1" step="0.1" value={dose} onChange={e => setDose(Number(e.target.value))} className="w-full bg-slate-700 rounded px-1 text-xs text-center outline-none" /></div>
      </div>
      <div className="flex justify-between items-center mt-2"><span className="text-sm font-black text-emerald-400">Total: {total}</span><div className="flex gap-2"><button onClick={onCancel} className="text-[9px] uppercase font-bold text-slate-400">Cancel</button><button onClick={() => onConfirm(total)} className="px-3 py-1 bg-blue-600 rounded text-[9px] font-black">Confirm</button></div></div>
    </div>
  );
};

interface OrderModalProps { isOpen: boolean; onClose: () => void; onSave: (vetName: string, details: string, items: BillingItem[], vetId: string, soapId: string, department: DepartmentType, images: OrderImage[], status: 'Pending' | 'In Progress' | 'Completed') => void; onDelete?: () => void; draftOrder?: Partial<DepartmentOrder> | null; editingOrder?: DepartmentOrder | null; vets: Veterinarian[]; isSubmitting: boolean; activeSoapId?: string; clinicSettings?: ClinicSettings; onImageDoubleClick?: (src: string) => void; }

export const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose, onSave, onDelete, draftOrder, editingOrder, vets, isSubmitting, activeSoapId, clinicSettings, onImageDoubleClick }) => {
  const [selectedDept, setSelectedDept] = useState<DepartmentType>('Treatment');
  const [vetId, setVetId] = useState(''); const [details, setDetails] = useState(''); const [selectedItems, setSelectedItems] = useState<BillingItem[]>([]); const [orderImages, setOrderImages] = useState<OrderImage[]>([]); const [isUploading, setIsUploading] = useState(false); const [searchTerm, setSearchTerm] = useState(''); const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]); const [calculatingItem, setCalculatingItem] = useState<ServiceCatalogItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCompleted = editingOrder?.status === 'Completed';

  useEffect(() => {
    if (isOpen) {
      setConfirmDelete(false); 
      const fetchCatalog = async () => { const { data } = await supabase.from('service_catalog').select('*').eq('is_active', true).order('name'); if (data) setCatalog(data); }; fetchCatalog();
      if (editingOrder) { 
        setVetId(vets.find(v => v.name === editingOrder.vet_name)?.id || vets[0]?.id || ''); 
        setDetails(editingOrder.request_details); 
        setSelectedItems(editingOrder.items || []); 
        setSelectedDept(editingOrder.department); 
        const normalizedImages = (editingOrder.images || []).map((img: any) => {
            if (typeof img === 'string') return { url: img, name: 'Attached Asset', uploadedAt: new Date().toISOString(), description: '' };
            return img;
        });
        setOrderImages(normalizedImages); 
      }
      else { 
        setVetId(vets[0]?.id || ''); 
        setDetails(''); 
        setSelectedItems([]); 
        setOrderImages([]); 
        setSelectedDept(draftOrder?.department || 'Treatment'); 
      }
    }
  }, [isOpen, editingOrder, draftOrder, vets]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploaded: OrderImage[] = [];
      const now = new Date().toISOString();
      for (const file of Array.from(files) as File[]) {
        const url = await uploadImage(file, clinicSettings?.imageServerUrl);
        if (url) uploaded.push({ 
          url, 
          name: file.name, 
          uploadedAt: now,
          description: '' 
        });
      }
      setOrderImages(prev => [...prev, ...uploaded]);
    } catch (err) {
      console.error("Asset upload failed:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateImageDescription = (index: number, desc: string) => {
    setOrderImages(prev => {
      const next = [...prev];
      next[index] = { ...next[index], description: desc };
      return next;
    });
  };

  const handleFinalSave = (status: 'Pending' | 'In Progress' | 'Completed') => {
    if (!activeSoapId && !editingOrder?.soap_id) {
      alert('오더를 연결할 진료 기록(SOAP ID)이 존재하지 않습니다. 먼저 차트를 저장해 주세요.');
      return;
    }
    const currentVet = vets.find(v => v.id === vetId);
    onSave(
      currentVet?.name || '', 
      details, 
      selectedItems, 
      vetId, 
      activeSoapId || editingOrder?.soap_id || '', 
      selectedDept, 
      orderImages, 
      status
    );
  };

  const sortedOrderImages = useMemo(() => {
    return [...orderImages].sort((a, b) => {
      const isTailA = a.url?.includes('ikava.tailbce91b.ts.net');
      const isTailB = b.url?.includes('ikava.tailbce91b.ts.net');
      if (isTailA && !isTailB) return -1;
      if (!isTailA && isTailB) return 1;
      return 0;
    });
  }, [orderImages]);

  if (!isOpen) return null;
  const displayPatientName = editingOrder ? editingOrder.patient_name : draftOrder?.patient_name;
  const isSubmitDisabled = isSubmitting || isUploading || !vetId || (!activeSoapId && !editingOrder?.soap_id);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="font-black text-slate-900 text-base uppercase tracking-tight">Order Assets Manager</h3>
            {isCompleted && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-emerald-200 shadow-sm">Archived</span>}
          </div>
          <div className="flex items-center gap-3">
            {isUploading && <span className="text-[10px] font-bold text-blue-600 animate-pulse uppercase tracking-widest">Processing...</span>}
            <button type="button" onClick={onClose} className="w-6 h-6 rounded-full hover:bg-slate-200 text-slate-400 flex items-center justify-center transition-colors"><i className="fas fa-times text-xs"></i></button>
          </div>
        </div>
        
        <div className="bg-white border-b border-slate-100 p-1.5 flex gap-1">
          {DEPARTMENTS.map(dept => (
            <button key={dept.value} type="button" onClick={() => setSelectedDept(dept.value)} className={`flex-1 py-2 px-2 rounded-lg flex items-center justify-center gap-2 border transition-all ${selectedDept === dept.value ? `bg-slate-900 border-slate-900 text-white shadow-md` : `bg-slate-50 text-slate-400 hover:bg-slate-100`}`}><i className={`fas ${dept.icon} text-[10px]`}></i><span className="text-[11px] font-black uppercase">{dept.label}</span></button>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
           {/* Left Catalog Section */}
           <div className={`w-1/3 p-5 border-r border-slate-100 flex flex-col bg-slate-50/50`}>
             <div className="relative mb-3"><input type="text" placeholder="Search catalog..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-blue-500 shadow-sm" /><i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i></div>
             <div className="flex-1 overflow-y-auto custom-scrollbar bg-white border border-slate-200 rounded-lg relative shadow-inner">
                {catalog.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                  <div key={item.id} onClick={() => { if(item.category==='PHARMACY') setCalculatingItem(item); else setSelectedItems(p => [...p, { id: Date.now().toString(), service_id: item.id, name: item.name, unit_price: item.default_price, quantity: 1, total_price: item.default_price, category: item.category, performingVetId: vetId }]); }} className="px-3 py-2 border-b border-slate-50 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"><span className="text-xs font-bold truncate">{item.name}</span><span className="text-[10px] text-slate-400 font-bold font-mono">₩{item.default_price.toLocaleString()}</span></div>
                ))}
                {calculatingItem && <QuantityCalculator item={calculatingItem} onConfirm={q => { setSelectedItems(p => [...p, { id: Date.now().toString(), service_id: calculatingItem.id, name: calculatingItem.name, unit_price: calculatingItem.default_price, quantity: q, total_price: calculatingItem.default_price * q, category: calculatingItem.category, performingVetId: vetId }]); setCalculatingItem(null); }} onCancel={() => setCalculatingItem(null)} />}
             </div>
           </div>

           {/* Middle Details Section */}
           <div className="w-1/3 p-5 flex flex-col space-y-4 border-r border-slate-100 overflow-y-auto">
              <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 flex items-center justify-between"><span className="text-sm font-black text-slate-900 truncate block">{displayPatientName}</span></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Practitioner</label><select value={vetId} onChange={e => setVetId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-blue-500 transition-all"><option value="">Select Practitioner</option>{vets.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
              <div className="flex-1 min-h-[180px] border border-slate-200 rounded-lg flex flex-col bg-white overflow-hidden shadow-inner"><div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200"><span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ordered Items ({selectedItems.length})</span></div><div className="flex-1 overflow-y-auto custom-scrollbar">{selectedItems.map((it, idx) => (<div key={it.id} className="flex justify-between items-center px-3 py-2 border-b border-slate-50 last:border-0 group"><span className="text-[10px] font-black text-slate-800 truncate flex-1 uppercase">{it.name} x{it.quantity}</span><button type="button" onClick={() => setSelectedItems(p => p.filter((_,i)=>i!==idx))} className="text-slate-300 hover:text-rose-500 ml-2 transition-colors"><i className="fas fa-times-circle"></i></button></div>))}</div></div>
              <div className="flex flex-col gap-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Instructions</label><textarea value={details} readOnly={isCompleted} onChange={e => setDetails(e.target.value)} className={`w-full h-24 border rounded-xl px-4 py-3 text-sm font-bold outline-none resize-none shadow-inner leading-relaxed ${isCompleted ? 'bg-slate-100' : 'bg-white border-slate-200 focus:border-blue-500'}`} /></div>
           </div>

           {/* Right Media Box Section (PREVIEW REMOVED) */}
           <div className="w-1/3 p-5 flex flex-col bg-slate-50/30">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Clinical Assets</h4>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase shadow-sm hover:bg-black transition-all">Upload</button>
                <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleImageUpload} />
              </div>
              <div className={`flex-1 overflow-y-auto custom-scrollbar border-2 border-dashed rounded-2xl p-3 bg-white shadow-inner border-slate-200`}>
                {sortedOrderImages.map((img, idx) => {
                  const isTailscale = img.url?.includes('ikava.tailbce91b.ts.net');
                  const timeStr = img.uploadedAt ? new Date(img.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown';

                  return (
                    <div 
                      key={idx} 
                      onDoubleClick={() => onImageDoubleClick?.(img.url)}
                      className={`relative flex flex-col bg-white border rounded-xl overflow-hidden mb-3 shadow-sm hover:shadow-md transition-all group cursor-pointer ${isTailscale ? 'border-blue-500 ring-1 ring-blue-500/10' : 'border-slate-200'}`}
                    >
                      {/* Box Header (No Image) */}
                      <div className="flex items-center gap-3 p-3 bg-slate-50/50 border-b border-slate-100">
                        <div className={`w-10 h-10 rounded-lg border flex-shrink-0 bg-white flex items-center justify-center ${isTailscale ? 'border-blue-200' : 'border-slate-200'}`}>
                           <i className={`fas ${isTailscale ? 'fa-image text-blue-500' : 'fa-sync fa-spin text-slate-300'} text-lg`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                             <span className="text-[10px] font-black text-slate-800 uppercase truncate">{img.name}</span>
                             <span className="text-[8px] font-bold text-slate-400 font-mono ml-2">{timeStr}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                             <span className={`w-1 h-1 rounded-full ${isTailscale ? 'bg-emerald-500' : 'bg-blue-400'}`}></span>
                             <span className={`text-[7px] font-black uppercase tracking-widest ${isTailscale ? 'text-emerald-600' : 'text-blue-500'}`}>{isTailscale ? 'NAS Synced' : 'Syncing...'}</span>
                          </div>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setOrderImages(p => p.filter(x => x.url !== img.url)); }} className="text-slate-300 hover:text-rose-500 transition-colors">
                           <i className="fas fa-trash-alt text-[10px]"></i>
                        </button>
                      </div>

                      {/* Box Footer: Editable Description */}
                      <div className="px-3 py-2">
                        <textarea
                          placeholder="Add diagnostic notes here..."
                          value={img.description || ''}
                          onChange={(e) => updateImageDescription(idx, e.target.value)}
                          className="w-full bg-transparent text-[11px] font-bold text-slate-700 placeholder:text-slate-300 border-none outline-none resize-none h-14 leading-relaxed"
                          onClick={e => e.stopPropagation()} 
                        />
                      </div>
                      
                      <div className="absolute top-1 right-8 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                         <span className="bg-slate-900/80 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase">2x Click View</span>
                      </div>
                    </div>
                  );
                })}
              </div>
           </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 items-center">
          {editingOrder && onDelete && (<button type="button" onClick={() => { if (!confirmDelete) setConfirmDelete(true); else onDelete(); }} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${confirmDelete ? 'bg-rose-600 text-white shadow-xl' : 'bg-rose-50 text-rose-500'}`}>{confirmDelete ? 'Confirm Delete?' : 'Delete'}</button>)}
          <button type="button" onClick={onClose} className="px-6 py-2.5 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-900 transition-colors">Cancel</button>
          <button type="button" disabled={isSubmitDisabled} onClick={() => handleFinalSave('Completed')} className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all">Archive Assets</button>
          <button type="button" disabled={isSubmitDisabled} onClick={() => handleFinalSave(editingOrder?.status || 'Pending')} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-black active:scale-95 transition-all">Save Draft</button>
        </div>
      </div>
    </div>
  );
};
