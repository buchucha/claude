
import React from 'react';
import { Patient } from '../types';

interface ActivePatientBarProps {
  patient: Patient | null;
  onClear: () => void;
}

export const ActivePatientBar: React.FC<ActivePatientBarProps> = ({ patient, onClear }) => {
  if (!patient) return null;

  return (
    <div className="h-14 bg-slate-950/90 backdrop-blur-md border-b border-white/10 flex items-center px-8 justify-between animate-in slide-in-from-top duration-300 z-40">
      <div className="flex items-center gap-8">
        {/* 1. 이미지 */}
        <div className="relative group">
          <img 
            src={patient.avatar} 
            className="w-9 h-9 rounded-xl object-cover border border-white/20 shadow-lg group-hover:scale-110 transition-transform" 
            alt={patient.name} 
          />
        </div>

        <div className="flex items-center gap-6">
          {/* 2. 보호자 이름 */}
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Guardian</span>
            <span className="text-white font-bold text-sm">{patient.owner}</span>
          </div>

          <div className="h-6 w-px bg-white/10"></div>

          {/* 3. 환자 이름 */}
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Patient</span>
            <span className="text-white font-black text-base tracking-tight italic">{patient.name}</span>
          </div>

          <div className="h-6 w-px bg-white/10"></div>

          {/* 4. 성별(중성화) */}
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Gender</span>
            <span className="text-slate-200 font-bold text-xs">{patient.gender}</span>
          </div>

          {/* 5. 나이 */}
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Age</span>
            <span className="text-slate-200 font-bold text-xs">{patient.age}</span>
          </div>

          {/* 6. 체중 */}
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Weight</span>
            <span className="text-white font-black text-sm">{patient.weight} <span className="text-[10px] text-slate-500">kg</span></span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={onClear}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-rose-600/20 text-slate-500 hover:text-rose-400 transition-all flex items-center justify-center group border border-white/5"
          title="환자 선택 해제"
        >
          <i className="fas fa-times text-xs group-hover:scale-110 transition-transform"></i>
        </button>
      </div>
    </div>
  );
};
