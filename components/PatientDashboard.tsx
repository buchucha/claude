
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Patient, PatientWeight, PatientVaccination, PatientReminders, PatientParasites, Species } from '../types';
import { supabase } from '../services/supabaseClient';

interface PatientDashboardProps {
  patient: Patient | null;
  onUpdatePatient: (updates: Partial<Patient>) => Promise<void>;
}

type SectionId = 'memo' | 'weight' | 'monitoring' | 'vaccines';

const VACCINE_SKU_MAP: Record<string, string> = {
  'DHPPL': 'VAC-DHPPL',
  'Corona': 'VAC-COR',
  'Kennel Cough': 'VAC-KC',
  'Rabies': 'VAC-RAB',
  'FVRC P+C': 'VAC-CVRP',
  'FVRC P+C + Leukemia': 'VAC-CVRP',
  'Influenza': 'VAC-CIV'
};

const formatDateForInput = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

/**
 * 날짜의 차이에 따라 색상 클래스를 반환합니다.
 * - 지난 날짜: 빨간색 (rose-600)
 * - 7일 이내: 초록색 (emerald-600)
 * - 그 외: 기본 파란색 (blue-950)
 */
const getDateColorClass = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'text-blue-950';
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'text-rose-600'; // 기간 지남
  if (diffDays <= 7) return 'text-emerald-600'; // 7일 이내 임박
  return 'text-blue-950'; // 여유 있음
};

