import React, { useState } from 'react';
import { FireLogo } from '../components/FireLogo';
import { authService } from '../services/authService';
import { UserRole } from '../types';
import { INITIAL_USERS } from '../services/mockData';
import {
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AuthViewProps {
  onLoginSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('SECURITY');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Status state
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    setTimeout(() => {
      const res = authService.login(loginEmail, loginPassword);
      setIsLoading(false);
      if (res.success) {
        setSuccessMsg('Đăng nhập thành công! Đang chuyển hướng...');
        setTimeout(() => {
          onLoginSuccess();
        }, 500);
      } else {
        setErrorMsg(res.message || 'Đăng nhập không thành công.');
      }
    }, 400);
  };

  const handleQuickDemoLogin = (userEmail: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);
    setLoginEmail(userEmail);
    setLoginPassword('••••••••');

    setTimeout(() => {
      authService.login(userEmail);
      setIsLoading(false);
      onLoginSuccess();
    }, 300);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (regPassword && regConfirmPassword && regPassword !== regConfirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = authService.register(regName, regEmail, regRole, regPhone);
      setIsLoading(false);

      if (res.success) {
        setSuccessMsg('Tạo tài khoản thành công! Hệ thống đang khởi tạo...');
        setTimeout(() => {
          onLoginSuccess();
        }, 600);
      } else {
        setErrorMsg(res.message || 'Đăng ký không thành công.');
      }
    }, 400);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#070C1B] text-slate-100 overflow-hidden font-sans selection:bg-red-500 selection:text-white p-4">
      {/* Background Animated Glow Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-red-600/20 blur-3xl pointer-events-none animate-pulse" />
      <div
        className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '4s' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-md my-8">
        {/* Top Logo Container */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <div className="mb-2 transition-transform hover:scale-105 duration-300">
            <FireLogo variant="full" size={48} styleVariant="glow-badge" textColor="text-white" />
          </div>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed mt-1">
            Hệ thống giám sát và cảnh báo khói & lửa thông minh real-time AI dành cho doanh nghiệp
          </p>
        </div>

        {/* Form Box Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 md:p-8 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
          {/* Tabs Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800/80 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('LOGIN');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'LOGIN'
                  ? 'bg-red-600 text-white shadow-md shadow-red-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              ĐĂNG NHẬP
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('REGISTER');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'REGISTER'
                  ? 'bg-red-600 text-white shadow-md shadow-red-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              ĐĂNG KÝ MỚI
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-red-950/70 border border-red-500/40 p-3 mb-4 text-xs text-red-300 animate-in fade-in-50">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-950/70 border border-emerald-500/40 p-3 mb-4 text-xs text-emerald-300 animate-in fade-in-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Email hoặc Tên đăng nhập
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="vudiem353@gmail.com hoặc admin..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-hidden focus:ring-1 focus:ring-red-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-hidden focus:ring-1 focus:ring-red-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded-md border-slate-800 bg-slate-950 text-red-600 focus:ring-0"
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <span className="text-red-400 hover:underline cursor-pointer">Quên mật khẩu?</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-98 text-white py-3 text-xs font-bold shadow-lg shadow-red-950/50 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span>ĐANG ĐĂNG NHẬP...</span>
                ) : (
                  <>
                    <span>ĐĂNG NHẬP VÀO HỆ THỐNG</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Quick Demo Login Pills */}
              <div className="pt-4 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    Đăng nhập nhanh Demo
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {INITIAL_USERS.slice(0, 3).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickDemoLogin(u.email)}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-left hover:bg-slate-800/60 hover:border-slate-700 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-200 font-bold text-xs group-hover:bg-red-600 group-hover:text-white transition-colors">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-200 leading-tight">
                            {u.name}
                          </div>
                          <div className="text-[10px] text-slate-400">{u.email}</div>
                        </div>
                      </div>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300 group-hover:bg-red-950 group-hover:text-red-400">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Họ và Tên <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Nguyễn Văn B"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-hidden focus:ring-1 focus:ring-red-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Địa chỉ Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="nguyenvanb@favis.vn"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-hidden focus:ring-1 focus:ring-red-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Số Điện Thoại
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                      <Phone className="h-3.5 w-3.5" />
                    </div>
                    <input
                      type="text"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="0912 345 678"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-8 pr-2 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Vai Trò Hệ Thống
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-500">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as UserRole)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-8 pr-2 py-2 text-xs text-white focus:border-red-500 focus:outline-hidden"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MANAGER">MANAGER (Quản lý)</option>
                      <option value="SECURITY">SECURITY (An ninh)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Mật Khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Xác Nhận Mật Khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-98 text-white py-2.5 text-xs font-bold shadow-lg transition-all cursor-pointer mt-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span>ĐANG TẠO TÀI KHOẢN...</span>
                ) : (
                  <>
                    <span>TẠO TÀI KHOẢN FAVIS AI</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-slate-500 font-mono">
          FAVIS AI Platform v2.6.4 • Giám sát PCCC Thông Minh Hải Phòng
        </div>
      </div>
    </div>
  );
};
