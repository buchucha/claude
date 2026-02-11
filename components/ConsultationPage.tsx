
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SOAPRecord, Patient, Veterinarian, ClinicSettings, SOAPField, DepartmentType, BillingItem, OrderImage, WaitlistEntry } from '../types';
import { supabase } from '../services/supabaseClient';
import { PatientSidebar } from './PatientSidebar';
import { SOAPEditor } from './SOAPEditor';
import { HistoryCard } from './HistoryCard';
import { OrderModal } from './OrderModal';
import { SelectionModal } from './SelectionModal';
import { PacsViewer } from './PacsViewer';
import { 
  getDiagnosticSuggestions, 
  getDifferentialDiagnoses, 
  getTxSuggestions, 
  getRxSuggestions, 
  getSummarySuggestions 
} from '../services/geminiService';

interface ConsultationPageProps {
  activePatient: Patient | null;
  onImageDoubleClick: (src: string) => void;
  vets: Veterinarian[];
  clinicSettings: ClinicSettings;
  patients: Patient[];
  waitlist: WaitlistEntry[];
  onSelectPatient: (id: string) => void;
  onAddToWaitlist: (entry: Partial<WaitlistEntry>) => Promise<void>;
  onUpdateWaitlist: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  onRemoveFromWaitlist: (id: string) => Promise<void>;
  activeSoapCc?: string | null;
  onActiveSoapChange?: (cc: string | null) => void;
  currentSoap: Partial<SOAPRecord>;
  onUpdateSoap: (updated: Partial<SOAPRecord>) => void;
}

