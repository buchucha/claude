
import React from 'react';
import { Patient } from '../types';

interface PatientCardProps {
  patient: Patient;
  isSelected: boolean;
  onClick: () => void;
}

export const PatientCard: React.FC<PatientCardProps> = ({ patient, isSelected, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`p-4 cursor-pointer transition-all border-b last:border-0 hover:bg-slate-100 ${
        isSelected ? 'bg-blue-50 border-r-4 border-r-blue-500' : 'bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <img src={patient.avatar} alt={patient.name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
        <div className="flex-1 overflow-hidden">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 truncate">{patient.name}</h3>
            <span className="text-xs text-slate-400">{patient.lastVisit}</span>
          </div>
          <p className="text-xs text-slate-500 truncate">{patient.breed} • {patient.gender}</p>
          <div className="flex gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              patient.species === 'Dog' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {patient.species}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
