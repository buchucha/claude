
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Patient, BillingItem, Veterinarian, WaitlistEntry, ServiceCatalogItem, ServiceCategory } from '../types';
import { supabase } from '../services/supabaseClient';
import { PatientSidebar } from './PatientSidebar';

interface BillingPageProps {
  patients: Patient[];
  vets: Veterinarian[];
  waitlist: WaitlistEntry[];
  onAddToWaitlist: (entry: Partial<WaitlistEntry>) => Promise<void>;
  onUpdateWaitlist: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  onRemoveFromWaitlist: (id: string) => Promise<void>;
  onUpdatePatient?: (id: string, data: Partial<Patient>) => Promise<Patient | null>;
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
}

const ALL_CATEGORIES: ServiceCategory[] = [
  'CONSULTATION', 'IMAGING', 'LABORATORY', 'PROCEDURE', 
  'PHARMACY', 'PREVENTION', 'FOOD', 'SUPPLIES', 'HOSPITALIZATION'
];

const CatalogItemRow: React.FC<{ item: ServiceCatalogItem; onAdd: (item: ServiceCatalogItem) => void }> = ({ item, onAdd }) => (
  <div onDoubleClick={() => onAdd(item)} className="px-4 py-2 border-b border-slate-100 hover:bg-blue-50 cursor-pointer flex justify-between items-center group transition-colors select-none bg-white">
    <div className="flex flex-col min-w-0"><div className="flex items-center gap-2"><span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-700 truncate">{item.name}</span>{item.sku_code && <span className="text-[9px] text-slate-400 font-medium px-1 bg-slate-100 rounded">{item.sku_code}</span>}</div></div>
    <div className="pl-4"><span className="text-[11px] font-bold text-slate-500 group-hover:text-blue-600">₩{item.default_price.toLocaleString()}</span></div>
  </div>
);

