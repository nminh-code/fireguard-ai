import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { User, UserRole, Notification, DashboardStats } from '../types';
import { notificationService } from '../services/notificationService';
import { incidentService } from '../services/incidentService';
import { realtimeService } from '../services/realtimeService';
import {
  Bell,
  Flame,
  Menu,
  ChevronDown,
  UserCheck,
  Video,
  LayoutDashboard,
  Cctv,
  Map,
  History,
  Settings,
  Users,
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
  const [unreadCount, setUnreadCount] = useState<number>(2);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

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

  const topNavItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Cameras', path: '/cameras', icon: Cctv },
    { name: 'Incidents', path: '/incidents', icon: Flame },
    { name: 'Site Map', path: '/map', icon: Map },
    { name: 'History', path: '/history', icon: History },
    {
      name: 'Notifications',
      path: '/notifications',
      icon: Bell,
      badge: 2,
    },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Management', path: '/management', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-3 md:px-6 shadow-2xs">
      {/* Mobile Hamburger toggle */}
      <button
        onClick={onToggleSidebar}
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-hidden"
        title="Mở menu"
        id="btn-sidebar-toggle"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Horizontal Pill Navigation Bar matching Reference Image */}
      <nav className="hidden lg:flex items-center gap-1.5 overflow-x-auto py-1">
        {/* Camera Test Button */}
        <NavLink
          to="/camera-test"
          className={({ isActive }) =>
            `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              isActive
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-600 text-white hover:bg-red-700 shadow-xs'
            }`
          }
        >
          <Video className="h-3.5 w-3.5" />
          <span>Camera Test</span>
        </NavLink>

        {topNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.name}</span>
              {item.badge !== undefined && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ml-0.5">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Right side: Bell Notifications + User Profile Pill */}
      <div className="flex items-center gap-3">
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
                <span className="font-semibold text-sm text-slate-900">Thông báo mới</span>
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

        {/* User Profile Badge (Ngọc Minh - Admin) */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2 py-1 text-xs transition-colors cursor-pointer"
            id="btn-role-switcher"
          >
            {/* Avatar Pill circle NM */}
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-white font-bold text-xs">
              NM
            </div>
            <div className="text-left pr-1">
              <div className="font-bold text-slate-900 leading-tight">Ngọc Minh</div>
              <div className="text-[10px] text-slate-500 leading-none">Admin</div>
            </div>
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                Role Menu
              </div>
              {(['ADMIN', 'MANAGER', 'SECURITY'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    onRoleChange(r);
                    setShowRoleMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-left ${
                    currentUser.role === r ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>{r}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
