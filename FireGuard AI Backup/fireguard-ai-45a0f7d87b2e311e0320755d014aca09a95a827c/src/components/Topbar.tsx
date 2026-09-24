import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole, Notification, DashboardStats } from '../types';
import { notificationService } from '../services/notificationService';
import { incidentService } from '../services/incidentService';
import { realtimeService } from '../services/realtimeService';
import { soundManager } from '../utils/audioAlert';
import {
  Bell,
  Menu,
  Building2,
  UserCheck,
  Zap,
  CheckCircle2,
  LogOut,
} from 'lucide-react';

interface TopbarProps {
  onToggleSidebar: () => void;
  currentUser: User;
  onRoleChange: (role: UserRole) => void;
  onLogout?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar, currentUser, onRoleChange, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCameraTestOrMonitoring =
    location.pathname === '/camera-test' ||
    location.pathname === '/camera-connect' ||
    location.pathname === '/monitoring';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(2);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const initials = currentUser.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'US';

  const loadData = async () => {
    const s = await incidentService.getDashboardStats();
    setStats(s);
    const notifs = await notificationService.getNotifications();
    setNotifications(notifs);
    setUnreadCount(notificationService.getUnreadCount() || 2);
  };

  useEffect(() => {
    loadData();

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
      {/* Left side: Hamburger button + Factory Header info */}
      <div className="flex items-center gap-3 md:gap-4">
        <button
          onClick={onToggleSidebar}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-hidden"
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
            {!isCameraTestOrMonitoring && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm md:text-base text-slate-900 leading-tight">
                  Nhà máy ABC - Hải Phòng
                </span>
                <span className="hidden md:inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  KCN Đình Vũ
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs">
              {hasActiveFire ? (
                <span className="flex items-center gap-1 font-bold text-red-600 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-red-600"></span>
                  🔴 SỰ CỐ CHÁY ĐANG HOẠT ĐỘNG ({stats?.activeIncidents})
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  🟢 HỆ THỐNG GIÁM SÁT HOẠT ĐỘNG BÌNH THƯỜNG
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Demo Event Simulation + Bell Notifications + User Profile */}
      <div className="flex items-center gap-3">
        {/* Demo AI Event Simulation Buttons */}
        {!isCameraTestOrMonitoring && (
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-lg border border-slate-200">
            <button
              onClick={handleSimulateFire}
              disabled={isSimulating}
              className="flex items-center gap-1.5 rounded-md bg-red-600 hover:bg-red-700 active:scale-98 text-white px-2.5 py-1.5 text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              title="Kích hoạt sự kiện cháy giả lập"
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
                title="Đánh dấu giải quyết sự cố cháy"
                id="btn-resolve-fire"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">KHẮC PHỤC</span>
              </button>
            )}
          </div>
        )}

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Xem thông báo"
            id="btn-notifications-toggle"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <span className="font-semibold text-sm text-slate-900">Thông báo giám sát</span>
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

              <div className="max-h-72 overflow-y-auto space-y-2 text-left">
                {notifications.slice(0, 4).map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      notificationService.markAsRead(n.id);
                      setShowNotifMenu(false);
                      navigate(n.incidentId ? `/incidents/${n.incidentId}` : '/notifications');
                    }}
                    className="p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex justify-between text-xs font-bold text-slate-900">
                      <span>{n.title}</span>
                      <span className="text-[10px] text-slate-400">{n.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Badge */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-xs transition-colors cursor-pointer"
            id="btn-role-switcher"
          >
            {/* Avatar Pill circle */}
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white font-bold text-xs">
              {initials}
            </div>
            <div className="text-left pr-1">
              <div className="font-bold text-slate-900 leading-tight">{currentUser.name}</div>
              <div className="text-[10px] text-slate-500 leading-none">{currentUser.role}</div>
            </div>
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                Chuyển Đổi Vai Trò
              </div>
              {(['ADMIN', 'MANAGER', 'SECURITY'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    onRoleChange(r);
                    setShowRoleMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-left my-0.5 cursor-pointer ${
                    currentUser.role === r ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>{r}</span>
                  </div>
                </button>
              ))}

              {onLogout && (
                <div className="border-t border-slate-100 mt-1.5 pt-1.5">
                  <button
                    onClick={() => {
                      setShowRoleMenu(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Đăng xuất tài khoản</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
