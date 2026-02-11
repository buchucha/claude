
import { createClient } from '@supabase/supabase-js';

// 수의사님이 제공해주신 Supabase 연결 정보
const supabaseUrl = 'https://obnddbarhbkrlfaojedg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibmRkYmFyaGJrcmxmYW9qZWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTcyNzksImV4cCI6MjA4NDAzMzI3OX0.209m4hDKb89nDf84LwRWiTGibj1Z11wPX7we4umc-ZU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 실시간 변경 사항 구독 (접수/대기 리스트 등)
 */
export const subscribeToWaitlist = (callback: (payload: any) => void) => {
  return supabase
    .channel('public:waitlist')
    .on('postgres_changes', { event: '*', table: 'waitlist', schema: 'public' }, callback)
    .subscribe();
};
