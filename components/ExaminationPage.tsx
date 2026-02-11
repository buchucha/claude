
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DepartmentOrder, Veterinarian, DepartmentType, Patient, WaitlistEntry, SOAPRecord, OrderImage } from '../types';
import { supabase } from '../services/supabaseClient';
import { OrderModal } from './OrderModal';
import { PatientSidebar } from './PatientSidebar';
import { DicomViewer } from './DicomViewer';

interface ExaminationPageProps {
  vets: Veterinarian[];
  patients: Patient[];
  waitlist: WaitlistEntry[];
  onImageDoubleClick: (src: string) => void;
  activePatient: Patient | null;
  onSelectPatient: (id: string) => void;
  onAddToWaitlist: (entry: Partial<WaitlistEntry>) => Promise<void>;
  onUpdateWaitlist: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  onRemoveFromWaitlist: (id: string) => Promise<void>;
  clinicSettings?: any;
  currentSoap: Partial<SOAPRecord>;
}

const DEPT_CONFIG: { type: DepartmentType; label: string; icon: string; color: string }[] = [
  { type: 'Treatment', label: 'Treatment', icon: 'fa-briefcase-medical', color: 'indigo' },
  { type: 'Pharmacy', label: 'Pharmacy', icon: 'fa-pills', color: 'emerald' },
  { type: 'X-ray', label: 'X-ray', icon: 'fa-radiation', color: 'slate' },
  { type: 'Ultrasound', label: 'Ultrasound', icon: 'fa-wave-square', color: 'blue' }
];

