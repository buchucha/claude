
import React, { useEffect, useState } from 'react';
import { getPatientLatestStudy } from '../services/OrthancService';

interface PacsViewerProps {
  chartNumber: string;
  patientName: string;
  onClose: () => void;
}

export const PacsViewer: React.FC<PacsViewerProps> = ({ chartNumber, patientName, onClose }) => {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudy = async () => {
      if (!chartNumber) {
        setError('No Chart Number associated with this patient.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const uid = await getPatientLatestStudy(chartNumber);
      
      if (uid) {
        // Construct OHIF Viewer URL
        // Format: https://ikava.tailbce91b.ts.net:8443/ohif/viewer?StudyInstanceUIDs=[UID]
        const url = `https://ikava.tailbce91b.ts.net:8443/ohif/viewer?StudyInstanceUIDs=${uid}`;
        setViewerUrl(url);
      } else {
        setError('No DICOM studies found for this patient.');
      }
      setIsLoading(false);
    };

    fetchStudy();
  }, [chartNumber]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-[95vw] h-[90vh] bg-black rounded-xl overflow-hidden shadow-2xl flex flex-col relative border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
             <i className="fas fa-x-ray text-blue-500"></i>
             <span className="text-slate-300 font-bold text-xs uppercase tracking-wider">PACS Viewer - {patientName} ({chartNumber || 'N/A'})</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 bg-black relative flex items-center justify-center">
           {isLoading && (
              <div className="text-center text-slate-400">
                 <i className="fas fa-circle-notch fa-spin text-2xl mb-2"></i>
                 <p className="text-[10px] uppercase tracking-widest">Searching Orthanc Server...</p>
              </div>
           )}
           
           {!isLoading && error && (
              <div className="text-center text-slate-500">
                 <i className="fas fa-exclamation-triangle text-2xl mb-2 text-amber-600"></i>
                 <p className="font-bold text-sm text-slate-300 mb-1">{error}</p>
                 <p className="text-[10px] uppercase tracking-widest">Please check if the Patient ID matches the Chart No.</p>
              </div>
           )}

           {!isLoading && viewerUrl && (
              <iframe 
                src={viewerUrl} 
                className="w-full h-full border-0" 
                allow="fullscreen"
                title="OHIF Viewer"
              ></iframe>
           )}
        </div>
      </div>
    </div>
  );
};
