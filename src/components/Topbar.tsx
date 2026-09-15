import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole, Notification, DashboardStats } from '../types';
import { authService } from '../services/authService';
import { notificationService } from '../services/notificationService';
import { incidentService } from '../services/incidentService';
import { realtimeService } from '../services/realtimeService';
import { soundManager } from '../utils/audioAlert';
import {
  Bell,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Menu,
  ChevronDown,
  Building2,
  UserCheck,
  Video,
} from 'lucide-react';

interface TopbarProps {
  onToggleSidebar: () => void;
  currentUser: User;
  onRoleChange: (role: UserRole) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar, currentUser, onRoleChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const loadData = async () => {
    const s = await incidentService.getDashboardStats();
    setStats(s);
    const notifs = await notificationService.getNotifications();
    setNotifications(notifs);
    setUnreadCount(notificationService.getUnreadCount());
  };

  useEffect(() => {
    loadData();

    // Listen for realtime updates
    const unsubGlobal = realtimeService.subscribeToGlobalState(() => {
      loadData();
    });

    const unsubNotif = realtimeService.subscribeToNotifications(() => {
      loadData();
    });

    return () => {
      unsubGlobal();
      unsubNotif();
    };
  }, []);

  const handleSimulateFire = () => {
    setIsSimulating(true);
    soundManager.playFireAlarm();
    const inc = incidentService.simulateFireEvent();
    loadData();
    setTimeout(() => {
      setIsSimulating(false);
      navigate(`/incidents/${inc.id}`);
    }, 400);
  };

  const handleResolveLatest = async () => {
    soundManager.playSuccessTone();
    incidentService.resolveLatestActiveIncident(currentUser.name);
    await loadData();
  };

  const hasActiveFire = (stats?.activeIncidents ?? 0) > 0;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 shadow-2xs">
      {/* Left side: Hamburger + Factory Brand */}
      <div className="flex items-center gap-3 md:gap-4">
        <button
          onClick={onToggleSidebar}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden focus:outline-hidden"
          title="Mở menu"
          id="btn-sidebar-toggle"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            <Building2 className="h-5 w-5 text-slate-800" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm md:text-base text-slate-900 leading-tight">
                Nhà máy ABC - Hải Phòng
              </span>
              <span className="hidden md:inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                KCN Đình Vũ
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {hasActiveFire ? (
                <span className="flex items-center gap-1 font-bold text-red-600 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-red-600"></span>
                  🔴 SỰ CỐ CHÁY ĐANG HOẠT ĐỘNG ({stats?.activeIncidents})
                </span>
              ) : stats?.camerasOffline && stats.camerasOffline > 0 ? (
                <span className="flex items-center gap-1 text-amber-700 font-medium">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  CẦN CHÚ Ý ({stats.camerasOffline} camera offline)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  🟢 HỆ THỐNG HOẠT ĐỘNG BÌNH THƯỜNG
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Demo triggers + Notifications + Role Switcher */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Prominent CAMERA TEST Button */}
        <button
          onClick={() => navigate('/camera-test')}
          id="btn-topbar-camera-test"
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            location.pathname === '/camera-test' || location.pathname === '/camera-connect'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300'
          }`}
          title="Kết nối và kiểm tra camera CCTV / IP thật (Connect Real Camera)"
        >
          <Video
            className={`h-3.5 w-3.5 ${
              location.pathname === '/camera-test' || location.pathname === '/camera-connect'
                ? 'text-white'
                : 'text-red-600'
            }`}
          />
          <span className="tracking-wide font-black">CAMERA TEST</span>
        </button>

        {/* Demo AI Event Simulation Toolbar */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-lg border border-slate-200">
          <button
            onClick={handleSimulateFire}
            disabled={isSimulating}
            className="flex items-center gap-1.5 rounded-md bg-red-600 hover:bg-red-700 active:scale-98 text-white px-2.5 py-1.5 text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            title="Kích hoạt sự kiện cháy giả lập để kiểm tra phản hồi realtime"
            id="btn-simulate-fire"
          >
            <Zap className="h-3.5 w-3.5 text-yellow-300 fill-yellow-300" />
            <span className="hidden sm:inline">GIẢ LẬP BÁO CHÁY</span>
            <span className="sm:hidden">CHÁY</span>
          </button>

          {hasActiveFire && (
            <button
              onClick={handleResolveLatest}
              className="flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white px-2.5 py-1.5 text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="Đánh dấu giải quyết sự cố cháy hiện tại"
              id="btn-resolve-fire"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">KHẮC PHỤC</span>
            </button>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:outline-hidden transition-colors"
            title="Xem thông báo khẩn cấp"
            id="btn-notifications-toggle"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900">Thông báo giám sát</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-bold">
                      {unreadCount} mới
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    notificationService.markAllAsRead();
                    setShowNotifMenu(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
                >
                  Đọc tất cả
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400">Không có thông báo mới</p>
                ) : (
                  notifications.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        notificationService.markAsRead(n.id);
                        setShowNotifMenu(false);
                        if (n.incidentId) {
                          navigate(`/incidents/${n.incidentId}`);
                        } else {
                          navigate('/notifications');
                        }
                      }}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer text-left ${
                        n.type === 'FIRE_CONFIRMED'
                          ? 'border-red-200 bg-red-50/70 hover:bg-red-100/60'
                          : !n.read
                          ? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                          : 'border-transparent bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={`text-xs font-bold ${
                            n.type === 'FIRE_CONFIRMED' ? 'text-red-700' : 'text-slate-900'
                          }`}
                        >
                          {n.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">{n.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                        <span>📍 {n.location}</span>
                        {n.incidentId && (
                          <span className="text-red-600 font-semibold underline text-[11px]">
                            Xem chi tiết sự cố →
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 text-center">
                <button
                  onClick={() => {
                    setShowNotifMenu(false);
                    navigate('/notifications');
                  }}
                  className="text-xs text-slate-700 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Xem toàn bộ lịch sử thông báo →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
            id="btn-role-switcher"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-800 font-bold text-xs border border-slate-300">
              {currentUser.role[0]}
            </div>
            <div className="hidden sm:block text-left">
              <div className="font-semibold text-slate-900 leading-none">{currentUser.name}</div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{currentUser.role}</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in-50 duration-150">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                Chuyển đổi Role Demo
              </div>

              {(['ADMIN', 'MANAGER', 'SECURITY'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    onRoleChange(r);
                    setShowRoleMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium text-left transition-colors cursor-pointer ${
                    currentUser.role === r
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>{r}</span>
                  </div>
                  {currentUser.role === r && (
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">Đang chọn</span>
                  )}
                </button>
              ))}

              <div className="border-t border-slate-100 mt-1.5 pt-1.5 px-2 text-[10px] text-slate-400">
                {currentUser.role === 'ADMIN'
                  ? 'ADMIN: Toàn quyền bao gồm menu Quản Lý'
                  : currentUser.role === 'MANAGER'
                  ? 'MANAGER: Quản lý hiện trường, duyệt sự cố'
                  : 'SECURITY: Trực giám sát camera và phản ứng'}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