export const ConsultationPage: React.FC<ConsultationPageProps> = ({ 
  activePatient, onImageDoubleClick, vets, clinicSettings,
  patients, waitlist, onSelectPatient, onAddToWaitlist, onUpdateWaitlist, onRemoveFromWaitlist,
  activeSoapCc, onActiveSoapChange, currentSoap, onUpdateSoap
}) => {
  const [activeStep, setActiveStep] = useState<'S' | 'O' | 'A' | 'P'>('S');
  const [history, setHistory] = useState<SOAPRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  
  const [aiModal, setAiModal] = useState<{ 
    isOpen: boolean; title: string; icon: string; field: keyof SOAPRecord; options: any[]; isLoading: boolean; 
  }>({ isOpen: false, title: '', icon: '', field: 'subjective', options: [], isLoading: false });

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isPacsOpen, setIsPacsOpen] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedVets, setCollapsedVets] = useState<Record<string, boolean>>({});
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'patient' | 'waitlist' | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (activeSoapCc === null && currentSoap.id) {
      onUpdateSoap({ subjective: '', objective: '', assessmentProblems: '', assessmentDdx: [], planTx: '', planRx: '', planSummary: '', patientId: activePatient?.id });
      setActiveStep('S');
    }
  }, [activeSoapCc, currentSoap.id, activePatient?.id, onUpdateSoap]);

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
    if (query.length < 1) return [];
    return patients.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.owner.toLowerCase().includes(query) || 
      p.phone.includes(query) ||
      (p.chartNumber || '').toLowerCase().includes(query)
    );
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

  const fetchHistory = useCallback(async () => {
    if (!activePatient) return;
    const { data, error } = await supabase
      .from('soap_records')
      .select('*, department_orders!soap_records_order_id_fkey(id, images)')
      .eq('patient_id', activePatient.id)
      .order('date', { ascending: false });
    if (error) { console.error("Error fetching history:", error); return; }
    if (data) {
        setHistory(data.map((db: any) => {
            const linkedOrder = db.department_orders;
            const orderImages = (linkedOrder?.images || []).map((img: any) => typeof img === 'string' ? img : img.url).filter(Boolean);
            return { id: db.id, patientId: db.patient_id, order_id: db.order_id, date: db.date, cc: db.cc, subjective: db.subjective, objective: db.objective, assessment_problems: db.assessment_problems, assessment_ddx: db.assessment_ddx || [], plan_tx: db.plan_tx, plan_rx: db.plan_rx, plan_summary: db.plan_summary, images: orderImages };
        }));
    }
  }, [activePatient]);

  useEffect(() => { 
      if (activePatient) { fetchHistory(); }
  }, [activePatient?.id, fetchHistory]);

  const handleUpdateSoapField = (field: string, value: any) => {
    onUpdateSoap({ ...currentSoap, [field]: value });
  };

  const handleSaveSoap = async () => {
    if (!activePatient) return;
    setIsSaving(true);
    try {
      const payload = { patient_id: activePatient.id, date: currentSoap.date || new Date().toISOString().split('T')[0], cc: currentSoap.cc, subjective: currentSoap.subjective, objective: currentSoap.objective, assessment_problems: currentSoap.assessmentProblems, assessment_ddx: currentSoap.assessmentDdx, plan_tx: currentSoap.planTx, plan_rx: currentSoap.planRx, plan_summary: currentSoap.planSummary };
      
      const { data, error } = currentSoap.id 
        ? await supabase.from('soap_records').update(payload).eq('id', currentSoap.id).select() 
        : await supabase.from('soap_records').insert([payload]).select();

      if (!error && data) {
        const savedSoap = data[0];
        onUpdateSoap({ 
          ...currentSoap, 
          id: savedSoap.id,
          assessmentProblems: savedSoap.assessment_problems,
          assessmentDdx: savedSoap.assessment_ddx,
          planTx: savedSoap.plan_tx,
          planRx: savedSoap.plan_rx,
          planSummary: savedSoap.plan_summary
        });
        if (onActiveSoapChange) onActiveSoapChange(savedSoap.cc || 'Record Saved');
        fetchHistory();
      } else if (error) {
        alert('진료 기록 저장 중 오류가 발생했습니다: ' + error.message);
      }
    } finally { setIsSaving(false); }
  };

  const handleDeleteImage = async (soapId: string, urlToDelete: string) => {
    if (!window.confirm('이미지를 삭제하시겠습니까? (연동된 오더 원본에서 삭제됩니다)')) return;
    const soapEntry = history.find(h => h.id === soapId);
    if (!soapEntry || !soapEntry.order_id) return;
    const { data: orderData } = await supabase.from('department_orders').select('images').eq('id', soapEntry.order_id).single();
    if (!orderData) return;
    const newOrderImages = (orderData.images || []).filter((img: any) => { const url = typeof img === 'string' ? img : img.url; return url !== urlToDelete; });
    await supabase.from('department_orders').update({ images: newOrderImages }).eq('id', soapEntry.order_id);
    fetchHistory();
    if (currentSoap.id === soapId) { onUpdateSoap({ ...currentSoap, images: newOrderImages.map((i: any) => typeof i === 'string' ? i : i.url) }); }
  };

  const handleAILoad = async (type: 'test' | 'ddx' | 'tx' | 'rx' | 'summary') => {
    if (!activePatient) return;
    setAiModal(prev => ({ ...prev, isOpen: true, isLoading: true }));
    let res: any = null;
    let title = '', icon = '', field: keyof SOAPRecord = 'subjective';
    if (type === 'test') { res = await getDiagnosticSuggestions(activePatient, currentSoap); title = 'AI Diagnostic Tests'; icon = 'fa-microscope'; field = 'objective'; }
    else if (type === 'ddx') { res = await getDifferentialDiagnoses(activePatient, currentSoap); title = 'AI Differential Diagnosis'; icon = 'fa-brain'; field = 'assessmentProblems'; }
    else if (type === 'tx') { res = await getTxSuggestions(activePatient, currentSoap); title = 'AI Treatment Plan'; icon = 'fa-hand-holding-medical'; field = 'planTx'; }
    else if (type === 'rx') { res = await getRxSuggestions(activePatient, currentSoap); title = 'AI Medication Plan'; icon = 'fa-pills'; field = 'planRx'; }
    else if (type === 'summary') { res = await getSummarySuggestions(activePatient, currentSoap); title = 'AI Discharge Summary'; icon = 'fa-file-medical-alt'; field = 'planSummary'; }
    const options = res ? (res.suggestions || res.diagnoses || [res]).map((x: any, i: number) => ({ id: String(i), title: x.testName || x.name || x.txName || x.medName || 'Summary Result', subtitle: x.reason || x.details || x.caution || Object.values(res).join('\n'), extra: x.priority || x.confidence || '', fullContent: `[${x.testName || x.name || x.txName || x.medName || ''}] ${x.reason || x.details || x.caution || ''}` })) : [];
    setAiModal({ isOpen: true, title, icon, field, options, isLoading: false });
  };

  const applyAI = (contents: string[]) => {
    const field = aiModal.field;
    const current = (currentSoap as any)[field] || '';
    handleUpdateSoapField(field, current + (current ? '\n' : '') + contents.join('\n'));
  };

  const loadHistoryToEditor = (entry: SOAPRecord) => {
    onUpdateSoap(entry);
    setActiveStep('S');
    if (onActiveSoapChange) onActiveSoapChange(entry.cc || 'Existing Record');
  };

  const handleOpenOrder = () => {
    if (!currentSoap.id) {
      alert('⚠️ 진료 기록이 아직 저장되지 않았습니다.\n\n모든 오더(검사/처치)는 특정 진료 기록과 연결되어야 합니다. 하단의 [Finish & Save Chart] 버튼을 눌러 기록을 먼저 저장해 주세요.');
      return;
    }
    setIsOrderModalOpen(true);
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
        onDragEnd={() => { setDraggedItemId(null); setDraggedItemType(null); setDragOverId(null); }}
        onDrop={async (e, targetVetId) => {
          setDragOverId(null);
          const dragId = e.dataTransfer.getData('drag-id') || e.dataTransfer.getData('text/plain') || draggedItemId;
          const dragType = e.dataTransfer.getData('drag-type') || draggedItemType;

          if (!dragId || !dragType) return;
          if (dragType === 'waitlist') {
            await onUpdateWaitlist(dragId, { vetId: targetVetId });
          } else if (dragType === 'patient') {
            const p = patients.find(pat => pat.id === dragId);
            if (p) {
              await onAddToWaitlist({ 
                patientId: p.id, 
                patientName: p.name, 
                breed: p.breed, 
                ownerName: p.owner, 
                vetId: targetVetId, 
                type: 'Consultation' 
              });
            }
          }
        }}
        onStartResizing={() => setIsResizingSidebar(true)} dragOverId={dragOverId} setDragOverId={setDragOverId}
      />
      <div className="flex-1 flex flex-col min-w-0 bg-white shadow-inner border-r border-slate-300">
        <div className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-sm">
              {(['S', 'O', 'A', 'P'] as const).map(step => (
                <button 
                  key={step} 
                  onClick={() => setActiveStep(step)} 
                  className={`px-6 py-1 text-[11px] font-black uppercase tracking-wider rounded-md transition-all ${activeStep === step ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {step}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-slate-300"></div>
            <button 
              onClick={() => setIsPacsOpen(true)} 
              className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
            >
              <i className="fas fa-x-ray mr-2"></i> Open PACS
            </button>
            <button 
              onClick={handleOpenOrder} 
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 ${
                !currentSoap.id 
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed grayscale' 
                  : 'bg-slate-800 text-white hover:bg-black'
              }`}
            >
              <i className="fas fa-paper-plane text-[9px]"></i> 
              Send Order
              {!currentSoap.id && <i className="fas fa-lock text-[8px] opacity-60"></i>}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {!currentSoap.id && <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded uppercase tracking-tighter animate-pulse border border-rose-100">Save required for orders</span>}
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Live Reference: Order DB</span>
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden">
          {!activePatient ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <i className="fas fa-user-md text-4xl mb-4 opacity-50"></i>
              <p className="font-black uppercase tracking-[0.2em] text-xs">Select a patient to start charting</p>
            </div>
          ) : (
            <SOAPEditor 
              activeStep={activeStep} 
              onStepChange={setActiveStep} 
              record={currentSoap} 
              onUpdate={handleUpdateSoapField as any} 
              isSaving={isSaving} 
              onSave={handleSaveSoap} 
              onImageDoubleClick={onImageDoubleClick} 
              clinicSettings={clinicSettings} 
              onDeleteImage={handleDeleteImage} 
              onSuggestTests={() => handleAILoad('test')} 
              onSuggestDdx={() => handleAILoad('ddx')} 
              onSuggestTx={() => handleAILoad('tx')} 
              onSuggestRx={() => handleAILoad('rx')} 
              onSuggestSummary={() => handleAILoad('summary')} 
            />
          )}
        </div>
      </div>
      <div className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-200 bg-white shadow-sm flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-history text-blue-500"></i> Clinical History
          </h3>
          <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-1.5 py-0.5 rounded">{history.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {!activePatient ? (
            <div className="h-full flex items-center justify-center text-slate-300">
              <p className="font-black uppercase tracking-widest text-[9px]">No Patient Selected</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-20 text-center opacity-20">
              <i className="fas fa-folder-open text-4xl mb-3"></i>
              <p className="text-[10px] font-black uppercase">No History Found</p>
            </div>
          ) : (
            history.map(entry => (
              <HistoryCard 
                key={entry.id} 
                entry={entry} 
                isExpanded={expandedHistoryId === entry.id} 
                onToggle={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)} 
                onLoadRecord={loadHistoryToEditor} 
                onImageDoubleClick={onImageDoubleClick} 
                onDeleteImage={handleDeleteImage} 
              />
            ))
          )}
        </div>
      </div>
      {isOrderModalOpen && (
        <OrderModal 
          isOpen={isOrderModalOpen} 
          onClose={() => setIsOrderModalOpen(false)} 
          vets={vets} 
          clinicSettings={clinicSettings} 
          activeSoapId={currentSoap.id} 
          draftOrder={{ patient_id: activePatient?.id, patient_name: activePatient?.name }} 
          isSubmitting={false} 
          onImageDoubleClick={onImageDoubleClick}
          onSave={async (vName, det, items, vId, sId, dept, imgs, status) => { 
            const soapId = sId || currentSoap.id;
            if (!soapId) {
              alert('SOAP ID가 유실되었습니다. 다시 시도해 주세요.');
              return;
            }
            const { data: newOrder } = await supabase.from('department_orders').insert([{ 
              patient_id: activePatient?.id, 
              patient_name: activePatient?.name, 
              soap_id: soapId, 
              department: dept, 
              vet_name: vName, 
              request_details: det, 
              status, 
              items, 
              images: imgs 
            }]).select().single(); 
            
            if (soapId && newOrder) { 
              await supabase.from('soap_records').update({ order_id: newOrder.id }).eq('id', soapId); 
              fetchHistory(); 
            } 
            setIsOrderModalOpen(false); 
          }} 
        />
      )}
      {isPacsOpen && activePatient && (<PacsViewer chartNumber={activePatient.chartNumber || ''} patientName={activePatient.name} onClose={() => setIsPacsOpen(false)} />)}
      {aiModal.isOpen && (<SelectionModal isOpen={aiModal.isOpen} onClose={() => setAiModal(prev => ({ ...prev, isOpen: false }))} title={aiModal.title} icon={aiModal.icon} options={aiModal.options} isLoading={aiModal.isLoading} onConfirm={(selected) => applyAI(selected)} />)}
    </div>
  );
};
