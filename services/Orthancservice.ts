/**
 * Orthanc REST API 서비스
 * - Accession Number로 Study 검색
 * - Study → Series → Instance(이미지) 조회
 * - 이미지 미리보기 URL 생성
 * 
 * 사용법: clinic_settings.imageServerUrl에 Orthanc 주소 설정
 * 예: http://100.75.49.52:8042
 */

// Orthanc 기본 URL (Settings에서 가져오거나 기본값 사용)
let ORTHANC_BASE_URL = '';

export const setOrthancBaseUrl = (url: string) => {
  // 끝에 슬래시 제거
  ORTHANC_BASE_URL = url.replace(/\/+$/, '');
};

export const getOrthancBaseUrl = () => ORTHANC_BASE_URL;

// ============================================
// 타입 정의
// ============================================

export interface OrthancStudy {
  ID: string;
  MainDicomTags: {
    AccessionNumber?: string;
    StudyDate?: string;
    StudyDescription?: string;
    StudyID?: string;
  };
  PatientMainDicomTags: {
    PatientName?: string;
    PatientID?: string;
  };
  Series: string[];
}

export interface OrthancSeries {
  ID: string;
  MainDicomTags: {
    Modality?: string;
    SeriesDescription?: string;
    SeriesNumber?: string;
  };
  Instances: string[];
}

export interface OrthancInstance {
  ID: string;
  IndexInSeries: number;
  MainDicomTags: {
    InstanceNumber?: string;
  };
}

export interface OrthancImageResult {
  studyId: string;
  studyDate: string;
  instances: {
    id: string;
    previewUrl: string;
    downloadUrl: string;
    index: number;
  }[];
}

// ============================================
// API 호출 함수들
// ============================================

/**
 * Accession Number로 Orthanc에서 Study 검색
 */
export const findStudyByAccessionNumber = async (accessionNumber: string): Promise<OrthancStudy | null> => {
  if (!ORTHANC_BASE_URL || !accessionNumber) return null;

  try {
    // Orthanc의 /tools/find API로 검색
    const response = await fetch(`${ORTHANC_BASE_URL}/tools/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Level: 'Study',
        Query: { AccessionNumber: accessionNumber }
      })
    });

    if (!response.ok) return null;

    const studyIds: string[] = await response.json();
    if (studyIds.length === 0) return null;

    // 첫 번째 매칭 Study의 상세 정보 가져오기
    const detailRes = await fetch(`${ORTHANC_BASE_URL}/studies/${studyIds[0]}`);
    if (!detailRes.ok) return null;

    return await detailRes.json();
  } catch (error) {
    console.error('[Orthanc] Study 검색 실패:', error);
    return null;
  }
};

/**
 * Study ID로 모든 이미지(Instance) 정보 가져오기
 */
export const getStudyImages = async (studyId: string): Promise<OrthancImageResult | null> => {
  if (!ORTHANC_BASE_URL || !studyId) return null;

  try {
    // Study 상세 정보
    const studyRes = await fetch(`${ORTHANC_BASE_URL}/studies/${studyId}`);
    if (!studyRes.ok) return null;
    const study: OrthancStudy = await studyRes.json();

    // 모든 Series의 Instance 수집
    const allInstances: OrthancImageResult['instances'] = [];

    for (const seriesId of study.Series) {
      const seriesRes = await fetch(`${ORTHANC_BASE_URL}/series/${seriesId}`);
      if (!seriesRes.ok) continue;
      const series: OrthancSeries = await seriesRes.json();

      // 각 Instance의 미리보기 URL 생성
      for (const instanceId of series.Instances) {
        allInstances.push({
          id: instanceId,
          previewUrl: `${ORTHANC_BASE_URL}/instances/${instanceId}/preview`,
          downloadUrl: `${ORTHANC_BASE_URL}/instances/${instanceId}/file`,
          index: allInstances.length
        });
      }
    }

    return {
      studyId,
      studyDate: study.MainDicomTags.StudyDate || '',
      instances: allInstances
    };
  } catch (error) {
    console.error('[Orthanc] 이미지 조회 실패:', error);
    return null;
  }
};

/**
 * Accession Number로 바로 이미지 목록 가져오기 (편의 함수)
 */
export const getImagesByAccessionNumber = async (accessionNumber: string): Promise<OrthancImageResult | null> => {
  const study = await findStudyByAccessionNumber(accessionNumber);
  if (!study) return null;
  return await getStudyImages(study.ID);
};

/**
 * Instance의 미리보기 이미지 URL 반환
 */
export const getPreviewUrl = (instanceId: string): string => {
  return `${ORTHANC_BASE_URL}/instances/${instanceId}/preview`;
};

/**
 * DICOM 원본 파일 다운로드 URL
 */
export const getDicomFileUrl = (instanceId: string): string => {
  return `${ORTHANC_BASE_URL}/instances/${instanceId}/file`;
};

/**
 * Orthanc 연결 테스트
 */
export const testConnection = async (): Promise<boolean> => {
  if (!ORTHANC_BASE_URL) return false;
  try {
    const res = await fetch(`${ORTHANC_BASE_URL}/system`, { 
      signal: AbortSignal.timeout(5000) 
    });
    return res.ok;
  } catch {
    return false;
  }
};
