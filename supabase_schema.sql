-- ============================================
-- 0. 초기 설정 및 헬퍼 함수
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION enable_all_access(tbl text) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS "AllAccess" ON %I', tbl);
  EXECUTE format('CREATE POLICY "AllAccess" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. 핵심 마스터 테이블
-- ============================================

-- 1.1 수의사
CREATE TABLE IF NOT EXISTS public.veterinarians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT DEFAULT 'General',
    email TEXT UNIQUE,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('veterinarians');

-- 1.2 환자
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_number TEXT,
    name TEXT NOT NULL,
    species TEXT,
    breed TEXT,
    birth_date DATE,
    gender TEXT,
    weight DECIMAL(5,2),
    owner TEXT,
    phone TEXT,
    address TEXT,
    chip_number TEXT,
    last_visit TIMESTAMP WITH TIME ZONE,
    avatar TEXT,
    notes TEXT,
    medical_memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patients_chart_number ON public.patients(chart_number);
SELECT enable_all_access('patients');

-- 1.3 대기열
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT,
    breed TEXT,
    owner_name TEXT,
    vet_id TEXT REFERENCES veterinarians(id),
    status TEXT DEFAULT 'Waiting',
    memo TEXT,
    type TEXT DEFAULT 'Consultation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('waitlist');

-- 1.4 예약
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vet_id TEXT REFERENCES veterinarians(id),
    patient_id UUID REFERENCES patients(id),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT,
    is_recurring BOOLEAN DEFAULT false,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('appointments');

-- 1.5 품종 데이터
CREATE TABLE IF NOT EXISTS public.breeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    species TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(species, name)
);
SELECT enable_all_access('breeds');

-- 1.6 진단명 데이터
CREATE TABLE IF NOT EXISTS public.reference_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('reference_diagnoses');

-- ============================================
-- 2. 임상 데이터 (SOAP 및 상세 기록)
-- ============================================

-- 2.1 SOAP 차트
CREATE TABLE IF NOT EXISTS public.soap_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    cc TEXT,
    subjective TEXT,
    objective TEXT,
    assessment_problems TEXT,
    assessment_ddx JSONB DEFAULT '[]'::jsonb,
    plan_tx TEXT,
    plan_rx TEXT,
    plan_summary TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    attachment_url TEXT,
    lab_results JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('soap_records');

-- 2.2 체중 기록
CREATE TABLE IF NOT EXISTS public.patient_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  weight DECIMAL(5,2),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('patient_weights');

-- 2.3 예방접종 (강아지)
CREATE TABLE IF NOT EXISTS public.patient_vaccination_canine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  current_round INTEGER DEFAULT 0,
  last_date DATE,
  next_date DATE,
  UNIQUE(patient_id, vaccine_name)
);
SELECT enable_all_access('patient_vaccination_canine');

-- 2.4 예방접종 (고양이)
CREATE TABLE IF NOT EXISTS public.patient_vaccination_feline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  current_round INTEGER DEFAULT 0,
  last_date DATE,
  next_date DATE,
  UNIQUE(patient_id, vaccine_name)
);
SELECT enable_all_access('patient_vaccination_feline');

-- 2.5 기생충 예방
CREATE TABLE IF NOT EXISTS public.patient_parasites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  last_heartworm_date DATE,
  next_heartworm_date DATE,
  last_internal_date DATE,
  next_internal_date DATE,
  last_external_date DATE,
  next_external_date DATE
);
SELECT enable_all_access('patient_parasites');

-- 2.6 리마인더
CREATE TABLE IF NOT EXISTS public.patient_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  last_scaling_date DATE,
  next_scaling_date DATE,
  last_antibody_date DATE,
  next_antibody_date DATE,
  long_term_med_info TEXT,
  last_med_date DATE,
  next_med_date DATE,
  med_interval_days INTEGER DEFAULT 30
);
SELECT enable_all_access('patient_reminders');

-- ============================================
-- 3. 부서 오더
-- ============================================

DO $$
BEGIN
    CREATE TABLE IF NOT EXISTS public.department_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        patient_name TEXT NOT NULL,
        department TEXT NOT NULL,
        vet_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS soap_id UUID REFERENCES public.soap_records(id);
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS request_details TEXT;
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS attachment_url TEXT;
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
    ALTER TABLE public.department_orders ADD COLUMN IF NOT EXISTS accession_number TEXT;

    UPDATE public.department_orders SET department = 'Treatment' WHERE department = 'Laboratory';
    UPDATE public.department_orders SET department = 'X-ray' WHERE department IN ('Imaging', 'Radiology');
    UPDATE public.department_orders SET department = 'Ultrasound' WHERE department IN ('Physical', 'Ultrasound');

    ALTER TABLE public.department_orders DROP CONSTRAINT IF EXISTS department_orders_department_check;
    ALTER TABLE public.department_orders ADD CONSTRAINT department_orders_department_check
    CHECK (department IN ('Treatment', 'Pharmacy', 'X-ray', 'Ultrasound'));

EXCEPTION WHEN others THEN RAISE NOTICE 'Order table fix error: %', SQLERRM;
END $$;
SELECT enable_all_access('department_orders');

