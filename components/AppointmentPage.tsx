
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Veterinarian, Appointment, ClinicSettings, Patient, WaitlistEntry } from '../types';
import { AppointmentModal } from './AppointmentModal';
import { PatientSidebar } from './PatientSidebar';

interface AppointmentPageProps {
  vets: Veterinarian[];
  patients: Patient[];
  appointments: Appointment[];
  waitlist: WaitlistEntry[];
  clinicSettings: ClinicSettings;
  activePatient: Patient | null;
  onSelectPatient: (id: string) => void;
  onAddToWaitlist: (entry: Partial<WaitlistEntry>) => Promise<void>;
  onUpdateWaitlist: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  onRemoveFromWaitlist: (id: string) => Promise<void>;
  onAddAppointment: (appointment: Omit<Appointment, 'id'>) => Promise<boolean>;
  onUpdateAppointment: (id: string, appointment: Omit<Appointment, 'id'>) => Promise<boolean>;
  onDeleteAppointment: (id: string) => Promise<boolean>;
}

interface InteractionState {
  type: 'move' | 'resize';
  apptId: string;
  originalVetId: string;
  originalStartMinutes: number;
  originalEndMinutes: number;
  startX: number;
  startY: number;
  tempVetId: string;
  tempStartMinutes: number;
  tempEndMinutes: number;
}