export const BillingPage: React.FC<BillingPageProps> = ({ patients, vets, waitlist, onAddToWaitlist, onUpdateWaitlist, onRemoveFromWaitlist, selectedPatientId, onSelectPatient }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'patient' | 'waitlist' | 'billing_item' | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([]);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [methods, setMethods] = useState({ card: 0, cash: 0, transfer: 0 });
  const [collapsedVets, setCollapsedVets] = useState<Record<string, boolean>>({});

  useEffect(() => { const fetchCatalog = async () => { const { data } = await supabase.from('service_catalog').select('*').eq('is_active', true).order('name'); if (data) setCatalog(data); }; fetchCatalog(); }, []);
  useEffect(() => { if (selectedPatientId) loadPatientInvoice(selectedPatientId); else { setMethods({ card: 0, cash: 0, transfer: 0 }); setItems([]); setInvoiceId(null); } }, [selectedPatientId]);

  const loadPatientInvoice = async (patientId: string) => {
    const { data: inv } = await supabase.from('billing_invoices').select('*').eq('patient_id', patientId).eq('status', 'Unpaid').single();
    if (inv) {
      setInvoiceId(inv.id);
      const { data: bItems } = await supabase.from('billing_items').select('*').eq('invoice_id', inv.id).order('order_index', { ascending: true });
      if (bItems) setItems(bItems.map(bi => ({ id: bi.id, invoice_id: bi.invoice_id, name: bi.item_name, category: bi.category, unit_price: bi.unit_price, quantity: bi.quantity, total_price: bi.total_price, performingVetId: bi.performing_vet_id, order_index: bi.order_index })));
    } else { setMethods({ card: 0, cash: 0, transfer: 0 }); setItems([]); setInvoiceId(null); }
  };

  const selectedPatient = useMemo(() => patients.find(p => p.id === selectedPatientId), [selectedPatientId, patients]);
  
  const searchResults = useMemo(() => { 
    const query = searchTerm.trim().toLowerCase(); 
    return query ? patients.filter(p => p.name.toLowerCase().includes(query) || p.owner.toLowerCase().includes(query) || p.phone.includes(query) || (p.chartNumber || '').toLowerCase().includes(query)) : []; 
  }, [searchTerm, patients]);

  const waitlistByVet = useMemo(() => { 
    const groups: Record<string, WaitlistEntry[]> = { 'unassigned': [] }; 
    vets.forEach(v => groups[v.id] = []); 
    waitlist.forEach(w => { 
      const vid = w.vetId; 
      if (vid && groups[vid]) groups[vid].push(w); 
      else groups['unassigned'].push(w); 
    }); 
    return groups; 
  }, [waitlist, vets]);

  const subTotal = useMemo(() => items.reduce((acc, cur) => acc + cur.total_price, 0), [items]);
  const currentPaid = methods.card + methods.cash + methods.transfer;
  const remainingBalance = subTotal - currentPaid;

  const handleDragStart = (e: React.DragEvent, id: string, type: 'patient' | 'waitlist') => { 
    setDraggedItemId(id); 
    setDraggedItemType(type); 
    e.dataTransfer.setData('drag-id', id);
    e.dataTransfer.setData('drag-type', type);
    e.dataTransfer.effectAllowed = 'move'; 
  };

  const handleDropSidebar = async (e: React.DragEvent, targetVetId: string) => { 
    e.preventDefault(); 
    setDragOverId(null);
    const dragId = e.dataTransfer.getData('drag-id') || draggedItemId;
    const dragType = e.dataTransfer.getData('drag-type') || draggedItemType;

    if (!dragId || !dragType) return; 

    if (dragType === 'waitlist') { 
      const entry = waitlist.find(w => w.id === dragId); 
      if (entry && entry.vetId !== targetVetId) {
        await onUpdateWaitlist(dragId, { vetId: targetVetId }); 
      }
    } else if (dragType === 'patient') { 
      const p = patients.find(pat => pat.id === dragId); 
      if (p) {
        await onAddToWaitlist({ 
          patientId: p.id, 
          patientName: p.name, 
          breed: p.breed, 
          ownerName: p.owner, 
          vetId: targetVetId, 
          memo: '', 
          type: 'Billing Queue' 
        }); 
      }
    } 
  };

  const handleAddItemFromCatalog = async (catalogItem: ServiceCatalogItem) => {
    if (!selectedPatientId) return;
    let curInvId = invoiceId;
    if (!curInvId) {
      const { data: newInv } = await supabase.from('billing_invoices').insert({ patient_id: selectedPatientId, status: 'Unpaid' }).select().single();
      if (!newInv) return; curInvId = newInv.id; setInvoiceId(newInv.id);
    }
    const { data } = await supabase.from('billing_items').insert([{ invoice_id: curInvId, service_id: catalogItem.id, item_name: catalogItem.name, category: catalogItem.category, unit_price: catalogItem.default_price, quantity: 1, total_price: catalogItem.default_price, order_index: items.length }]).select().single();
    if (data) setItems(p => [...p, { id: data.id, invoice_id: curInvId!, name: data.item_name, category: data.category, unit_price: data.unit_price, quantity: data.quantity, total_price: data.total_price, order_index: data.order_index }]);
  };

  const handleFinalizePayment = async () => {
    if (!selectedPatientId || !invoiceId) return;
    await supabase.from('billing_invoices').update({ total_amount: subTotal, paid_amount: currentPaid, status: remainingBalance <= 0 ? 'Paid' : 'Partial', payment_method: methods }).eq('id', invoiceId);
    const wlEntry = waitlist.find(w => w.patientId === selectedPatientId && w.type === 'Billing Queue');
    if (wlEntry) await onRemoveFromWaitlist(wlEntry.id);
    onSelectPatient('');
  };

  const handleBillingItemDragStart = (index: number) => { setSourceIndex(index); setDraggedItemType('billing_item'); };
  const handleBillingItemDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault(); if (sourceIndex === null || sourceIndex === targetIndex) { setSourceIndex(null); setDropTargetIndex(null); return; }
    const newItems = [...items]; const [moved] = newItems.splice(sourceIndex, 1); newItems.splice(targetIndex, 0, moved);
    setItems(newItems);
    await supabase.from('billing_items').upsert(newItems.map((it, idx) => ({ id: it.id, invoice_id: invoiceId!, item_name: it.name, category: it.category, unit_price: it.unit_price, quantity: it.quantity, total_price: it.total_price, order_index: idx })));
    setSourceIndex(null); setDropTargetIndex(null);
  };

  const handleResize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 450) setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const stopResizing = useCallback(() => setIsResizing(false), []);

  useEffect(() => {
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [handleResize, stopResizing]);

  return (
    <div className={`flex h-full bg-slate-100 overflow-hidden text-xs font-sans ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <PatientSidebar 
        width={sidebarWidth}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchResults={searchResults}
        selectedPatientId={selectedPatientId}
        onSelectPatient={onSelectPatient}
        waitlist={waitlist}
        vets={vets}
        waitlistByVet={waitlistByVet}
        collapsedVets={collapsedVets}
        onToggleVet={(id) => setCollapsedVets(prev => ({ ...prev, [id]: !prev[id] }))}
        onRemoveFromWaitlist={onRemoveFromWaitlist}
        onDragStart={handleDragStart}
        onDragEnd={() => { setDraggedItemId(null); setDraggedItemType(null); setDragOverId(null); }}
        onDrop={handleDropSidebar}
        onStartResizing={() => setIsResizing(true)}
        dragOverId={dragOverId}
        setDragOverId={setDragOverId}
      />

      <div className="w-[450px] border-r border-slate-300 flex flex-col bg-slate-50">
        <div className="p-3 bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
          <h2 className="font-bold text-gray-700 mb-2 uppercase tracking-tighter">Service Catalog</h2>
          <div className="relative"><input type="text" placeholder="Search..." value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} className="w-full bg-white border border-slate-300 rounded pl-8 pr-4 py-1.5 text-xs font-bold outline-none" /><i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"></i></div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          {ALL_CATEGORIES.map((category) => {
            const catItems = catalog.filter(i => i.category === category && i.name.toLowerCase().includes(catalogSearch.toLowerCase()));
            if (!catItems.length) return null;
            return (
              <div key={category} className="border-b border-slate-100">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10"><span className="text-[10px] font-black uppercase">{category}</span></div>
                {catItems.map(item => <CatalogItemRow key={item.id} item={item} onAdd={handleAddItemFromCatalog} />)}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
        {selectedPatient ? (
          <>
            <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-start bg-slate-50">
              <div><h2 className="text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight"><i className="fas fa-file-invoice-dollar text-blue-600"></i>Invoice</h2><div className="flex items-center gap-2 mt-1"><span className="text-xs font-bold text-slate-600">{selectedPatient.name}</span></div></div>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100/80 sticky top-0 z-10 shadow-sm"><tr className="text-[10px] font-black text-slate-500 uppercase tracking-wider"><th className="w-10"></th><th className="px-6 py-2">Description</th><th className="px-4 py-2 text-right">Price</th><th className="px-4 py-2 text-center">Qty</th><th className="px-4 py-2 text-right">Amount</th><th className="w-10"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <tr key={item.id} draggable onDragStart={() => handleBillingItemDragStart(index)} onDragEnd={() => { setSourceIndex(null); setDropTargetIndex(null); }} onDragOver={(e) => { e.preventDefault(); if(sourceIndex!==index) setDropTargetIndex(index); }} onDrop={(e) => handleBillingItemDrop(e, index)} className={`group transition-all ${sourceIndex === index ? 'opacity-30' : ''} ${dropTargetIndex === index ? 'border-t-2 border-t-blue-500 bg-blue-50' : ''}`}>
                      <td className="px-2 py-3 text-center cursor-grab"><i className="fas fa-grip-vertical text-slate-300"></i></td>
                      <td className="px-6 py-3"><div className="font-bold text-slate-800 text-[11px]">{item.name}</div></td>
                      <td className="px-4 py-3 text-right text-xs">₩{item.unit_price.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center"><span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">{item.quantity}</span></td>
                      <td className="px-4 py-3 text-right font-bold text-xs">₩{item.total_price.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center"><button onClick={() => { supabase.from('billing_items').delete().eq('id', item.id); setItems(p => p.filter(i => i.id !== item.id)); }} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100"><i className="fas fa-times-circle"></i></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 p-8 flex-shrink-0">
              <div className="flex justify-between items-end mb-8"><div><span className="font-black text-3xl text-slate-900 italic">₩{subTotal.toLocaleString()}</span></div><div className="text-right"><span className="font-black text-2xl text-rose-600 italic">₩{remainingBalance.toLocaleString()}</span></div></div>
              <div className="grid grid-cols-3 gap-4 mb-8">{['card', 'cash', 'transfer'].map(m => (<div key={m} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-1 focus-within:border-blue-500 shadow-sm"><span className="text-[9px] uppercase font-black text-slate-400">{m}</span><input type="number" className="bg-transparent outline-none font-black text-slate-900 text-sm" value={(methods as any)[m]} onChange={e => setMethods(p => ({ ...p, [m]: Number(e.target.value) }))} /></div>))}</div>
              <button disabled={items.length === 0} onClick={handleFinalizePayment} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-30">Finalize Payment</button>
            </div>
          </>
        ) : (<div className="flex-1 flex flex-col items-center justify-center text-slate-200"><i className="fas fa-hand-pointer text-3xl mb-4"></i><p className="font-black uppercase tracking-[0.4em] text-[10px]">Select Patient</p></div>)}
      </div>
    </div>
  );
};
