
import React, { useState, useCallback, useEffect } from 'react';
import { SOAPRecord, Patient, AppView, Veterinarian, WaitlistEntry, ClinicSettings, Appointment } from './types';
import { supabase, subscribeToWaitlist } from './services/supabaseClient';
import { TopNavigation } from './components/TopNavigation';
import { LoginPage } from './components/LoginPage';
import { ReceptionPage } from './components/ReceptionPage';
import { ConsultationPage } from './components/ConsultationPage';
import { ExaminationPage } from './components/ExaminationPage';
import { AppointmentPage } from './components/AppointmentPage';
import { BillingPage } from './components/BillingPage';
import { SettingsModal } from './components/SettingsModal';
import { ImageModal } from './components/ImageModal';

const ADMIN_EMAIL = "mindonesia0000@gmail.com";

const App: React.FC = () => {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [activeView, setActiveView] = useState<AppView>('Reception');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [vets, setVets] = useState<Veterinarian[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  
  // 작성 중인 SOAP 레코드 전역 관리 (탭 이동 시 데이터 보존용)
  const [currentSoap, setCurrentSoap] = useState<Partial<SOAPRecord>>({
    subjective: '', objective: '', assessmentProblems: '', assessmentDdx: [], planTx: '', planRx: '', planSummary: ''
  });
  const [activeSoapCc, setActiveSoapCc] = useState<string | null>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>({
    lunchStartTime: '13:00',
    lunchEndTime: '14:00',
    isLunchEnabled: true,
    imageServerUrl: ''
  });
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const fetchData = useCallback(async () => {
    try {
      const { data: pData } = await supabase.from('patients').select('*').order('name');
      if (pData) setPatients(pData.map(mapDbPatient));
      const { data: vData } = await supabase.from('veterinarians').select('*').order('name');
      if (vData) setVets(vData);
      const { data: wData } = await supabase.from('waitlist').select('*').order('created_at');
      if (wData) setWaitlist(wData.map(mapDbWaitlist));
      const { data: aData } = await supabase.from('appointments').select('*');
      if (aData) setAppointments(aData.map(mapDbAppointment));
      const { data: sData } = await supabase.from('clinic_settings').select('*').single();
      if (sData) setClinicSettings(sData);
    } catch (e) { console.error("Data fetch error:", e); }
  }, []);

  useEffect(() => {
    fetchData();
    const subscription = subscribeToWaitlist(() => fetchData());
    return () => { subscription.unsubscribe(); };
  }, [fetchData]);

  const mapDbPatient = (db: any): Patient => ({
    id: db.id, chartNumber: db.chart_number, name: db.name, owner: db.owner, phone: db.phone || '', species: db.species, breed: db.breed || '', gender: db.gender || '', weight: db.weight || 0, age: 'Calculated', birth_date: db.birth_date, avatar: db.avatar || `https://i.pravatar.cc/150?u=${db.name}`, lastVisit: db.last_visit ? new Date(db.last_visit).toLocaleDateString() : 'New', medical_memo: db.medical_memo
  });

  const mapDbWaitlist = (db: any): WaitlistEntry => ({
    id: db.id, patientId: db.patient_id, patientName: db.patient_name, breed: db.breed || '', ownerName: db.owner_name || '', vetId: db.vet_id || '', time: new Date(db.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), memo: db.memo || '', type: db.type || 'Consultation'
  });

  const mapDbAppointment = (db: any): Appointment => ({
    id: db.id, vetId: db.vet_id, patientId: db.patient_id, date: db.date, startTime: db.start_time, endTime: db.end_time, reason: db.reason || '', isRecurring: db.is_recurring || false, color: db.color || '#3b82f6'
  });

  const handleLogin = (userData: { name: string; email: string }) => setUser(userData);
  const handleLogout = () => { setUser(null); setSelectedPatientId(null); setActiveSoapCc(null); };

  // 환자 선택 핸들러: 환자가 바뀌면 작성 중인 차트도 초기화
  const handleSelectPatient = (id: string | null) => {
    if (id !== selectedPatientId) {
      setSelectedPatientId(id);
      setActiveSoapCc(null);
      setCurrentSoap({ subjective: '', objective: '', assessmentProblems: '', assessmentDdx: [], planTx: '', planRx: '', planSummary: '' });
    }
  };

  /**
   * 명시적인 뷰 전환 핸들러를 사용하여 탭 이동 안정성을 높입니다.
   */
  const handleViewChange = useCallback((view: AppView) => {
    setActiveView(view);
  }, []);

  const activePatient = (selectedPatientId && patients.length > 0) ? (patients.find(p => p.id === selectedPatientId) || null) : null;

  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden font-sans">
      <TopNavigation 
        activeView={activeView} 
        onViewChange={handleViewChange} 
        onLogout={handleLogout} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        userName={user?.name || ''} 
        isAdmin={isAdmin} 
        activePatient={activePatient}
        onClearPatient={() => { handleSelectPatient(null); }}
        activeSoapCc={activeSoapCc}
        onClearSoap={() => { 
          setActiveSoapCc(null); 
          setCurrentSoap({ subjective: '', objective: '', assessmentProblems: '', assessmentDdx: [], planTx: '', planRx: '', planSummary: '', patientId: activePatient?.id }); 
        }}
      />

      <main className="flex-1 overflow-hidden relative">
        {activeView === 'Reception' && (
          <ReceptionPage 
            patients={patients} vets={vets} waitlist={waitlist} selectedPatientId={selectedPatientId || ''} showDashboard={true} onSelectPatient={handleSelectPatient}
            onRegisterPatient={async (data) => {
              // Auto-generate chart number if empty
              let chartNum = data.chart_number || (data as any).chartNumber;
              
              if (!chartNum || String(chartNum).trim() === '') {
                // Fetch all current chart numbers to find the max
                const { data: allPatients } = await supabase.from('patients').select('chart_number');
                if (allPatients) {
                  const maxNum = allPatients.reduce((max, p) => {
                    const num = parseInt(p.chart_number, 10);
                    return !isNaN(num) && num > max ? num : max;
                  }, 0);
                  chartNum = (maxNum + 1).toString();
                } else {
                  chartNum = "1";
                }
              }

              const { data: newP, error } = await supabase.from('patients').insert([{ ...data, chart_number: chartNum }]).select();
              if (!error && newP) { fetchData(); return mapDbPatient(newP[0]); }
              return null;
            }}
            onUpdatePatient={async (id, updates) => {
              const { data, error } = await supabase.from('patients').update(updates).eq('id', id).select();
              if (!error && data) { fetchData(); return mapDbPatient(data[0]); }
              return null;
            }}
            onAddToWaitlist={async (e) => { await supabase.from('waitlist').insert([e]); fetchData(); }}
            onUpdateWaitlist={async (id, u) => { await supabase.from('waitlist').update(u).eq('id', id); fetchData(); }}
            onRemoveFromWaitlist={async (id) => { await supabase.from('waitlist').delete().eq('id', id); fetchData(); }}
          />
        )}

        {activeView === 'Consultation' && (
          <ConsultationPage 
            activePatient={activePatient} onImageDoubleClick={setFullScreenImage} vets={vets} clinicSettings={clinicSettings} patients={patients} waitlist={waitlist} onSelectPatient={handleSelectPatient}
            onAddToWaitlist={async (e) => { await supabase.from('waitlist').insert([e]); fetchData(); }}
            onUpdateWaitlist={async (id, u) => { await supabase.from('waitlist').update(u).eq('id', id); fetchData(); }}
            onRemoveFromWaitlist={async (id) => { await supabase.from('waitlist').delete().eq('id', id); fetchData(); }}
            activeSoapCc={activeSoapCc}
            onActiveSoapChange={setActiveSoapCc}
            currentSoap={currentSoap}
            onUpdateSoap={(updated) => setCurrentSoap(updated)}
          />
        )}

        {activeView === 'Examination' && (
          <ExaminationPage 
            vets={vets} patients={patients} waitlist={waitlist} onImageDoubleClick={setFullScreenImage} activePatient={activePatient} onSelectPatient={handleSelectPatient}
            onAddToWaitlist={async (e) => { await supabase.from('waitlist').insert([e]); fetchData(); }}
            onUpdateWaitlist={async (id, u) => { await supabase.from('waitlist').update(u).eq('id', id); fetchData(); }}
            onRemoveFromWaitlist={async (id) => { await supabase.from('waitlist').delete().eq('id', id); fetchData(); }}
            clinicSettings={clinicSettings}
            currentSoap={currentSoap}
          />
        )}

        {activeView === 'Appointment' && (
          <AppointmentPage 
            vets={vets} patients={patients} appointments={appointments} waitlist={waitlist} clinicSettings={clinicSettings} activePatient={activePatient} onSelectPatient={handleSelectPatient}
            onAddToWaitlist={async (e) => { await supabase.from('waitlist').insert([e]); fetchData(); }}
            onUpdateWaitlist={async (id, u) => { await supabase.from('waitlist').update(u).eq('id', id); fetchData(); }}
            onRemoveFromWaitlist={async (id) => { await supabase.from('waitlist').delete().eq('id', id); fetchData(); }}
            onAddAppointment={async (a) => { await supabase.from('appointments').insert([a]); fetchData(); return true; }}
            onUpdateAppointment={async (id, a) => { await supabase.from('appointments').update(a).eq('id', id); fetchData(); return true; }}
            onDeleteAppointment={async (id) => { await supabase.from('appointments').delete().eq('id', id); fetchData(); return true; }}
          />
        )}

        {activeView === 'Billing' && (
          <BillingPage 
            patients={patients} vets={vets} waitlist={waitlist} selectedPatientId={selectedPatientId || ''} onSelectPatient={handleSelectPatient}
            onAddToWaitlist={async (e) => { await supabase.from('waitlist').insert([e]); fetchData(); }}
            onUpdateWaitlist={async (id, u) => { await supabase.from('waitlist').update(u).eq('id', id); fetchData(); }}
            onRemoveFromWaitlist={async (id) => { await supabase.from('waitlist').delete().eq('id', id); fetchData(); }}
          />
        )}
      </main>

      {isSettingsOpen && (
        <SettingsModal 
          isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} vets={vets} clinicSettings={clinicSettings}
          onUpdateClinicSettings={async (s) => { await supabase.from('clinic_settings').upsert(s); fetchData(); }}
          onAddVet={async (v) => { await supabase.from('veterinarians').insert([v]); fetchData(); }}
          onRemoveVet={async (id) => { await supabase.from('veterinarians').delete().eq('id', id); fetchData(); }}
        />
      )}

      {fullScreenImage && <ImageModal src={fullScreenImage} onClose={() => setFullScreenImage(null)} />}
    </div>
  );
};

export default App;