export const AppointmentPage: React.FC<AppointmentPageProps> = ({ 
  vets, patients, appointments, waitlist, clinicSettings, activePatient,
  onSelectPatient, onAddToWaitlist, onUpdateWaitlist, onRemoveFromWaitlist,
  onAddAppointment, onUpdateAppointment, onDeleteAppointment
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  
  // Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedVets, setCollapsedVets] = useState<Record<string, boolean>>({});
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'patient' | 'waitlist' | 'appointment_item' | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Selection/Interaction
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState<{ vetId: string; time: string } | null>(null);
  const [selectEnd, setSelectEnd] = useState<{ vetId: string; time: string } | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  const [preSelectedTime, setPreSelectedTime] = useState<string | undefined>(undefined);
  const [preSelectedEndTime, setPreSelectedEndTime] = useState<string | undefined>(undefined);
  const [preSelectedVetId, setPreSelectedVetId] = useState<string | undefined>(undefined);

  const actualVets = useMemo(() => vets.filter(v => v.id !== 'ALL_VETS'), [vets]);
  const SLOT_HEIGHT = 64; 
  const VET_COLUMN_WIDTH = 240; 
  const TIME_COLUMN_WIDTH = 80; 
  const MIN_DURATION_MINUTES = 15;

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 9; h <= 19; h++) {
      for (let m = 0; m < 60; m += 15) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    slots.push("20:00");
    return slots;
  }, []);

  const handleResizeSidebar = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 450) setSidebarWidth(newWidth);
    }
  }, [isResizingSidebar]);

  useEffect(() => {
    window.addEventListener('mousemove', handleResizeSidebar);
    window.addEventListener('mouseup', () => setIsResizingSidebar(false));
    return () => {
      window.removeEventListener('mousemove', handleResizeSidebar);
    };
  }, [handleResizeSidebar]);

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return query ? patients.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.owner.toLowerCase().includes(query) ||
      (p.chartNumber || '').toLowerCase().includes(query)
    ) : [];
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

  const parseMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const calculateDurationInSlots = (start: string, end: string) => (parseMinutes(end) - parseMinutes(start)) / 15;
  const calculateOffsetInSlots = (startTime: string) => (parseMinutes(startTime) - 540) / 15;

  const handleCellStart = (vetId: string, time: string) => {
    setIsSelecting(true);
    setSelectStart({ vetId, time });
    setSelectEnd({ vetId, time });
  };

  const handleCellMove = (e: React.MouseEvent | React.TouchEvent, vetId: string, time: string) => {
    if (isSelecting && selectStart && selectStart.vetId === vetId) {
      setSelectEnd({ vetId, time });
    }
  };

  const handleCellEnd = () => {
    if (isSelecting && selectStart && selectEnd) {
      const startIndex = timeSlots.indexOf(selectStart.time);
      const endIndex = timeSlots.indexOf(selectEnd.time);
      const realStart = timeSlots[Math.min(startIndex, endIndex)];
      const lastSlotTime = timeSlots[Math.max(startIndex, endIndex)];
      
      const totalMinutes = parseMinutes(lastSlotTime) + 15;
      const endH = Math.min(Math.floor(totalMinutes / 60), 20);
      const endM = endH === 20 ? 0 : totalMinutes % 60;
      const realEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      setPreSelectedVetId(selectStart.vetId);
      setPreSelectedTime(realStart);
      setPreSelectedEndTime(realEnd);
      setEditingAppointment(null);
      setIsModalOpen(true);
    }
    setIsSelecting(false);
    setSelectStart(null);
    setSelectEnd(null);
  };

  const handleApptStart = (e: React.MouseEvent | React.TouchEvent, appt: Appointment, type: 'move' | 'resize') => {
    e.stopPropagation();
    let clientX, clientY;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }

    setInteraction({
      type, apptId: appt.id, originalVetId: appt.vetId,
      originalStartMinutes: parseMinutes(appt.startTime), originalEndMinutes: parseMinutes(appt.endTime),
      startX: clientX, startY: clientY, tempVetId: appt.vetId,
      tempStartMinutes: parseMinutes(appt.startTime), tempEndMinutes: parseMinutes(appt.endTime)
    });
  };

  const handleCalendarDrop = (e: React.DragEvent, vetId: string, time: string) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData('drag-id') || draggedItemId;
    const dragType = e.dataTransfer.getData('drag-type') || draggedItemType;

    if (dragType === 'patient' || dragType === 'waitlist') {
      const patientId = dragId;
      const p = patients.find(pat => pat.id === patientId);
      if (p) {
        onSelectPatient(p.id);
        setPreSelectedVetId(vetId);
        setPreSelectedTime(time);
        
        const totalMinutes = parseMinutes(time) + 30; 
        const endH = Math.min(Math.floor(totalMinutes / 60), 20);
        const endM = endH === 20 ? 0 : totalMinutes % 60;
        setPreSelectedEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
        
        setEditingAppointment(null);
        setIsModalOpen(true);
      }
    }
  };

  useEffect(() => {
    const handleWindowMove = (e: MouseEvent | TouchEvent) => {
      if (!interaction) return;
      if (e.type === 'touchmove') e.preventDefault();

      let clientX, clientY;
      if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else { clientX = (e as MouseEvent).clientX; clientY = (e as MouseEvent).clientY; }

      const deltaX = clientX - interaction.startX;
      const deltaY = clientY - interaction.startY;
      const slotsMovedY = Math.round(deltaY / SLOT_HEIGHT);
      const colsMovedX = Math.round(deltaX / VET_COLUMN_WIDTH);

      if (interaction.type === 'move') {
        const vetIndex = actualVets.findIndex(v => v.id === interaction.originalVetId);
        let newVetIndex = Math.max(0, Math.min(vetIndex + colsMovedX, actualVets.length - 1));
        const newVetId = actualVets[newVetIndex].id;
        const duration = interaction.originalEndMinutes - interaction.originalStartMinutes;
        let newStart = Math.max(parseMinutes("09:00"), Math.min(interaction.originalStartMinutes + (slotsMovedY * 15), parseMinutes("20:00") - duration));
        setInteraction(prev => prev ? ({ ...prev, tempVetId: newVetId, tempStartMinutes: newStart, tempEndMinutes: newStart + duration }) : null);
      } else if (interaction.type === 'resize') {
        let newEnd = Math.min(Math.max(interaction.originalEndMinutes + (slotsMovedY * 15), interaction.originalStartMinutes + MIN_DURATION_MINUTES), parseMinutes("20:00"));
        setInteraction(prev => prev ? ({ ...prev, tempEndMinutes: newEnd }) : null);
      }
    };

    const handleWindowEnd = async () => {
      if (!interaction) return;
      const { apptId, tempVetId, tempStartMinutes, tempEndMinutes, originalVetId, originalStartMinutes, originalEndMinutes } = interaction;
      if (tempVetId !== originalVetId || tempStartMinutes !== originalStartMinutes || tempEndMinutes !== originalEndMinutes) {
        const appointment = appointments.find(a => a.id === apptId);
        if (appointment) await onUpdateAppointment(apptId, { ...appointment, vetId: tempVetId, startTime: formatMinutes(tempStartMinutes), endTime: formatMinutes(tempEndMinutes) });
      }
      setInteraction(null);
    };

    if (interaction) {
      window.addEventListener('mousemove', handleWindowMove);
      window.addEventListener('mouseup', handleWindowEnd);
      window.addEventListener('touchmove', handleWindowMove, { passive: false });
      window.addEventListener('touchend', handleWindowEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowEnd);
      window.removeEventListener('touchmove', handleWindowMove);
      window.removeEventListener('touchend', handleWindowEnd);
    };
  }, [interaction, actualVets, appointments, onUpdateAppointment]);

  const individualAppts = useMemo(() => {
    const targetDay = new Date(selectedDate).getDay();
    return appointments.filter(a => (a.date === selectedDate || (a.isRecurring && selectedDate >= a.date && new Date(a.date).getDay() === targetDay)) && a.vetId !== 'ALL_VETS');
  }, [appointments, selectedDate]);

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden font-sans">
      <PatientSidebar 
        width={sidebarWidth}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchResults={searchResults}
        selectedPatientId={activePatient?.id || ''}
        onSelectPatient={onSelectPatient}
        waitlist={waitlist}
        vets={vets}
        waitlistByVet={waitlistByVet}
        collapsedVets={collapsedVets}
        onToggleVet={(id) => setCollapsedVets(prev => ({ ...prev, [id]: !prev[id] }))}
        onRemoveFromWaitlist={onRemoveFromWaitlist}
        onDragStart={(e, id, type) => { 
          setDraggedItemId(id); 
          setDraggedItemType(type); 
          e.dataTransfer.setData('drag-id', id);
          e.dataTransfer.setData('drag-type', type);
        }}
        onDragEnd={() => { setDraggedItemId(null); setDraggedItemType(null); }}
        onDrop={async (e, targetVetId) => {
          const dragId = e.dataTransfer.getData('drag-id') || draggedItemId;
          const dragType = e.dataTransfer.getData('drag-type') || draggedItemType;

          if (!dragId) return;
          if (dragType === 'waitlist') await onUpdateWaitlist(dragId, { vetId: targetVetId });
          else if (dragType === 'patient') {
            const p = patients.find(pat => pat.id === dragId);
            if (p) await onAddToWaitlist({ patientId: p.id, patientName: p.name, breed: p.breed, ownerName: p.owner, vetId: targetVetId, type: 'Appointment' });
          }
        }}
        onStartResizing={() => setIsResizingSidebar(true)}
        dragOverId={dragOverId}
        setDragOverId={setDragOverId}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative select-none" onMouseUp={handleCellEnd} onTouchEnd={handleCellEnd}>
        <header className="h-12 border-b border-slate-300 bg-white px-5 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-6">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <i className="fas fa-calendar-alt text-blue-600"></i> Reservation Scheduler
            </h2>
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-md hover:bg-white transition-all">
                <i className="fas fa-chevron-left text-[10px]"></i>
              </button>
              <div className="px-4 text-[10px] font-black text-slate-800 tracking-tight min-w-[100px] text-center">{selectedDate}</div>
              <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]); }} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-900 rounded-md hover:bg-white transition-all">
                <i className="fas fa-chevron-right text-[10px]"></i>
              </button>
            </div>
          </div>
          <button onClick={() => { setEditingAppointment(null); setIsModalOpen(true); }} className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-sm">
            <i className="fas fa-plus mr-2"></i> New Appointment
          </button>
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar relative bg-slate-50 flex flex-col">
          <div className="min-w-max relative flex flex-col">
            <div className="flex sticky top-0 z-[55] bg-white border-b border-slate-200 shadow-sm">
              <div style={{ width: `${TIME_COLUMN_WIDTH}px` }} className="flex-shrink-0 bg-slate-50 border-r border-slate-200 flex items-center justify-center sticky left-0 z-[56]">
                <i className="fas fa-clock text-slate-300 text-[10px]"></i>
              </div>
              {actualVets.map(vet => (
                <div key={vet.id} style={{ width: `${VET_COLUMN_WIDTH}px` }} className="flex-shrink-0 border-r border-slate-100 p-3 flex items-center gap-3 bg-white">
                  <img src={vet.avatar} className="w-8 h-8 rounded-full object-cover border-2 border-slate-100" alt="" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-900 truncate uppercase">{vet.name}</p>
                    <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter truncate">{vet.specialty}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex relative">
              <div className="flex flex-col sticky left-0 z-50 bg-white border-r border-slate-200 shadow-sm">
                {timeSlots.map((time, idx) => (
                  <div key={time} style={{ height: idx === timeSlots.length - 1 ? '0px' : `${SLOT_HEIGHT}px`, width: `${TIME_COLUMN_WIDTH}px` }} className={`flex-shrink-0 relative border-b border-slate-100 ${time.endsWith(':00') ? 'bg-slate-50' : ''}`}>
                    <span className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[9px] font-black tracking-tighter z-10 ${time.endsWith(':00') ? 'text-slate-900 bg-white border border-slate-200 shadow-sm' : 'text-slate-300'}`}>{time}</span>
                  </div>
                ))}
              </div>

              <div className="flex relative flex-1">
                {actualVets.map((vet) => (
                  <div key={vet.id} style={{ width: `${VET_COLUMN_WIDTH}px` }} className="flex-shrink-0 border-r border-slate-100 relative bg-white">
                    {timeSlots.slice(0, -1).map((time) => (
                      <div 
                        key={time} 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleCalendarDrop(e, vet.id, time)}
                        style={{ height: `${SLOT_HEIGHT}px` }} 
                        className={`border-b border-slate-50 cursor-pointer transition-colors flex items-center justify-center group/cell ${selectStart?.vetId === vet.id && timeSlots.indexOf(time) >= Math.min(timeSlots.indexOf(selectStart.time), timeSlots.indexOf(selectEnd?.time||'')) && timeSlots.indexOf(time) <= Math.max(timeSlots.indexOf(selectStart.time), timeSlots.indexOf(selectEnd?.time||'')) ? 'bg-blue-50' : 'hover:bg-slate-50'}`} 
                        onMouseDown={() => handleCellStart(vet.id, time)} 
                        onMouseEnter={(e) => handleCellMove(e, vet.id, time)}
                      >
                        <i className={`fas fa-plus text-[10px] opacity-0 group-hover/cell:opacity-100 transition-opacity text-blue-400`}></i>
                      </div>
                    ))}

                    {individualAppts.filter(a => a.vetId === vet.id || (interaction?.apptId === a.id && interaction.tempVetId === vet.id)).map(appt => {
                      const isInteracting = interaction?.apptId === appt.id;
                      if (isInteracting && vet.id !== interaction.tempVetId) return null;
                      const startT = isInteracting ? formatMinutes(interaction.tempStartMinutes) : appt.startTime;
                      const endT = isInteracting ? formatMinutes(interaction.tempEndMinutes) : appt.endTime;
                      const durationSlots = calculateDurationInSlots(startT, endT);
                      const topOffset = calculateOffsetInSlots(startT) * SLOT_HEIGHT;
                      const patient = patients.find(p => p.id === appt.patientId);
                      const isShort = durationSlots <= 1.01; 

                      return (
                        <div 
                          key={appt.id} 
                          onMouseDown={(e) => handleApptStart(e, appt, 'move')}
                          onDoubleClick={(e) => { e.stopPropagation(); setEditingAppointment(appt); setIsModalOpen(true); }}
                          className={`absolute left-1 right-1 rounded-lg border-l-4 shadow-sm transition-all flex group overflow-hidden ${isShort ? 'flex-row items-center px-2 py-1 gap-2' : 'flex-col p-3'} ${isInteracting ? 'z-50 opacity-90 shadow-xl scale-[1.02] cursor-grabbing' : 'cursor-grab hover:shadow-md hover:scale-[1.01] hover:z-40'}`} 
                          style={{ top: `${topOffset + 2}px`, height: `${Math.max(durationSlots * SLOT_HEIGHT - 4, 30)}px`, backgroundColor: `${appt.color}15`, borderLeftColor: appt.color }}
                        >
                          <div className={`flex-shrink-0 ${isShort ? '' : 'flex justify-between items-start mb-1 pointer-events-none'}`}>
                            <span className={`${isShort ? 'text-[9px]' : 'text-[8px] px-1.5 py-0.5 rounded bg-white/50 border border-white/80'} font-black uppercase tracking-tighter`} style={{ color: appt.color }}>{startT}{!isShort && ` - ${endT}`}</span>
                          </div>
                          <div className={`min-w-0 pointer-events-none flex-1 ${isShort ? 'flex items-baseline gap-2' : ''}`}>
                            <p className={`font-black text-slate-950 truncate ${isShort ? 'text-[10px]' : 'text-[11px] mb-0.5'}`}>{patient ? `[${patient.name}]` : '[미지정]'}</p>
                            <p className={`${isShort ? 'text-[9px] truncate' : 'text-[9px] leading-snug line-clamp-2'} font-bold text-slate-600 italic`}>{appt.reason}</p>
                          </div>
                          <div onMouseDown={(e) => handleApptStart(e, appt, 'resize')} className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex justify-center items-end pb-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 touch-none">
                            <div className="w-6 h-1 bg-slate-400/50 rounded-full"></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <AppointmentModal 
          isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingAppointment(null); setPreSelectedEndTime(undefined); }}
          vets={vets} patients={patients} initialDate={selectedDate} initialTime={preSelectedTime} initialEndTime={preSelectedEndTime} initialVetId={preSelectedVetId} activePatient={activePatient}
          onSave={async (data) => {
            const success = await (editingAppointment ? onUpdateAppointment(editingAppointment.id, data) : onAddAppointment(data));
            if (success) { setIsModalOpen(false); setEditingAppointment(null); setPreSelectedEndTime(undefined); }
          }}
          onDelete={async () => {
            if (editingAppointment && await onDeleteAppointment(editingAppointment.id)) { setIsModalOpen(false); setEditingAppointment(null); setPreSelectedEndTime(undefined); }
          }}
          initialAppointment={editingAppointment || undefined}
        />
      )}
    </div>
  );
};
