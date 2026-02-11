
export type AppView = 'Reception' | 'Consultation' | 'Examination' | 'Appointment' | 'Billing';

export enum Species {
  DOG = 'Dog',
  CAT = 'Cat',
  OTHER = 'Other'
}

export interface Patient {
  id: string;
  chartNumber?: string;
  name: string;
  owner: string;
  phone: string;
  species: Species;
  breed: string;
  gender: string;
  weight: number;
  age: string;
  birth_date?: string;
  avatar: string;
  lastVisit: string;
  medical_memo?: string;
}

export interface LabResults {
  cbc: any;
  chemistry: any;
}

export interface SOAPRecord {
  id: string;
  patientId: string;
  order_id?: string; 
  date: string;
  cc: string;
  subjective: string;
  objective: string;
  assessmentProblems: string;
  assessmentDdx: string[];
  planTx: string;           
  planRx: string;           
  planSummary: string;
  
  // Images are derived from JOIN with department_orders
  images?: string[]; 
  
  labResults?: LabResults;
}

export type SOAPField = keyof SOAPRecord;

export interface Veterinarian {
  id: string;
  name: string;
  specialty: string;
  email: string;
  avatar: string;
}

export interface WaitlistEntry {
  id: string;
  patientId: string;
  patientName: string;
  breed: string;
  ownerName: string;
  vetId: string | null;
  time: string;
  memo: string;
  type: string;
}

export interface ClinicSettings {
  lunchStartTime: string;
  lunchEndTime: string;
  isLunchEnabled: boolean;
  imageServerUrl?: string;
}

export interface DiagnosisReference {
  id: string;
  name: string;
}

export type ServiceCategory = 'CONSULTATION' | 'IMAGING' | 'LABORATORY' | 'PROCEDURE' | 
  'PHARMACY' | 'PREVENTION' | 'FOOD' | 'SUPPLIES' | 'HOSPITALIZATION';

export interface ServiceCatalogItem {
  id: string;
  category: ServiceCategory;
  name: string;
  default_price: number;
  sku_code?: string;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  vetId: string;
  patientId?: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  isRecurring: boolean;
  color: string;
}

export interface BillingItem {
  id: string;
  invoice_id?: string;
  service_id?: string;
  name: string;
  category?: ServiceCategory;
  unit_price: number;
  quantity: number;
  total_price: number;
  performingVetId?: string;
  order_index?: number;
}

export interface PatientWeight {
  id: string;
  patient_id: string;
  weight: number;
  recorded_at: string;
}

export interface PatientVaccination {
  id: string;
  patient_id: string;
  vaccine_name: string;
  current_round: number;
  last_date: string | null;
  next_date: string | null;
}

export interface PatientReminders {
  patient_id: string;
  last_med_date?: string | null;
  next_med_date?: string | null;
  med_interval_days?: number;
  long_term_med_info?: string;
  last_scaling_date?: string | null;
  next_scaling_date?: string | null;
  last_antibody_date?: string | null;
  next_antibody_date?: string | null;
}

export interface PatientParasites {
  patient_id: string;
  last_heartworm_date?: string | null;
  next_heartworm_date?: string | null;
  last_external_date?: string | null;
  next_external_date?: string | null;
  last_internal_date?: string | null;
  next_internal_date?: string | null;
}

export type DepartmentType = 'Treatment' | 'Pharmacy' | 'X-ray' | 'Ultrasound';

export interface OrderImage {
  url: string;
  name: string;
  uploadedAt?: string; // New: Timestamp of upload
  description?: string; // New: Editable note
}

export interface DepartmentOrder {
  id: string;
  patient_id: string;
  patient_name: string;
  soap_id?: string;
  department: DepartmentType;
  vet_name: string;
  request_details: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  items?: BillingItem[];
  images?: OrderImage[];
  order_index?: number;
  created_at?: string;
  // Join 데이터 구조
  patients?: { 
    chart_number: string;
  };
  view_imaging_worklist?: {
    accession_number: string;
  }[];
}

export interface Breed {
  id: string;
  species: Species;
  name: string;
}

export interface ConsultationPageProps {
  activePatient: Patient | null;
  onImageDoubleClick: (src: string) => void;
  vets: Veterinarian[];
  clinicSettings: ClinicSettings;
  patients: Patient[];
  waitlist: WaitlistEntry[];
  onSelectPatient: (id: string) => void;
  onAddToWaitlist: (entry: Partial<WaitlistEntry>) => Promise<void>;
  onUpdateWaitlist: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  onRemoveFromWaitlist: (id: string) => Promise<void>;
}
