
-- ==========================================
-- [REFACTOR] IMAGE SOURCE OF TRUTH MIGRATION
-- ==========================================

-- 1. soap_records 테이블에 order_id 컬럼 추가 (아직 없다면)
ALTER TABLE public.soap_records 
ADD COLUMN IF NOT EXISTS order_id UUID;

-- 2. department_orders 테이블과 외래키(FK) 연결
-- soap_records.order_id가 department_orders.id를 참조합니다.
ALTER TABLE public.soap_records 
ADD CONSTRAINT soap_records_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.department_orders(id)
ON DELETE SET NULL; -- 오더가 삭제되어도 차트 텍스트는 남기거나, CASCADE로 같이 지우거나 선택 가능

-- 3. 데이터 무결성: 한 오더는 하나의 SOAP 차트에만 연결 (UNIQUE)
ALTER TABLE public.soap_records 
ADD CONSTRAINT soap_records_order_id_key UNIQUE (order_id);

-- 4. (중요) 기존 데이터 연결 마이그레이션
-- 기존에는 department_orders에 soap_id가 있었으므로, 이를 역참조하여 soap_records.order_id를 채웁니다.
UPDATE public.soap_records sr
SET order_id = do.id
FROM public.department_orders do
WHERE do.soap_id = sr.id
AND sr.order_id IS NULL;

-- 5. 인덱스 생성 (조회 속도 향상)
CREATE INDEX IF NOT EXISTS idx_soap_records_order_id ON public.soap_records(order_id);