const MiniCalendar: React.FC<{
  initialDate?: string | null;
  onSelect: (date: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}> = ({ initialDate, onSelect, onClose, position }) => {
  const [viewDate, setViewDate] = useState(initialDate ? new Date(initialDate) : new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div 
      ref={calendarRef}
      className="fixed z-[200] bg-white border border-slate-300 shadow-2xl rounded-lg p-2 w-48 animate-in zoom-in-95 duration-150"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-2 px-1">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="text-slate-400 hover:text-blue-600"><i className="fas fa-chevron-left text-[10px]"></i></button>
        <span className="text-[10px] font-black text-slate-900 uppercase">{year}.{String(month + 1).padStart(2, '0')}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="text-slate-400 hover:text-blue-600"><i className="fas fa-chevron-right text-[10px]"></i></button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['S','M','T','W','T','F','S'].map(d => (
          <div key={d} className="text-[8px] font-black text-slate-400 text-center">{d}</div>
        ))}
        {days.map((day, idx) => (
          <div 
            key={idx}
            onClick={() => day && onSelect(new Date(year, month, day + 1).toISOString().split('T')[0])}
            className={`h-5 flex items-center justify-center text-[10px] rounded cursor-pointer transition-colors ${
              day ? 'hover:bg-blue-600 hover:text-white font-bold text-slate-700' : ''
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      <button 
        onClick={() => onSelect(new Date().toISOString().split('T')[0])}
        className="w-full mt-2 py-1 bg-slate-100 hover:bg-slate-200 text-[9px] font-black text-slate-600 rounded uppercase"
      >
        Today
      </button>
    </div>
  );
};

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ patient, onUpdatePatient }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [weights, setWeights] = useState<PatientWeight[]>([]);
  const [vaccinations, setVaccinations] = useState<PatientVaccination[]>([]);
  const [reminders, setReminders] = useState<PatientReminders | null>(null);
  const [parasites, setParasites] = useState<PatientParasites | null>(null);
  const [newWeight, setNewWeight] = useState('');
  
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(['weight', 'monitoring', 'memo', 'vaccines']);
  const [draggedSection, setDraggedSection] = useState<SectionId | null>(null);
  const [dragOverSection, setDragOverSection] = useState<SectionId | null>(null);
  const [gridSplit, setGridSplit] = useState({ x: 50, y: 50 });
  const [isResizingGrid, setIsResizingGrid] = useState(false);
  
  const [pickerTarget, setPickerTarget] = useState<{ 
    field: string, 
    type: 'vaccine' | 'reminder' | 'parasite',
    key: string,
    x: number, 
    y: number 
  } | null>(null);
  
  const [editingWeight, setEditingWeight] = useState<PatientWeight | null>(null);
  const [isEditingMedInfo, setIsEditingMedInfo] = useState(false);
  const [medInfoInput, setMedInfoInput] = useState('');
  const [editingVaccineRound, setEditingVaccineRound] = useState<string | null>(null);
  const [editingMedInterval, setEditingMedInterval] = useState(false);

  const [localMemo, setLocalMemo] = useState(patient?.medical_memo || '');

  useEffect(() => {
    setLocalMemo(patient?.medical_memo || '');
  }, [patient?.medical_memo]);

  useEffect(() => {
    if (reminders && !isEditingMedInfo) {
      setMedInfoInput(reminders.long_term_med_info || '');
    }
  }, [reminders, isEditingMedInfo]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingWeight(null);
        setPickerTarget(null);
        setIsEditingMedInfo(false);
        setEditingVaccineRound(null);
        setEditingMedInterval(false);
      }
    };
    window.addEventListener('keydown', handleEsc, { capture: true });
    return () => window.removeEventListener('keydown', handleEsc, { capture: true });
  }, []);

  const fetchExtraData = useCallback(async () => {
    if (!patient?.id) return;
    
    const wRes = await supabase.from('patient_weights').select('*').eq('patient_id', patient.id).order('recorded_at', { ascending: false }).limit(7);
    if (wRes.data) setWeights(wRes.data);

    const vaccineTable = patient.species === Species.CAT ? 'patient_vaccination_feline' : 'patient_vaccination_canine';
    const vRes = await supabase.from(vaccineTable).select('*').eq('patient_id', patient.id);
    if (vRes.data) setVaccinations(vRes.data);

    const rRes = await supabase.from('patient_reminders').select('*').eq('patient_id', patient.id).single();
    if (rRes.data) setReminders(rRes.data);
    else setReminders(null);

    const pRes = await supabase.from('patient_parasites').select('*').eq('patient_id', patient.id).single();
    if (pRes.data) setParasites(pRes.data);
    else setParasites(null);

  }, [patient?.id, patient?.species]);

  useEffect(() => { 
    if (patient?.id) fetchExtraData(); 
  }, [fetchExtraData, patient?.id]);

  const handleBlurSave = async (field: keyof Patient, value: string) => {
    await onUpdatePatient({ [field]: value });
  };

  const handleAddWeight = async () => {
    if (!patient?.id) return;
    if (!newWeight || isNaN(parseFloat(newWeight))) return;
    const weightVal = parseFloat(newWeight);
    const { data, error } = await supabase.from('patient_weights').insert([{
        patient_id: patient.id,
        weight: weightVal,
        recorded_at: new Date().toISOString()
    }]).select();

    if (!error && data) {
         setWeights(prev => [data[0], ...prev]);
         setNewWeight('');
         await onUpdatePatient({ weight: weightVal });
    }
  };

  const handleWeightUpdate = async (id: string, weight: number) => {
    const { error } = await supabase.from('patient_weights').update({ weight }).eq('id', id);
    if (!error) {
        setWeights(prev => prev.map(w => w.id === id ? { ...w, weight } : w));
        setEditingWeight(null);
        if (weights.length > 0 && weights[0].id === id) {
           await onUpdatePatient({ weight });
        }
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => { e.preventDefault(); setIsResizingGrid(true); };
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingGrid || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setGridSplit({
      x: Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(20, Math.min(80, ((e.clientY - rect.top) / rect.height) * 100))
    });
  }, [isResizingGrid]);
  const handleMouseUp = useCallback(() => setIsResizingGrid(false), []);
  useEffect(() => {
    if (isResizingGrid) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingGrid, handleMouseMove, handleMouseUp]);

  if (!patient) return <div className="h-full flex items-center justify-center text-slate-300 text-xs font-black uppercase">Select Patient</div>;

  const calculateNextDate = (lastDate: string, type: string, round: number = 0) => {
    if (!lastDate) return '';
    const date = new Date(lastDate);
    if (type === 'heartworm' || type === 'external') date.setMonth(date.getMonth() + 1);
    else if (type === 'internal') date.setMonth(date.getMonth() + 3);
    else if (type === 'scaling' || type === 'antibody') date.setFullYear(date.getFullYear() + 1);
    else if (type === 'med') {
      const interval = reminders?.med_interval_days || 30;
      date.setDate(date.getDate() + interval);
    }
    else if (type === 'DHPPL' || type === 'Corona' || type === 'Kennel Cough' || type === 'Influenza') {
      if (round >= (type === 'DHPPL' ? 5 : 2)) date.setFullYear(date.getFullYear() + 1);
      else date.setDate(date.getDate() + 14);
    }
    else if (['FVRC P+C', 'FVRC P+C + Leukemia'].includes(type)) {
       if (round >= 3) date.setFullYear(date.getFullYear() + 1);
       else date.setDate(date.getDate() + 21);
    }
    else if (type === 'Rabies') date.setFullYear(date.getFullYear() + 1);

    return date.toISOString().split('T')[0];
  };

  const updateVaccine = async (name: string, round: number, date: string | null, nextDateOverride?: string | null) => {
    let next = nextDateOverride;
    if (date && !next) next = calculateNextDate(date, name, round);
    const table = patient.species === Species.CAT ? 'patient_vaccination_feline' : 'patient_vaccination_canine';
    const { error } = await supabase.from(table).upsert({ 
      patient_id: patient.id, vaccine_name: name, current_round: round, last_date: date || null, next_date: next || null 
    }, { onConflict: 'patient_id, vaccine_name' });
    
    if (!error) {
       fetchExtraData();
       if (date && patient?.id) {
          const sku = VACCINE_SKU_MAP[name];
          if (sku) {
             try {
               const { data: catalogItem } = await supabase
                 .from('service_catalog')
                 .select('*')
                 .ilike('sku_code', sku) 
                 .single();
               
               if (catalogItem) {
                 let { data: invoice } = await supabase.from('billing_invoices').select('id').eq('patient_id', patient.id).eq('status', 'Unpaid').single();
                 if (!invoice) {
                    const { data: newInv } = await supabase.from('billing_invoices').insert({ patient_id: patient.id, status: 'Unpaid' }).select().single();
                    invoice = newInv;
                 }
                 if (invoice) {
                    await supabase.from('billing_items').insert({
                      invoice_id: invoice.id,
                      service_id: catalogItem.id,
                      item_name: catalogItem.name,
                      category: catalogItem.category,
                      unit_price: catalogItem.default_price,
                      quantity: 1,
                      total_price: catalogItem.default_price,
                      created_at: new Date().toISOString()
                    });
                 }
               }
             } catch (billError) {
               console.error("Auto-billing failed:", billError);
             }
          }
       }
    }
  };

  const updateReminder = async (fieldPrefix: string, lastDate: string | null, nextDateOverride?: string | null, extraData?: Partial<PatientReminders>) => {
    let next = nextDateOverride;
    if (lastDate && next === undefined) next = calculateNextDate(lastDate, fieldPrefix);
    const updates: any = { patient_id: patient.id, ...extraData };
    if (lastDate !== undefined) updates[`last_${fieldPrefix}_date`] = lastDate;
    if (next !== undefined) updates[`next_${fieldPrefix}_date`] = next;
    const { error } = await supabase.from('patient_reminders').upsert(updates, { onConflict: 'patient_id' });
    if (!error) fetchExtraData();
  };

  const updateParasite = async (fieldPrefix: string, lastDate: string | null, nextDateOverride?: string | null) => {
    let next = nextDateOverride;
    if (lastDate && next === undefined) next = calculateNextDate(lastDate, fieldPrefix);
    const updates: any = { patient_id: patient.id };
    if (lastDate !== undefined) updates[`last_${fieldPrefix}_date`] = lastDate;
    if (next !== undefined) updates[`next_${fieldPrefix}_date`] = next;
    const { error } = await supabase.from('patient_parasites').upsert(updates, { onConflict: 'patient_id' });
    if (!error) fetchExtraData();
  };

  const handleDateDoubleClick = (e: React.MouseEvent, type: 'vaccine'|'reminder'|'parasite', key: string, field: string) => {
    e.preventDefault();
    setPickerTarget({ type, key, field, x: e.clientX, y: Math.min(e.clientY, window.innerHeight - 250) });
  };

  const handleCalendarSelect = async (selectedDate: string) => {
    if (!pickerTarget) return;
    const { type, key, field } = pickerTarget;
    if (type === 'vaccine') {
      const v = vaccinations.find(x => x.vaccine_name === key);
      const isNext = field.includes('next');
      let newRound = v?.current_round || 0;
      if (!isNext) newRound += 1;
      await updateVaccine(key, newRound, isNext ? (v?.last_date || null) : selectedDate, isNext ? selectedDate : null);
    } else if (type === 'reminder') {
      const currentLast = (reminders as any)?.[`last_${key}_date`];
      await updateReminder(key, field.includes('next') ? currentLast : selectedDate, field.includes('next') ? selectedDate : undefined);
    } else if (type === 'parasite') {
      const currentLast = (parasites as any)?.[`last_${key}_date`];
      await updateParasite(key, field.includes('next') ? currentLast : selectedDate, field.includes('next') ? selectedDate : undefined);
    }
    setPickerTarget(null);
  };

  const renderWeightChart = () => {
    if (weights.length === 0) return <div className="text-[10px] text-slate-500 text-center py-4 italic font-bold">No records</div>;
    const rawMax = Math.max(...weights.map(w => w.weight), 1);
    const chartMax = rawMax + 0.5;
    const padding = { top: 4, bottom: 8, left: 10, right: 4 };
    const width = 100; const height = 100;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const gap = chartWidth / weights.length;
    const barWidth = Math.max(0.5, gap * 0.4);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} stroke="#000000" strokeWidth="0.2" />
        {[0, chartMax / 2, chartMax].map((val, idx) => {
          const yPos = padding.top + chartHeight - (val / chartMax) * chartHeight;
          return (
            <g key={idx}>
              <line x1={padding.left - 0.5} y1={yPos} x2={width - padding.right} y2={yPos} stroke="#e2e8f0" strokeWidth="0.1" />
              <text x={padding.left - 2} y={yPos + 0.6} textAnchor="end" className="fill-slate-900 font-black" style={{ fontSize: '3px' }}>{val.toFixed(1)}</text>
            </g>
          );
        })}
        {[...weights].reverse().map((w, i) => {
          const barHeight = (w.weight / chartMax) * chartHeight;
          const x = padding.left + (i * gap) + (gap / 2) - (barWidth / 2);
          const y = padding.top + chartHeight - barHeight;
          return (
            <g key={i} onDoubleClick={() => setEditingWeight(w)} className="cursor-pointer group">
              <rect x={x} y={y} width={barWidth} height={barHeight} fill={i === weights.length - 1 ? "#2563eb" : "#475569"} rx="0.1" className="group-hover:fill-blue-400" />
              <text x={x + barWidth/2} y={y - 1.5} textAnchor="middle" className="font-black fill-black" style={{ fontSize: '3.5px' }}>{w.weight}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  const sections: Record<SectionId, React.ReactNode> = {
    memo: (
      <div 
        key="memo"
        className="bg-white border border-slate-300 p-2 flex flex-col overflow-hidden rounded-sm"
        draggable onDragStart={() => setDraggedSection('memo')} onDragOver={(e) => { e.preventDefault(); setDragOverSection('memo'); }} onDrop={() => { 
          if(draggedSection && draggedSection !== 'memo') {
             const newOrder = [...sectionOrder];
             const dI = newOrder.indexOf(draggedSection); const tI = newOrder.indexOf('memo');
             [newOrder[dI], newOrder[tI]] = [newOrder[tI], newOrder[dI]];
             setSectionOrder(newOrder);
          }
        }}
      >
        <div className="flex items-center gap-1.5 mb-1 border-b border-slate-300 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
          <i className="fas fa-sticky-note text-blue-700 text-[9px]"></i>
          <span className="text-[10px] font-black text-slate-950 uppercase tracking-tighter">Clinical Notes</span>
        </div>
        <textarea
          value={localMemo}
          onChange={(e) => setLocalMemo(e.target.value)}
          onBlur={() => handleBlurSave('medical_memo', localMemo)}
          className="flex-1 bg-slate-50 border border-slate-200 rounded p-1.5 text-[11px] text-slate-950 font-bold outline-none focus:bg-white focus:border-blue-500 resize-none"
        />
      </div>
    ),
    weight: (
      <div key="weight" className="bg-white border border-slate-300 p-2 flex flex-col overflow-hidden rounded-sm">
        <div className="flex items-center justify-between mb-1 border-b border-slate-300 pb-1 flex-shrink-0">
          <div className="flex items-center gap-1.5"><i className="fas fa-chart-line text-blue-700 text-[9px]"></i><span className="text-[10px] font-black text-slate-950 uppercase tracking-tighter">Weight History</span></div>
          <div className="flex gap-1"><input type="number" step="0.1" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="w-11 h-5 bg-slate-50 border border-slate-300 rounded text-[10px] px-1 outline-none font-black" placeholder="0.0" /><button onClick={handleAddWeight} className="h-5 px-2 bg-slate-900 text-white rounded text-[9px] font-black">ADD</button></div>
        </div>
        <div className="flex-1 relative overflow-hidden bg-slate-50 rounded border border-slate-100 p-0.5">{renderWeightChart()}</div>
      </div>
    ),
    monitoring: (
      <div key="monitoring" className="bg-white border border-slate-300 p-2 overflow-y-auto custom-scrollbar rounded-sm">
        <div className="flex items-center gap-1.5 mb-1 border-b border-slate-300 pb-1"><i className="fas fa-clipboard-check text-blue-700 text-[9px]"></i><span className="text-[10px] font-black text-slate-950 uppercase tracking-tighter">Recurring Items</span></div>
        <div className="space-y-2 mt-1.5">
          {[
            { label: 'Long-term Med', id: 'med', data: reminders },
            { label: 'Scaling', id: 'scaling', data: reminders },
            { label: 'Antibody', id: 'antibody', data: reminders }
          ].map(item => {
            const nextDateVal = (item.data as any)?.[`next_${item.id}_date`];
            return (
              <div key={item.id} className="bg-slate-50 p-2 border border-slate-200 rounded flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-slate-900 w-24">{item.label}</span>
                  <div className="flex gap-1 items-center flex-1">
                    <input type="date" readOnly value={formatDateForInput((item.data as any)?.[`last_${item.id}_date`])} onDoubleClick={(e) => handleDateDoubleClick(e, 'reminder', item.id, 'last')} className="bg-white border border-slate-300 rounded text-[11px] text-slate-950 p-0.5 outline-none flex-1 font-black cursor-pointer" />
                    <span className="text-[11px] text-slate-950 font-black">→</span>
                    <input 
                      type="date" 
                      readOnly 
                      value={formatDateForInput(nextDateVal)} 
                      onDoubleClick={(e) => handleDateDoubleClick(e, 'reminder', item.id, 'next')} 
                      className={`bg-blue-50 border-blue-200 rounded text-[11px] p-0.5 flex-1 font-black cursor-pointer outline-none transition-colors ${getDateColorClass(nextDateVal)}`} 
                    />
                  </div>
                </div>
                {item.id === 'med' && (
                  <div className="pl-1 border-l-2 border-blue-200 ml-1 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <input 
                          type="text" value={isEditingMedInfo ? medInfoInput : (reminders?.long_term_med_info || '')} placeholder="[Medication Info]" readOnly={!isEditingMedInfo}
                          onDoubleClick={() => { setMedInfoInput(reminders?.long_term_med_info || ''); setIsEditingMedInfo(true); }}
                          onChange={(e) => setMedInfoInput(e.target.value)}
                          onBlur={() => { setIsEditingMedInfo(false); if (reminders?.long_term_med_info !== medInfoInput) updateReminder('med', undefined, undefined, { long_term_med_info: medInfoInput }); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          className={`flex-1 text-[10px] p-1 rounded font-black outline-none transition-all ${isEditingMedInfo ? 'bg-white border border-blue-500' : 'bg-transparent text-slate-500 hover:bg-slate-100/50'}`}
                        />
                        <div className="flex items-center gap-1 bg-slate-200 rounded px-1">
                          <i className="fas fa-clock text-[8px] text-slate-500"></i>
                          {editingMedInterval ? (
                            <input autoFocus type="number" className="w-8 text-[9px] bg-white text-center outline-none" defaultValue={reminders?.med_interval_days || 30} onBlur={(e) => { setEditingMedInterval(false); updateReminder('med', undefined, undefined, { med_interval_days: parseInt(e.target.value) || 30 }); }} />
                          ) : (
                            <span onDoubleClick={() => setEditingMedInterval(true)} className="text-[9px] font-bold text-slate-600 cursor-pointer">{reminders?.med_interval_days || 30}d</span>
                          )}
                        </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    ),
    vaccines: (
      <div key="vaccines" className="bg-white border border-slate-300 p-2 overflow-y-auto custom-scrollbar rounded-sm">
        <div className="flex items-center gap-1.5 mb-1 border-b border-slate-300 pb-1"><i className="fas fa-syringe text-blue-700 text-[9px]"></i><span className="text-[10px] font-black text-slate-950 uppercase tracking-tighter">Vaccines & Parasites</span></div>
        <div className="grid grid-cols-1 gap-1.5 mt-1.5">
          {[
            { id: 'heartworm', label: 'Heartworm' },
            { id: 'external', label: 'External' },
            { id: 'internal', label: 'Internal' }
          ].map(p => {
            const nextDateVal = (parasites as any)?.[`next_${p.id}_date`];
            return (
              <div key={p.id} className="flex items-center gap-1.5 bg-slate-50 p-1.5 border border-slate-200 rounded">
                <span className="text-[10px] font-black text-slate-900 w-16">{p.label}</span>
                <input type="date" readOnly value={formatDateForInput((parasites as any)?.[`last_${p.id}_date`])} onDoubleClick={(e) => handleDateDoubleClick(e, 'parasite', p.id, 'last')} className="bg-white border border-slate-300 rounded text-[11px] text-slate-950 p-0.5 outline-none flex-1 font-black cursor-pointer" />
                <input 
                  type="date" 
                  readOnly 
                  value={formatDateForInput(nextDateVal)} 
                  onDoubleClick={(e) => handleDateDoubleClick(e, 'parasite', p.id, 'next')} 
                  className={`bg-blue-50 border-blue-200 rounded text-[11px] p-0.5 flex-1 font-black cursor-pointer outline-none transition-colors ${getDateColorClass(nextDateVal)}`} 
                />
              </div>
            );
          })}
          <div className="h-px bg-slate-300 my-0.5"></div>
          {(patient.species === Species.CAT ? ['FVRC P+C', 'FVRC P+C + Leukemia', 'Rabies'] : ['DHPPL', 'Corona', 'Kennel Cough', 'Influenza', 'Rabies']).map(vname => {
             const data = vaccinations.find(v => v.vaccine_name === vname);
             const round = data?.current_round || 0;
             const nextDateVal = data?.next_date;
             return (
               <div key={vname} className="flex items-center gap-1.5 bg-slate-50 p-1.5 border border-slate-200 rounded">
                 <span className="text-[10px] font-black text-slate-900 w-14 truncate" title={vname}>{vname}</span>
                 <div className="relative w-8 flex justify-center">
                   {editingVaccineRound === vname ? (
                     <input autoFocus type="number" defaultValue={round} onBlur={(e) => { updateVaccine(vname, parseInt(e.target.value)||0, data?.last_date||null); setEditingVaccineRound(null); }} className="w-8 h-5 text-center text-[10px] font-black border border-blue-500 rounded outline-none bg-white z-10 p-0" />
                   ) : (
                     <span onDoubleClick={() => setEditingVaccineRound(vname)} className="w-8 h-5 flex items-center justify-center text-[10px] font-black text-slate-600 bg-slate-200/50 rounded cursor-pointer hover:bg-slate-200 hover:text-blue-600">{round}차</span>
                   )}
                 </div>
                 <input type="date" readOnly value={formatDateForInput(data?.last_date)} onDoubleClick={(e) => handleDateDoubleClick(e, 'vaccine', vname, 'last')} className="bg-white border border-slate-300 rounded text-[11px] text-slate-950 p-0.5 outline-none flex-1 font-black cursor-pointer" />
                 <input 
                   type="date" 
                   readOnly 
                   value={formatDateForInput(nextDateVal)} 
                   onDoubleClick={(e) => handleDateDoubleClick(e, 'vaccine', vname, 'next')} 
                   className={`bg-blue-50 border-blue-200 rounded text-[11px] p-0.5 flex-1 font-black cursor-pointer outline-none transition-colors ${getDateColorClass(nextDateVal)}`} 
                 />
               </div>
             );
          })}
        </div>
      </div>
    )
  };

  return (
    <div 
      ref={containerRef}
      className={`relative grid gap-1 h-full bg-slate-300 p-0.5 transition-all duration-75 ${isResizingGrid ? 'cursor-move select-none' : ''}`}
      style={{ gridTemplateColumns: `${gridSplit.x}% ${100 - gridSplit.x}%`, gridTemplateRows: `${gridSplit.y}% ${100 - gridSplit.y}%` }}
    >
      {sectionOrder.map(id => sections[id])}
      <div onMouseDown={handleResizeMouseDown} className="absolute z-50 flex items-center justify-center cursor-move" style={{ left: `${gridSplit.x}%`, top: `${gridSplit.y}%`, transform: 'translate(-50%, -50%)', width: '24px', height: '24px' }}>
        <div className="w-6 h-6 rounded-full bg-white border border-slate-400 shadow-xl flex items-center justify-center"><i className="fas fa-plus text-[10px] text-slate-600"></i></div>
      </div>
      {pickerTarget && (
        <MiniCalendar 
          initialDate={
            pickerTarget.type === 'vaccine' ? vaccinations.find(v => v.vaccine_name === pickerTarget.key)?.[pickerTarget.field.includes('next')?'next_date':'last_date'] :
            pickerTarget.type === 'reminder' ? (reminders as any)?.[`${pickerTarget.field.includes('next')?'next':'last'}_${pickerTarget.key}_date`] :
            (parasites as any)?.[`${pickerTarget.field.includes('next')?'next':'last'}_${pickerTarget.key}_date`]
          }
          position={{ x: pickerTarget.x, y: pickerTarget.y }}
          onSelect={handleCalendarSelect}
          onClose={() => setPickerTarget(null)}
        />
      )}
      {editingWeight && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="bg-white p-5 rounded-xl shadow-2xl border border-slate-300 w-64 animate-in zoom-in-95 duration-200">
            <h4 className="font-black text-slate-900 text-xs mb-4 uppercase">Edit Weight Record</h4>
            <input type="number" step="0.01" autoFocus defaultValue={editingWeight.weight} onKeyDown={e => { if(e.key === 'Enter') handleWeightUpdate(editingWeight.id, parseFloat((e.target as HTMLInputElement).value)); }} className="w-full bg-white border border-blue-200 rounded p-2 text-lg font-black text-blue-600 outline-none focus:border-blue-500 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setEditingWeight(null)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded font-black text-[10px]">CANCEL</button>
              <button onClick={() => handleWeightUpdate(editingWeight.id, parseFloat((document.querySelector('input[type="number"]') as HTMLInputElement).value))} className="flex-1 py-2 bg-blue-600 text-white rounded font-black text-[10px]">UPDATE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
