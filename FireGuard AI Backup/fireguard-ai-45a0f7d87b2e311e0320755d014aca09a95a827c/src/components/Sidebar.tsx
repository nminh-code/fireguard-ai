import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { UserRole } from '../types';
import { FireLogo } from './FireLogo';
import {
  LayoutDashboard,
  Cctv,
  Flame,
  Map,
  History,
  Bell,
  Settings,
  Users,
  X,
  Video,
  Radio,
  ShieldAlert,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  activeIncidentsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  userRole,
  activeIncidentsCount,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Cameras', path: '/cameras', icon: Cctv },
    {
      name: 'Incidents',
      path: '/incidents',
      icon: Flame,
      badge: activeIncidentsCount > 0 ? activeIncidentsCount : null,
      badgeColor: 'bg-red-600 text-white animate-pulse',
    },
    { name: 'Site Map', path: '/map', icon: Map },
    { name: 'History', path: '/history', icon: History },
    {
      name: 'Notifications',
      path: '/notifications',
      icon: Bell,
      badge: 2,
      badgeColor: 'bg-red-600 text-white font-bold',
    },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  if (userRole === 'ADMIN') {
    navItems.push({
      name: 'Management',
      path: '/management',
      icon: Users,
    });
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container - Dark Navy matching reference image */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-[#0B132B] text-slate-300 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="app-sidebar"
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
          <div
            className="flex items-center cursor-pointer"
            onClick={() => {
              navigate('/');
              onClose();
            }}
          >
            <FireLogo variant="full" size={38} styleVariant="glow-badge" />
          </div>

          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden focus:outline-hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {/* Top Camera Test Button Pill */}
          <button
            onClick={() => {
              navigate('/camera-test');
              onClose();
            }}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition-all cursor-pointer border ${
              location.pathname === '/camera-test' || location.pathname === '/camera-connect'
                ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/40'
                : 'bg-red-950/30 text-red-400 border-red-500/30 hover:bg-red-600 hover:text-white hover:border-red-500'
            }`}
          >
            <Video className="h-4 w-4" />
            <span className="tracking-wide">Camera Test</span>
          </button>

          <NavLink
            to="/monitoring"
            onClick={onClose}
            className={({ isActive }) =>
              `mt-2 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-xs font-bold transition-all ${
                isActive
                  ? 'border-amber-400 bg-amber-500 text-slate-950 shadow-md'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-amber-500/60 hover:text-white'
              }`
            }
          >
            <ShieldAlert className="h-4 w-4" />
            <span className="tracking-wide">Màn hình giám sát</span>
          </NavLink>

          <div className="pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors my-0.5 ${
                      isActive
                        ? 'bg-[#1E293B] text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 ${
                            isActive
                              ? 'text-white'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <span>{item.name}</span>
                      </div>

                      {item.badge !== undefined && item.badge !== null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer System Info */}
        <div className="border-t border-slate-800/80 p-4 bg-[#080D1F]">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-300">Edge AI Engine:</span>
            <span className="text-emerald-400 font-medium">Hoạt động</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">
            Hải Phòng Node • v2.6.4-pro
          </div>
        </div>
      </aside>
    </>
  );
};
