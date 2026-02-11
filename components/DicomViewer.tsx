/**
 * DicomViewer - X-ray 이미지 뷰어 모달
 * 
 * Accession Number를 받아서 Orthanc에서 이미지를 가져와 표시합니다.
 * 기능: 이미지 로드, 밝기/대비 조절, 확대/축소, 다중 이미지 탐색
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getImagesByAccessionNumber, OrthancImageResult, getOrthancBaseUrl } from '../services/Orthancservice';
interface DicomViewerProps {
  accessionNumber: string;
  patientName?: string;
  onClose: () => void;
}

export const DicomViewer: React.FC<DicomViewerProps> = ({ accessionNumber, patientName, onClose }) => {
  const [imageData, setImageData] = useState<OrthancImageResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 이미지 조작 상태
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [invert, setInvert] = useState(false);
  const [rotation, setRotation] = useState(0);
  
  // 팬(드래그 이동) 상태
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  const imageRef = useRef<HTMLDivElement>(null);

  // Orthanc에서 이미지 로드
  useEffect(() => {
    const loadImages = async () => {
      setIsLoading(true);
      setError(null);
      
      if (!getOrthancBaseUrl()) {
        setError('Orthanc 서버 주소가 설정되지 않았습니다.\nSettings → Image Server URL에 입력해주세요.');
        setIsLoading(false);
        return;
      }

      const result = await getImagesByAccessionNumber(accessionNumber);
      if (result && result.instances.length > 0) {
        setImageData(result);
      } else {
        setError('해당 Accession Number에 연결된 이미지를 찾을 수 없습니다.\n촬영이 완료되었는지 확인해주세요.');
      }
      setIsLoading(false);
    };

    loadImages();
  }, [accessionNumber]);

  // 키보드 단축키
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': navigateImage(-1); break;
        case 'ArrowRight': navigateImage(1); break;
        case 'r': case 'R': resetView(); break;
        case 'i': case 'I': setInvert(v => !v); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [imageData, currentIndex]);

  // 마우스 휠 줌
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.2, Math.min(5, prev + delta)));
  }, []);

  // 팬 시작
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // 좌클릭
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  // 이미지 네비게이션
  const navigateImage = (direction: number) => {
    if (!imageData) return;
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < imageData.instances.length) {
      setCurrentIndex(newIndex);
    }
  };

  // 뷰 초기화
  const resetView = () => {
    setBrightness(100);
    setContrast(100);
    setZoom(1);
    setInvert(false);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const currentInstance = imageData?.instances[currentIndex];

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* 상단 툴바 */}
      <div className="h-12 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-4 flex-shrink-0">
        {/* 왼쪽: 환자 정보 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <i className="fas fa-x-ray text-blue-400 text-sm"></i>
            <span className="text-white text-xs font-bold">{patientName || 'Unknown'}</span>
          </div>
          <span className="text-gray-500 text-[10px] font-mono">ACC# {accessionNumber}</span>
          {imageData && (
            <span className="text-gray-400 text-[10px]">
              {imageData.studyDate ? `${imageData.studyDate.slice(0,4)}-${imageData.studyDate.slice(4,6)}-${imageData.studyDate.slice(6,8)}` : ''}
            </span>
          )}
        </div>

        {/* 가운데: 도구 버튼들 */}
        <div className="flex items-center gap-1">
          <ToolButton icon="fa-undo" label="Reset" onClick={resetView} />
          <ToolButton icon="fa-adjust" label={invert ? 'Normal' : 'Invert'} onClick={() => setInvert(v => !v)} active={invert} />
          <ToolButton icon="fa-redo" label="Rotate" onClick={() => setRotation(r => (r + 90) % 360)} />
          
          <div className="w-px h-6 bg-gray-700 mx-1"></div>
          
          <ToolButton icon="fa-search-minus" label="Zoom-" onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} />
          <span className="text-gray-400 text-[10px] font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <ToolButton icon="fa-search-plus" label="Zoom+" onClick={() => setZoom(z => Math.min(5, z + 0.2))} />

          <div className="w-px h-6 bg-gray-700 mx-1"></div>

          {/* 밝기 슬라이더 */}
          <div className="flex items-center gap-1">
            <i className="fas fa-sun text-yellow-400 text-[10px]"></i>
            <input 
              type="range" min="20" max="300" value={brightness} 
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-16 h-1 accent-yellow-400"
            />
          </div>

          {/* 대비 슬라이더 */}
          <div className="flex items-center gap-1 ml-2">
            <i className="fas fa-circle-half-stroke text-orange-400 text-[10px]"></i>
            <input 
              type="range" min="20" max="300" value={contrast} 
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-16 h-1 accent-orange-400"
            />
          </div>
        </div>

        {/* 오른쪽: 이미지 네비게이션 & 닫기 */}
        <div className="flex items-center gap-3">
          {imageData && imageData.instances.length > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => navigateImage(-1)} disabled={currentIndex === 0}
                className="w-6 h-6 rounded bg-gray-700 text-white text-[10px] disabled:opacity-30 hover:bg-gray-600">
                <i className="fas fa-chevron-left"></i>
              </button>
              <span className="text-gray-300 text-[10px] font-mono">
                {currentIndex + 1} / {imageData.instances.length}
              </span>
              <button onClick={() => navigateImage(1)} disabled={currentIndex === imageData.instances.length - 1}
                className="w-6 h-6 rounded bg-gray-700 text-white text-[10px] disabled:opacity-30 hover:bg-gray-600">
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
          
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-red-600/80 hover:bg-red-500 text-white flex items-center justify-center transition-colors">
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>
      </div>

      {/* 이미지 영역 */}
      <div 
        ref={imageRef}
        className="flex-1 overflow-hidden bg-black flex items-center justify-center relative"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        {isLoading && (
          <div className="flex flex-col items-center gap-3">
            <i className="fas fa-spinner fa-spin text-blue-400 text-2xl"></i>
            <span className="text-gray-400 text-sm">이미지 로딩 중...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-center px-8">
            <i className="fas fa-exclamation-triangle text-yellow-500 text-2xl"></i>
            <span className="text-gray-300 text-sm whitespace-pre-line">{error}</span>
          </div>
        )}

        {currentInstance && (
          <img 
            src={currentInstance.previewUrl}
            alt={`X-ray ${currentIndex + 1}`}
            draggable={false}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              filter: `brightness(${brightness}%) contrast(${contrast}%) ${invert ? 'invert(1)' : ''}`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: isPanning ? 'none' : 'transform 0.15s ease-out',
              userSelect: 'none',
            }}
          />
        )}
      </div>

      {/* 하단 단축키 안내 */}
      <div className="h-7 bg-gray-900 border-t border-gray-700 flex items-center justify-center gap-6 flex-shrink-0">
        <KeyHint keys="Scroll" label="Zoom" />
        <KeyHint keys="Drag" label="Pan" />
        <KeyHint keys="I" label="Invert" />
        <KeyHint keys="R" label="Reset" />
        <KeyHint keys="←→" label="Navigate" />
        <KeyHint keys="ESC" label="Close" />
      </div>
    </div>
  );
};

// 툴바 버튼 컴포넌트
const ToolButton: React.FC<{ icon: string; label: string; onClick: () => void; active?: boolean }> = ({ icon, label, onClick, active }) => (
  <button 
    onClick={onClick} 
    title={label}
    className={`w-7 h-7 rounded flex items-center justify-center text-[11px] transition-colors
      ${active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
  >
    <i className={`fas ${icon}`}></i>
  </button>
);

// 단축키 힌트
const KeyHint: React.FC<{ keys: string; label: string }> = ({ keys, label }) => (
  <div className="flex items-center gap-1.5">
    <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-[8px] text-gray-300 font-mono">{keys}</kbd>
    <span className="text-gray-500 text-[8px]">{label}</span>
  </div>
);

export default DicomViewer;
