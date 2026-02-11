
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Patient, Veterinarian, WaitlistEntry, Species, Breed } from '../types';
import { PatientDashboard } from './PatientDashboard';
import { supabase } from '../services/supabaseClient';
import { PatientSidebar } from './PatientSidebar';

interface ReceptionPageProps {
  patients: Patient[];
  vets: Veterinarian[];
  waitlist: WaitlistEntry[];
  selectedPatientId: string;
  showDashboard: boolean;
  isAnyModalOpen?: boolean;
  onRegisterPatient: (data: Partial<Patient>) => Promise<Patient | null>;
  onUpdatePatient: (id: string, data: Partial<Patient>) => Promise<Patient | null>;
  onUpdateWaitlist: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  onAddToWaitlist: (entry: Partial<WaitlistEntry>) => Promise<void>;
  onRemoveFromWaitlist: (id: string) => Promise<void>;
  onSelectPatient: (pId: string) => void;
}

const getBirthDateFromAge = (years: number, months: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1); 
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(d.getMonth() - months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getAgeFromBirthDate = (birthDateStr?: string) => {
  if (!birthDateStr) return { years: 0, months: 0 };
  const [bYear, bMonth, bDay] = birthDateStr.split('-').map(Number);
  const birthDate = new Date(bYear, bMonth - 1, bDay);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let years = now.getFullYear() - birthDate.getFullYear();
  let months = now.getMonth() - birthDate.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < birthDate.getDate())) {
    years--;
    months += 12;
  }
  return { years: Math.max(0, years), months: Math.max(0, months) };
};