-- Accession Number 자동 생성 트리거
CREATE OR REPLACE FUNCTION generate_accession_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.accession_number IS NULL THEN
    NEW.accession_number := LPAD(
      (ABS(('x' || MD5(NEW.id::text))::bit(64)::bigint) % 10000000000000000)::text,
      16, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_accession_number ON department_orders;
CREATE TRIGGER set_accession_number
BEFORE INSERT ON department_orders
FOR EACH ROW
EXECUTE FUNCTION generate_accession_number();

-- 기존 NULL accession_number 채우기
UPDATE department_orders
SET accession_number = LPAD(
  (ABS(('x' || MD5(id::text))::bit(64)::bigint) % 10000000000000000)::text,
  16, '0'
)
WHERE accession_number IS NULL;

-- ============================================
-- 4. 빌링 시스템
-- ============================================

-- 4.1 서비스 카탈로그
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'CONSULTATION', 'LABORATORY', 'PROCEDURE', 'PHARMACY',
    'HOSPITALIZATION', 'SUPPLIES', 'PREVENTION', 'FOOD', 'IMAGING'
  )),
  subcategory TEXT,
  name TEXT NOT NULL,
  sku_code TEXT UNIQUE,
  default_price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2) DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category);
SELECT enable_all_access('service_catalog');

-- 4.2 청구서
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Paid', 'Partial', 'Cancelled')),
  total_amount DECIMAL(10,2) DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  payment_method JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('billing_invoices');

-- 4.3 청구 항목
CREATE TABLE IF NOT EXISTS public.billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  linked_order_id UUID REFERENCES department_orders(id) ON DELETE CASCADE,
  service_id UUID REFERENCES service_catalog(id),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  performing_vet_id TEXT REFERENCES veterinarians(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unit_price DECIMAL(10,2) NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('billing_items');

-- ============================================
-- 5. PACS 연동
-- ============================================

-- 5.1 영상 연구 테이블
CREATE TABLE IF NOT EXISTS public.imaging_studies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    soap_id UUID REFERENCES public.soap_records(id),
    orthanc_study_id TEXT NOT NULL,
    modality TEXT,
    study_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
SELECT enable_all_access('imaging_studies');

-- 5.2 Worklist 뷰 (DICOM MWL용)
DROP VIEW IF EXISTS public.view_imaging_worklist CASCADE;

CREATE VIEW public.view_imaging_worklist AS
SELECT
    o.id::text AS id,
    o.accession_number,
    o.patient_id,
    p.chart_number,
    p.name AS patient_name,
    TO_CHAR(p.birth_date, 'YYYYMMDD') AS birth_date,
    CASE
        WHEN p.gender ILIKE '%male%' AND p.gender NOT ILIKE '%female%' THEN 'M'
        WHEN p.gender ILIKE '%female%' THEN 'F'
        ELSE 'O'
    END AS gender,
    COALESCE(o.request_details, 'X-RAY') AS procedure_desc,
    TO_CHAR(o.created_at, 'YYYYMMDD') AS scheduled_date,
    TO_CHAR(o.created_at, 'HH24MISS') AS scheduled_time,
    o.status
FROM public.department_orders o
JOIN public.patients p ON o.patient_id = p.id
WHERE o.department = 'X-ray' AND o.status = 'Pending';

GRANT SELECT ON public.view_imaging_worklist TO anon, authenticated, service_role;

-- ============================================
-- 6. SOAP ↔ Order 연결
-- ============================================

ALTER TABLE public.soap_records
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.department_orders(id);

ALTER TABLE public.soap_records
DROP CONSTRAINT IF EXISTS soap_records_order_id_key;

ALTER TABLE public.soap_records
ADD CONSTRAINT soap_records_order_id_key UNIQUE (order_id);

UPDATE public.soap_records sr
SET order_id = dept_orders.id
FROM public.department_orders dept_orders
WHERE dept_orders.soap_id = sr.id
AND sr.order_id IS NULL;

-- ============================================
-- 7. 실시간 구독 및 초기 데이터
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime FOR TABLE patients, waitlist, soap_records, appointments, veterinarians, department_orders, billing_items;
    ELSE
        ALTER PUBLICATION supabase_realtime ADD TABLE patients, waitlist, soap_records, appointments, veterinarians, department_orders, billing_items;
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.veterinarians (id, name, specialty, avatar)
VALUES ('mindonesia0000@gmail.com', '관리자 원장', 'Internal Med', 'https://i.pravatar.cc/150?u=mindonesia0000@gmail.com')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.service_catalog (category, subcategory, name, default_price, sku_code) VALUES
('CONSULTATION', 'General', '초진 진료비 (General Consult)', 15000, 'CON-001'),
('IMAGING', 'X-ray', 'Digital X-ray (1 view)', 33000, 'IMG-XR1')
ON CONFLICT (sku_code) DO NOTHING;

-- ============================================
-- 8. 스토리지 설정
-- ============================================

DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('order_images', 'order_images', true)
    ON CONFLICT (id) DO NOTHING;
END $$;

DO $$
BEGIN
   BEGIN
       DROP POLICY IF EXISTS "Public Uploads" ON storage.objects;
       DROP POLICY IF EXISTS "Public View" ON storage.objects;
       DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
   EXCEPTION WHEN OTHERS THEN NULL; END;

   BEGIN
       CREATE POLICY "Public Uploads" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'order_images' );
       CREATE POLICY "Public View" ON storage.objects FOR SELECT USING ( bucket_id = 'order_images' );
       CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING ( bucket_id = 'order_images' );
   EXCEPTION WHEN OTHERS THEN
       RAISE NOTICE 'Storage policy creation skipped due to permissions. Please use Supabase UI.';
   END;
END $$;

-- 스키마 리로드
NOTIFY pgrst, 'reload schema';