export const ExaminationPage: React.FC<ExaminationPageProps> = ({ 
  vets, patients, waitlist, onImageDoubleClick, activePatient, onSelectPatient,
  onAddToWaitlist, onUpdateWaitlist, onRemoveFromWaitlist, clinicSettings, currentSoap
}) => {
  const [orders, setOrders] = useState<DepartmentOrder[]>([]);
  const [editingOrder, setEditingOrder] = useState<DepartmentOrder | null>(null);
  const [preSelectedDept, setPreSelectedDept] = useState<DepartmentType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'Pending' | 'Completed'>('Pending');
  
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedVets, setCollapsedVets] = useState<Record<string, boolean>>({});
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'patient' | 'waitlist' | 'order' | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverOrderId, setDragOverOrderId] = useState<string | null>(null);
  const [dicomViewerAccession, setDicomViewerAccession] = useState<string | null>(null);
  const [dicomViewerPatientName, setDicomViewerPatientName] = useState<string>('');
  const [dragSourceDept, setDragSourceDept] = useState<DepartmentType | null>(null);
  const [isDropZoneOver, setIsDropZoneOver] = useState(false);

  const fetchOrders = async () => {
  setIsLoading(true);
  
  // 1단계: 오더 + 차트번호만 가져오기
  const { data } = await supabase
    .from('department_orders')
    .select(`
      *,
      patients(chart_number)
    `)
    .order('created_at', { ascending: false });
  
  if (data) {
    // 2단계: X-ray Pending 오더의 accession_number를 별도 조회
    const xrayIds = data.filter(o => o.department === 'X-ray' && o.status === 'Pending').map(o => o.id);
    
    if (xrayIds.length > 0) {
      const { data: wlData } = await supabase
        .from('department_orders')
        .select('id, accession_number')
        .in('id', xrayIds);
      
      // accession_number를 오더에 합치기
      const accMap = new Map(wlData?.map(w => [w.id, w.accession_number]) || []);
      data.forEach(o => {
        if (accMap.has(o.id)) {
          (o as any).accession_number = accMap.get(o.id);
        }
      });
    }
    
    setOrders(data);
  }
  setIsLoading(false);
};


  const handleReorderDrop = async (targetOrderId: string, targetDept: DepartmentType) => {
    if (!draggedItemId || draggedItemId === targetOrderId || draggedItemType !== 'order') return;
    if (dragSourceDept !== targetDept) return;

    const deptOrders = orders
      .filter(o => o.department === targetDept && o.status !== 'Completed')
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    const fromIndex = deptOrders.findIndex(o => o.id === draggedItemId);
    const toIndex = deptOrders.findIndex(o => o.id === targetOrderId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...deptOrders];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const updatedOrders = orders.map(o => {
      const newIdx = reordered.findIndex(r => r.id === o.id);
      if (newIdx !== -1) return { ...o, order_index: newIdx };
      return o;
    });
    setOrders(updatedOrders);

    for (let i = 0; i < reordered.length; i++) {
      await supabase.from('department_orders').update({ order_index: i }).eq('id', reordered[i].id);
    }
  };

  useEffect(() => {
    fetchOrders();
    // 실시간 구독 설정 (오더 상태 변화 및 Accession Number 업데이트 반영)
    const sub = supabase.channel('orders_updates').on('postgres_changes', { event: '*', table: 'department_orders' }, fetchOrders).subscribe();
    const subWorklist = supabase.channel('worklist_updates').on('postgres_changes', { event: '*', table: 'view_imaging_worklist' }, fetchOrders).subscribe();
    return () => { 
      sub.unsubscribe();
      subWorklist.unsubscribe();
    };
  }, []);

  const handleResize = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 450) setSidebarWidth(newWidth);
    }
  }, [isResizingSidebar]);

  const stopResizing = useCallback(() => setIsResizingSidebar(false), []);

  useEffect(() => {
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [handleResize, stopResizing]);

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return query ? patients.filter(p => p.name.toLowerCase().includes(query) || p.owner.toLowerCase().includes(query) || p.phone.includes(query)) : [];
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

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'In Progress': return 'bg-blue-600 text-white shadow-md';
      case 'Pending': return 'bg-amber-500 text-white shadow-md';
      case 'Completed': return 'bg-emerald-600 text-white shadow-md';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    const { error } = await supabase.from('department_orders').update({ status: 'Completed' }).eq('id', orderId);
    if (!error) fetchOrders();
  };

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden font-sans">
      <PatientSidebar 
        width={sidebarWidth} searchTerm={searchTerm} onSearchChange={setSearchTerm} searchResults={searchResults}
        selectedPatientId={activePatient?.id || ''} onSelectPatient={onSelectPatient} waitlist={waitlist} vets={vets}
        waitlistByVet={waitlistByVet} collapsedVets={collapsedVets} onToggleVet={(id) => setCollapsedVets(prev => ({ ...prev, [id]: !prev[id] }))}
        onRemoveFromWaitlist={onRemoveFromWaitlist} onDragStart={(e, id, type) => { 
            setDraggedItemId(id); 
            setDraggedItemType(type);
            e.dataTransfer.setData('drag-id', id);
            e.dataTransfer.setData('drag-type', type);
            e.dataTransfer.setData('text/plain', id);
        }}
        onDragEnd={() => { setDraggedItemId(null); setDraggedItemType(null); }}
        onDrop={async (e, targetVetId) => {
          const dragId = e.dataTransfer.getData('drag-id') || e.dataTransfer.getData('text/plain') || draggedItemId;
          const dragType = e.dataTransfer.getData('drag-type') || draggedItemType;
          if (!dragId) return;
          if (dragType === 'waitlist') await onUpdateWaitlist(dragId, { vetId: targetVetId });
          else if (dragType === 'patient') {
            const p = patients.find(pat => pat.id === dragId);
            if (p) await onAddToWaitlist({ patientId: p.id, patientName: p.name, breed: p.breed, ownerName: p.owner, vetId: targetVetId, type: 'Examination' });
          }
        }}
        onStartResizing={() => setIsResizingSidebar(true)} dragOverId={dragOverId} setDragOverId={setDragOverId}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-slate-200 shadow-inner">
        <header className="h-12 border-b border-slate-300 bg-white px-5 flex items-center justify-between z-10 shadow-sm">
          <div className="flex items-center gap-6">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-microscope text-blue-600"></i> {viewMode === 'Pending' ? 'Active Worklist' : 'Completed Archive'}
            </h2>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button type="button" onClick={() => setViewMode('Pending')} className={`px-4 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${viewMode === 'Pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Active</button>
              <button type="button" onClick={() => setViewMode('Completed')} className={`px-4 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${viewMode === 'Completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Archived</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Active Orders</span>
             <span className={`${viewMode === 'Pending' ? 'bg-amber-500' : 'bg-emerald-500'} text-white text-[10px] font-black px-2.5 py-0.5 rounded-md leading-none`}>
               {orders.filter(o => viewMode === 'Pending' ? o.status !== 'Completed' : (o.status === 'Completed' && o.patient_id === activePatient?.id)).length}
             </span>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-4 gap-1 p-1 overflow-hidden">
          {DEPT_CONFIG.map((dept) => {
            const deptOrders = orders.filter(o => viewMode === 'Pending' ? (o.department === dept.type && o.status !== 'Completed') : (o.department === dept.type && o.status === 'Completed' && o.patient_id === activePatient?.id)).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

            return (
              <div key={dept.type} onDoubleClick={() => viewMode === 'Pending' && setIsModalOpen(true)} className="flex flex-col bg-white/40 border border-slate-300 rounded overflow-hidden group">
                <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-white/80 sticky top-0 z-10 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded bg-${dept.color}-50 flex items-center justify-center text-${dept.color}-600 border border-${dept.color}-100`}><i className={`fas ${dept.icon} text-[10px]`}></i></div>
                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{dept.label}</h3>
                  </div>
                  <span className={`bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-black`}>{deptOrders.length}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-3">
                  {deptOrders.map(order => {
                    const chartNum = order.patients?.chart_number || '0';
                    const accessionNum = (order as any).accession_number;

                    return (
                      <div 
                        key={order.id} 
                        draggable={viewMode === 'Pending'}
                        onDragStart={() => { setDraggedItemId(order.id); setDraggedItemType('order'); setDragSourceDept(dept.type); }}
                        onDragEnd={() => { setDraggedItemId(null); setDraggedItemType(null); setIsDropZoneOver(false); setDragOverOrderId(null); setDragSourceDept(null); }}
                        onDragOver={(e) => { e.preventDefault(); if (draggedItemType === 'order' && dragSourceDept === dept.type) setDragOverOrderId(order.id); }}
                        onDragLeave={() => setDragOverOrderId(null)}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleReorderDrop(order.id, dept.type); setDragOverOrderId(null); }}
                        onClick={() => { setEditingOrder(order); setPreSelectedDept(null); setIsModalOpen(true); }}
                        className={`bg-white border rounded-xl p-3 shadow-sm hover:shadow-md hover:border-blue-500 transition-all cursor-pointer group flex flex-col h-auto relative ${dragOverOrderId === order.id ? 'border-blue-500 border-2 bg-blue-50' : 'border-slate-200'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${getStatusStyle(order.status)}`}>{order.status}</span>
                          <span className="text-[9px] font-bold text-slate-400">{new Date(order.created_at || '').toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="text-[13px] font-black text-slate-900 truncate">
                            {order.patient_name}
                          </h4>
                          <span className="bg-slate-950 text-white text-[9px] font-black px-2 py-0.5 rounded flex-shrink-0 font-mono tracking-tighter">
                            # {chartNum}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase truncate mb-2">Dr. {order.vet_name}</p>
                        
                        {order.request_details && (
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-2">
                            <p className="text-[10px] font-bold text-slate-600 line-clamp-2 leading-snug italic">"{order.request_details}"</p>
                          </div>
                        )}

                        <div className="flex justify-between items-center mt-auto">
                          <div className="flex items-center gap-2">
                             <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${(order.images?.length || 0) > 0 ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
                                <i className="fas fa-camera text-[9px]"></i>
                                <span className="text-[8px] font-black uppercase tracking-widest">{order.images?.length || 0} Assets</span>
                             </div>
                             {order.department === 'X-ray' && order.status === 'Completed' && accessionNum && (
                               <button
                                 onClick={(e) => { e.stopPropagation(); setDicomViewerAccession(accessionNum); setDicomViewerPatientName(order.patient_name); }}
                                 className="flex items-center gap-1.5 px-2 py-1 rounded border bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
                               >
                                 <i className="fas fa-x-ray text-[9px]"></i>
                                 <span className="text-[8px] font-black uppercase tracking-widest">View DICOM</span>
                               </button>
                             )}
                          </div>
                          <i className="fas fa-chevron-right text-[10px] text-slate-200 group-hover:text-blue-500 transition-colors"></i>
                        </div>

                        {/* NAS / VIEW IMAGING WORKLIST INFO (Accession Number) */}
                        {accessionNum && order.department === 'X-ray' && (
                          <div className="mt-3 pt-2.5 border-t-2 border-dashed border-slate-100 flex flex-col gap-1.5 bg-blue-900/5 -mx-3 -mb-3 px-3 py-2.5 rounded-b-xl">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                   <i className="fas fa-database text-blue-500 text-[9px]"></i>
                                   <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.1em]">DICOM WORKLIST</span>
                                </div>
                                <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">NAS SYNCED</span>
                             </div>
                             <div className="flex flex-col gap-0.5">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Accession Number</span>
                                <div className="bg-white border border-blue-100 rounded px-2 py-1.5 shadow-inner">
                                   <span className="text-[11px] font-mono font-black text-blue-700 tracking-[0.1em] break-all leading-none">
                                     {accessionNum}
                                   </span>
                                </div>
                             </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {deptOrders.length === 0 && (
                    <div className="h-40 flex flex-col items-center justify-center opacity-10 pointer-events-none">
                      <i className={`fas ${dept.icon} text-3xl mb-2`}></i>
                      <p className="text-[9px] font-black uppercase tracking-widest">No active orders</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div 
        onDragOver={(e) => { e.preventDefault(); if (draggedItemType === 'order') setIsDropZoneOver(true); }}
        onDragLeave={() => setIsDropZoneOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDropZoneOver(false); if (draggedItemId && draggedItemType === 'order') handleCompleteOrder(draggedItemId); }}
        className={`w-14 flex flex-col border-l transition-all duration-300 z-30 relative overflow-hidden ${isDropZoneOver ? 'bg-emerald-600 border-emerald-500 ring-4 ring-emerald-400 ring-inset' : draggedItemType === 'order' ? 'bg-slate-800 border-slate-700 animate-pulse' : 'bg-slate-900 border-slate-800'}`}
      >
        <div className="flex-1 flex flex-col items-center py-6 gap-12 pointer-events-none">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 ${isDropZoneOver ? 'bg-white text-emerald-600 scale-125' : 'bg-slate-700 text-emerald-400 shadow-lg'}`}><i className={`fas ${isDropZoneOver ? 'fa-check-double' : 'fa-check'} text-lg`}></i></div>
          <div className="flex items-center gap-4 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}><span className={`text-[11px] font-black uppercase tracking-[0.5em] transition-colors duration-300 ${isDropZoneOver ? 'text-white' : 'text-slate-400'}`}>{isDropZoneOver ? 'RELEASE TO FINISH' : 'DRAG TO COMPLETE'}</span></div>
        </div>
      </div>

      {isModalOpen && (
        <OrderModal 
          isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingOrder(null); setPreSelectedDept(null); }}
          editingOrder={editingOrder} draftOrder={preSelectedDept ? { department: preSelectedDept, patient_id: activePatient?.id, patient_name: activePatient?.name } : undefined}
          vets={vets} activeSoapId={currentSoap?.id} isSubmitting={false} clinicSettings={clinicSettings} onImageDoubleClick={onImageDoubleClick}
          onSave={async (vName, det, items, vId, sId, dept, imgs, status) => {
            const soapId = sId || currentSoap?.id;
            if (editingOrder) await supabase.from('department_orders').update({ vet_name: vName, request_details: det, items, department: dept, images: imgs, status, soap_id: soapId }).eq('id', editingOrder.id);
            else await supabase.from('department_orders').insert([{ patient_id: activePatient?.id, patient_name: activePatient?.name, vet_name: vName, request_details: det, items, department: dept, images: imgs, status, soap_id: soapId }]);
            setIsModalOpen(false); setEditingOrder(null); setPreSelectedDept(null); fetchOrders(); 
          }}
          onDelete={async () => { if (editingOrder) { await supabase.from('department_orders').delete().eq('id', editingOrder.id); setIsModalOpen(false); setEditingOrder(null); setPreSelectedDept(null); fetchOrders(); } }}
        />
      )}

      {dicomViewerAccession && (
        <DicomViewer
          accessionNumber={dicomViewerAccession}
          patientName={dicomViewerPatientName}
          onClose={() => setDicomViewerAccession(null)}
        />
      )}
    </div>
  );
};
