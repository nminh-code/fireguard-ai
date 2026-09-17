import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  Shield,
  X,
  Radio,
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

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Live Cameras', path: '/cameras', icon: Cctv },
    {
      name: 'Incidents',
      path: '/incidents',
      icon: Flame,
      badge: activeIncidentsCount > 0 ? activeIncidentsCount : null,
      badgeColor: 'bg-red-600 text-white animate-pulse',
    },
    { name: 'Site Map', path: '/map', icon: Map },
    { name: 'History', path: '/history', icon: History },
    { name: 'Notifications', path: '/notifications', icon: Bell },
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
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="app-sidebar"
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div
            className="flex items-center cursor-pointer"
            onClick={() => {
              navigate('/');
              onClose();
            }}
          >
            <FireLogo variant="full" size={40} styleVariant="glow-badge" />
          </div>

          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden focus:outline-hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Hệ Thống Giám Sát
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4 w-4 ${
                          isActive
                            ? item.name === 'Incidents'
                              ? 'text-red-400'
                              : 'text-white'
                            : item.name === 'Incidents' && activeIncidentsCount > 0
                            ? 'text-red-600 animate-pulse'
                            : 'text-slate-400 group-hover:text-slate-600'
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
        </nav>

        {/* Sidebar Footer System Info */}
        <div className="border-t border-slate-200 p-4 bg-slate-50/70">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
            <span className="font-semibold text-slate-800">Edge AI Engine:</span>
            <span className="text-emerald-700 font-medium">Hoạt động</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">
            Hải Phòng Node • v2.6.4-pro
          </div>
        </div>
      </aside>
    </>
  );
};
