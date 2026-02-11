
import React, { useState, useEffect, useMemo } from 'react';
import { Veterinarian, Appointment, Patient } from '../types';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  vets: Veterinarian[];
  patients: Patient[];
  onSave: (appointment: Omit<Appointment, 'id'>) => void;
  onDelete?: () => void;
  initialAppointment?: Appointment;
  initialVetId?: string;
  initialTime?: string;
  initialEndTime?: string;
  initialDate?: string;
  activePatient?: Patient | null;
}

const COLORS = [
  { name: 'Sky Blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Slate', value: '#64748b' },
];

export const AppointmentModal: React.FC<AppointmentModalProps> = ({ 
  isOpen, 
  onClose, 
  vets, 
  patients,
  onSave,
  onDelete,
  initialAppointment,
  initialVetId,
  initialTime,
  initialEndTime,
  initialDate,
  activePatient
}) => {
  const [vetId, setVetId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:15');
  const [reason, setReason] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [color, setColor] = useState(COLORS[0].value);

  const filteredPatients = useMemo(() => {
    if (!patientSearchTerm.trim()) return [];
    const term = patientSearchTerm.toLowerCase();
    return patients.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.owner.toLowerCase().includes(term)
    ).slice(0, 5);
  }, [patientSearchTerm, patients]);

  const selectedPatient = useMemo(() => 
    patients.find(p => p.id === selectedPatientId)
  , [selectedPatientId, patients]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      if (initialAppointment) {
        setVetId(initialAppointment.vetId);
        setSelectedPatientId(initialAppointment.patientId || '');
        setPatientSearchTerm('');
        setDate(initialAppointment.date);
        setStartTime(initialAppointment.startTime);
        setEndTime(initialAppointment.endTime);
        setReason(initialAppointment.reason);
        setIsRecurring(initialAppointment.isRecurring);
        setColor(initialAppointment.color);
      } else {
        setVetId(initialVetId || (vets.length > 0 ? vets[0].id : ''));
        setSelectedPatientId(activePatient?.id || '');
        setPatientSearchTerm('');
        setDate(initialDate || new Date().toISOString().split('T')[0]);
        setStartTime(initialTime || '09:00');
        
        if (initialEndTime) {
          setEndTime(initialEndTime);
        } else if (initialTime) {
          const [h, m] = initialTime.split(':').map(Number);
          const totalMinutes = h * 60 + m + 30;
          const nextH = Math.min(Math.floor(totalMinutes / 60), 20);
          const nextM = nextH === 20 ? 0 : totalMinutes % 60;
          setEndTime(`${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`);
        } else {
          setEndTime('09:30');
        }
        setReason('');
        setIsRecurring(false);
        setColor(COLORS[0].value);
      }
    }
  }, [isOpen, initialAppointment, initialVetId, initialTime, initialEndTime, initialDate, vets, activePatient]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (endTime <= startTime) {
      alert('⚠️ 종료 시간은 시작 시간보다 이후여야 합니다.');
      return;
    }
    if (!selectedPatientId && !reason.trim()) {
      alert('⚠️ 환자를 선택하거나 예약 상세 내용을 입력해주세요.');
      return;
    }
    onSave({ 
      vetId, 
      patientId: selectedPatientId || undefined, 
      date, 
      startTime, 
      endTime, 
      reason, 
      isRecurring, 
      color 
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <i className={`fas ${initialAppointment ? 'fa-edit' : 'fa-calendar-plus'} text-xl`}></i>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {initialAppointment ? 'Edit Reservation' : 'New Reservation'}
              </h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Clinical Scheduler</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-200 text-slate-400 transition-all">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* 환자 선택 섹션 */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Patient Selection</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <img src={selectedPatient.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                  <div>
                    <p className="text-sm font-black text-slate-900">{selectedPatient.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{selectedPatient.breed} • {selectedPatient.owner}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedPatientId('')} className="text-slate-400 hover:text-rose-500 px-3 py-1">변경</button>
              </div>
            ) : (
              <div className="relative">
                <input 
                  type="text"
                  placeholder="환자명 또는 보호자명 검색..."
                  value={patientSearchTerm}
                  onChange={(e) => setPatientSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold text-sm outline-none focus:border-blue-500 transition-all"
                />
                {filteredPatients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                    {filteredPatients.map(p => (
                      <div key={p.id} onClick={() => { setSelectedPatientId(p.id); setPatientSearchTerm(''); }} className="p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 border-b last:border-0">
                        <img src={p.avatar} className="w-8 h-8 rounded-lg object-cover" alt="" />
                        <div>
                          <p className="text-xs font-black text-slate-900">{p.name}</p>
                          <p className="text-[9px] text-slate-500 font-bold">{p.owner} • {p.breed}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Practitioner</label>
              <select value={vetId} onChange={(e) => setVetId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold text-sm outline-none focus:border-blue-500 transition-all cursor-pointer">
                {vets.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold text-sm outline-none focus:border-blue-500 transition-all cursor-pointer" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Starts At</label>
              <input type="time" step="900" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold text-sm outline-none focus:border-blue-500 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ends At</label>
              <input type="time" step="900" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold text-sm outline-none focus:border-blue-500 transition-all" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category Color</label>
            <div className="flex justify-between p-4 bg-slate-50 rounded-3xl border border-slate-200">
              {COLORS.map((c) => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)} className={`w-10 h-10 rounded-xl border-4 transition-all hover:scale-110 active:scale-90 ${color === c.value ? 'border-slate-900 scale-105 shadow-md' : 'border-white opacity-40'}`} style={{ backgroundColor: c.value }} />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Appointment Reason / Notes</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="내원 목적 및 특이사항 입력..." className="w-full bg-slate-50 border border-slate-200 rounded-[28px] px-6 py-5 text-slate-950 font-bold text-sm outline-none focus:border-blue-500 transition-all min-h-[100px] resize-none placeholder:text-slate-300 shadow-inner" />
          </div>

          <div className="flex gap-4 pt-4">
            {initialAppointment && <button type="button" onClick={(e) => { e.stopPropagation(); onDelete?.(); }} className="px-8 text-rose-500 font-black text-[11px] uppercase tracking-widest hover:bg-rose-50 rounded-2xl transition-all">Delete</button>}
            <button type="submit" className="flex-1 py-5 bg-slate-900 hover:bg-black text-white rounded-[24px] font-black text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-95">
              {initialAppointment ? 'Update Reservation' : 'Confirm Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
