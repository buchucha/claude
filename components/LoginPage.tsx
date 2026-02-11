
import React, { useState, useEffect, useRef } from 'react';

interface LoginPageProps {
  onLogin: (user: { name: string; email: string }) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // 구글 클라이언트 ID (실제 운영 시 변경 필요)
  const GOOGLE_CLIENT_ID = "982231520614-glj0ark21p9lgs5h1o579ahb7i2bc8j9.apps.googleusercontent.com";
  const currentOrigin = window.location.origin;

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (window.google && window.google.accounts) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            use_fedcm_for_prompt: false,
          });

          if (googleButtonRef.current) {
            window.google.accounts.id.renderButton(googleButtonRef.current, {
              theme: 'filled_blue',
              size: 'large',
              width: googleButtonRef.current.offsetWidth,
              shape: 'pill',
            });
          }
        } catch (err) {
          console.error("Google Init Error:", err);
        }
      }
    };

    const interval = setInterval(() => {
      if (window.google && window.google.accounts) {
        initializeGoogleSignIn();
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const handleCredentialResponse = (response: any) => {
    setIsLoading(true);
    try {
      const payload = parseJwt(response.credential);
      onLogin({
        name: payload.name || payload.given_name || 'Medical Staff',
        email: payload.email
      });
    } catch (err) {
      setError("인증 정보 해석 오류");
      setIsLoading(false);
    }
  };

  const parseJwt = (token: string) => {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  };

  // 개발자용 긴급 우회 로그인
  const handleDeveloperBypass = () => {
    setIsLoading(true);
    // 0.5초 후 즉시 관리자 계정으로 로그인 처리
    setTimeout(() => {
      onLogin({
        name: "Developer (Master)",
        email: "mindonesia0000@gmail.com" // App.tsx의 ADMIN_EMAIL과 일치시킴
      });
    }, 500);
  };

  const copyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-['Inter']">
      {/* 배경 장식 */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-slate-900 border border-white/5 rounded-[48px] p-12 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl mb-8 group overflow-hidden relative">
              <i className="fas fa-plus text-white text-3xl z-10"></i>
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic text-center mb-2">IKAVA</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Clinical Dashboard</p>
          </div>

          <div className="space-y-6">
            {/* 구글 로그인 렌더링 영역 */}
            <div className="flex flex-col gap-4">
              <div ref={googleButtonRef} className="w-full min-h-[44px] flex justify-center"></div>
              
              <div className="flex items-center gap-4 opacity-20">
                <div className="flex-1 h-px bg-white"></div>
                <span className="text-[10px] text-white font-black uppercase">Or</span>
                <div className="flex-1 h-px bg-white"></div>
              </div>

              {/* 긴급 우회 버튼 */}
              <button 
                onClick={handleDeveloperBypass}
                className="w-full py-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-2xl text-[11px] font-black text-blue-400 uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center justify-center gap-3 group"
              >
                <i className="fas fa-terminal text-blue-500 group-hover:text-blue-300"></i>
                개발자 전용 긴급 접속 (Bypass)
              </button>
            </div>

            {/* 디버그 정보 */}
            <div className="bg-black/40 rounded-3xl p-6 border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <i className="fas fa-bug text-slate-600 text-[10px]"></i>
                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Environment Info</h3>
              </div>
              <code className="block text-[10px] text-slate-600 font-mono truncate mb-3">{currentOrigin}</code>
              <button 
                onClick={copyOrigin}
                className="text-[9px] font-black text-blue-500/60 uppercase tracking-widest hover:text-blue-400 transition-colors"
              >
                {copied ? 'Origin Copied!' : 'Copy Origin for Google Console'}
              </button>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center gap-2">
            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-ping"></div>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Initialising Session...</p>
              </div>
            ) : (
              <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest italic">Secure Clinical Gateway v2.5</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