export const ReceptionPage: React.FC<ReceptionPageProps> = ({ 
  patients, vets, waitlist, selectedPatientId, showDashboard, isAnyModalOpen,
  onRegisterPatient, onUpdatePatient, onUpdateWaitlist, onAddToWaitlist, onRemoveFromWaitlist, onSelectPatient 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'patient' | 'waitlist' | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  const [sidebarWidth, setSidebarWidth] = useState(300); 
  const [isResizing, setIsResizing] = useState(false);
  const [collapsedVets, setCollapsedVets] = useState<Record<string, boolean>>({});

  const [allBreeds, setAllBreeds] = useState<Breed[]>([]);
  const [showBreedList, setShowBreedList] = useState(false);

  const [newPatient, setNewPatient] = useState({
    chartNumber: '', name: '', owner: '', phone: '', breed: '', species: Species.DOG, gender: 'Intact Male'
  });
  const [ageYear, setAgeYear] = useState<string>('');
  const [ageMonth, setAgeMonth] = useState<string>('');

  useEffect(() => {
    const fetchBreeds = async () => {
      const { data } = await supabase.from('breeds').select('*').order('name');
      if (data) setAllBreeds(data);
    };
    fetchBreeds();
  }, []);

  const filteredBreeds = useMemo(() => {
    if (!newPatient.species) return [];
    const speciesMatch = allBreeds.filter(b => b.species === newPatient.species);
    const search = newPatient.breed.trim().toLowerCase();
    if (!search) return speciesMatch;
    return speciesMatch.filter(b => b.name.toLowerCase().includes(search));
  }, [allBreeds, newPatient.species, newPatient.breed]);

  const handleResize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 450) setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const stopResizing = useCallback(() => setIsResizing(false), []);

  useEffect(() => {
    window.addEventListener("mousemove", handleResize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", handleResize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [handleResize, stopResizing]);

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (query.length < 1) return [];
    return patients.filter(p => {
      return p.name.toLowerCase().includes(query) || 
             p.owner.toLowerCase().includes(query) || 
             p.phone.includes(query) || 
             (p.chartNumber || '').toLowerCase().includes(query);
    });
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

  const handleRegisterOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const birthDate = getBirthDateFromAge(parseInt(ageYear) || 0, parseInt(ageMonth) || 0);
      let result: Patient | null = null;
      // Note: We keep chart_number if it exists, but App.tsx will handle auto-generation if it's empty
      const payload: any = { ...newPatient, birth_date: birthDate, chart_number: newPatient.chartNumber };
      delete payload.chartNumber;

      if (editingPatientId) {
        result = await onUpdatePatient(editingPatientId, payload);
      } else {
        result = await onRegisterPatient({ ...payload, avatar: `https://i.pravatar.cc/150?u=${newPatient.name}_${Date.now()}` });
      }
      if (result) {
        setShowNewForm(false);
        setEditingPatientId(null);
        onSelectPatient(result.id);
        setNewPatient({ chartNumber: '', name: '', owner: '', phone: '', breed: '', species: Species.DOG, gender: 'Intact Male' });
        setAgeYear(''); setAgeMonth('');
      }
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const handleEditPatient = (p: Patient) => {
    const age = getAgeFromBirthDate(p.birth_date);
    setNewPatient({ chartNumber: p.chartNumber || '', name: p.name, owner: p.owner, phone: p.phone, breed: p.breed, species: p.species, gender: p.gender });
    setAgeYear(String(age.years)); setAgeMonth(String(age.months));
    setEditingPatientId(p.id); onSelectPatient(''); setShowNewForm(true);
  };

  const handleDragStart = (e: React.DragEvent, id: string, type: 'patient' | 'waitlist') => {
    setDraggedItemId(id);
    setDraggedItemType(type);
    e.dataTransfer.setData('drag-id', id);
    e.dataTransfer.setData('drag-type', type);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetVetId: string | null) => {
    e.preventDefault();
    setDragOverId(null);
    
    // Polyfill 및 데이터 유실 대응
    const dragId = e.dataTransfer.getData('drag-id') || e.dataTransfer.getData('text/plain') || draggedItemId;
    const dragType = e.dataTransfer.getData('drag-type') || draggedItemType;

    if (!dragId || !dragType) return;
    
    if (dragType === 'waitlist') {
      await onUpdateWaitlist(dragId, { vet_id: targetVetId });
    } else if (dragType === 'patient') {
      const p = patients.find(pat => pat.id === dragId);
      if (p) {
        await onAddToWaitlist({ 
          patient_id: p.id, patient_name: p.name, breed: p.breed, owner_name: p.owner, vet_id: targetVetId, type: 'Consultation' 
        });
      }
    }
  };

  const activePatient = useMemo(() => 
    patients.find(p => p.id === selectedPatientId) || null
  , [selectedPatientId, patients]);

  return (
    <div className={`flex h-full bg-slate-200 overflow-hidden text-xs font-sans ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
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
        onDrop={handleDrop}
        onStartResizing={() => setIsResizing(true)}
        dragOverId={dragOverId}
        setDragOverId={setDragOverId}
        onRegisterPatient={() => { setShowNewForm(true); setEditingPatientId(null); setNewPatient({ chartNumber: '', name: '', owner: '', phone: '', breed: '', species: Species.DOG, gender: 'Intact Male' }); setAgeYear(''); setAgeMonth(''); onSelectPatient(''); }}
        onEditPatient={handleEditPatient}
      />

      <div className="flex-1 flex flex-col overflow-hidden bg-slate-200 p-1">
        {activePatient ? (
          <div className="flex-1 bg-white border border-slate-300 rounded flex flex-col overflow-hidden shadow-sm relative">
            <div className="flex-1 overflow-hidden p-1 bg-slate-100">
              <PatientDashboard patient={showDashboard ? activePatient : null} onUpdatePatient={async (updates) => { await onUpdatePatient(activePatient.id, updates); }} />
            </div>
          </div>
        ) : showNewForm ? (
          <div className="flex-1 bg-white border border-slate-300 rounded p-6 overflow-y-auto">
             <form onSubmit={handleRegisterOrUpdate} className="max-w-xl mx-auto space-y-6">
                <div className="flex items-center gap-3 border-b pb-4"><div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center"><i className={`fas ${editingPatientId ? 'fa-user-edit' : 'fa-user-plus'}`}></i></div><h2 className="text-xl font-black text-gray-900 tracking-tight">{editingPatientId ? 'Edit Patient Info' : 'Register New Patient'}</h2></div>
                <div className="grid grid-cols-2 gap-6"><div className="space-y-4"><label className="font-black text-[11px] text-gray-500 uppercase tracking-widest block">Owner Information</label><input required value={newPatient.owner} onChange={(e) => setNewPatient(p => ({ ...p, owner: e.target.value }))} placeholder="Owner Name *" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm placeholder:text-gray-400" /><input required value={newPatient.phone} onChange={(e) => setNewPatient(p => ({ ...p, phone: e.target.value }))} placeholder="Phone Number *" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm placeholder:text-gray-400" /></div><div className="space-y-4"><label className="font-black text-[11px] text-gray-500 uppercase tracking-widest block">Patient Information</label><div className="grid grid-cols-3 gap-2"><div className="col-span-2"><input required value={newPatient.name} onChange={(e) => setNewPatient(p => ({ ...p, name: e.target.value }))} placeholder="Animal Name *" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm placeholder:text-gray-400" /></div><div><input value={newPatient.chartNumber} onChange={(e) => setNewPatient(p => ({ ...p, chartNumber: e.target.value }))} placeholder="Chart No. (Auto)" className="w-full bg-slate-50 border border-slate-300 p-2.5 rounded-lg text-[13px] text-slate-700 font-mono font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm placeholder:text-gray-400" title="Leave empty for auto-generation" /></div></div><div className="flex flex-col gap-2"><select value={newPatient.species} onChange={(e) => setNewPatient(p => ({ ...p, species: e.target.value as Species, breed: '' }))} className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"><option value={Species.DOG} className="text-gray-900">Dog</option><option value={Species.CAT} className="text-gray-900">Cat</option><option value={Species.OTHER} className="text-gray-900">Other</option></select><div className="space-y-2"><label className="font-black text-[10px] text-gray-400 uppercase tracking-widest ml-1">Age (Years/Months)</label><div className="flex gap-2"><div className="flex-1 relative"><input required type="number" min="0" value={ageYear} onChange={(e) => setAgeYear(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black text-center outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">Y</span></div><div className="flex-1 relative"><input required type="number" min="0" max="11" value={ageMonth} onChange={(e) => setAgeMonth(e.target.value)} placeholder="0" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black text-center outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase">M</span></div></div></div></div><div className="relative group"><input value={newPatient.breed} onChange={(e) => { setNewPatient(p => ({ ...p, breed: e.target.value })); setShowBreedList(true); }} onFocus={() => setShowBreedList(true)} placeholder="Breed (Search...)" className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm placeholder:text-gray-400" />{showBreedList && (newPatient.species === Species.DOG || newPatient.species === Species.CAT) && filteredBreeds.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-50">{filteredBreeds.map(b => (<div key={b.id} onMouseDown={() => { setNewPatient(p => ({ ...p, breed: b.name })); setShowBreedList(false); }} className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 cursor-pointer">{b.name}</div>))}</div>)}{showBreedList && (newPatient.species === Species.DOG || newPatient.species === Species.CAT) && filteredBreeds.length === 0 && newPatient.breed && (<div className="absolute top-full left-0 right-0 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 text-[10px] text-slate-400 font-black text-center" onMouseDown={() => setShowBreedList(false)}>Use "{newPatient.breed}" (Custom)</div>)}{showBreedList && (<div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowBreedList(false)}></div>)}</div><div className="space-y-2"><label className="font-black text-[11px] text-gray-500 uppercase tracking-widest block">Gender</label><select value={newPatient.gender} onChange={(e) => setNewPatient(p => ({ ...p, gender: e.target.value }))} className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-[13px] text-gray-900 font-black outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"><option value="Intact Male">Intact Male (수컷)</option><option value="Castrated Male">Castrated Male (중성화 수컷)</option><option value="Intact Female">Intact Female (암컷)</option><option value="Spayed Female">Spayed Female (중성화 암컷)</option></select></div></div></div><div className="flex justify-end gap-3 pt-6 border-t"><button type="button" onClick={() => setShowNewForm(false)} className="px-6 py-2.5 text-gray-500 font-black text-[12px] hover:text-gray-900 uppercase">Cancel</button><button type="submit" className="px-10 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[12px] uppercase shadow-lg active:scale-95 transition-all">{editingPatientId ? 'Save Changes' : 'Save & Register'}</button></div>
             </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white border border-slate-300 rounded"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6"><i className="fas fa-stethoscope text-3xl opacity-20 text-gray-400"></i></div><p className="font-black uppercase tracking-[0.2em] text-gray-400 text-center">Select a patient from the list (Double Click) to start consultation.</p></div>
        )}
      </div>
    </div>
  );
};
