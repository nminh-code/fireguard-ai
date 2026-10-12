import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { UserRole } from '../types';
import { FireLogo } from './FireLogo';
import {
  History,
  Settings,
  Users,
  X,
  Video,
  Radio,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  userRole: UserRole;
  activeIncidentsCount?: number;
}

interface NavItem {
  name: string;
  path: string;
  icon: any;
  badge?: number | null;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  userRole,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { name: 'History', path: '/history', icon: History },
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

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-[#0B132B] text-slate-300 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-64'} w-64`}
        id="app-sidebar"
      >
        {/* Brand Header & Toggle Arrow */}
        <div className={`relative flex h-16 items-center border-b border-slate-800/80 px-3.5 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}>
          <div
            className="flex items-center cursor-pointer shrink-0"
            onClick={() => {
              navigate('/monitoring');
              onClose();
            }}
            title={isCollapsed ? 'FAVIS AI' : undefined}
          >
            {isCollapsed ? (
              <FireLogo variant="icon" size={34} styleVariant="glow-badge" />
            ) : (
              <FireLogo variant="full" size={36} styleVariant="glow-badge" />
            )}
          </div>

          {/* Desktop Arrow Toggle Button (Chevron Left / Right) */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`hidden lg:flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer ${
                isCollapsed ? 'absolute -right-3.5 top-4.5 z-30 rounded-full border border-slate-700 bg-[#0B132B] text-slate-200 shadow-md hover:bg-slate-800' : ''
              }`}
              title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              aria-label={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-sky-400 animate-pulse" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden focus:outline-hidden"
            aria-label="Đóng sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-2.5 py-4 scrollbar-none">
          {/* Top Camera Test Button Pill */}
          <button
            onClick={() => {
              navigate('/camera-test');
              onClose();
            }}
            title="Camera Test"
            className={`w-full flex items-center rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer border ${
              isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
            } ${
              location.pathname === '/camera-test' || location.pathname === '/camera-connect'
                ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/40'
                : 'bg-red-950/30 text-red-400 border-red-500/30 hover:bg-red-600 hover:text-white hover:border-red-500'
            }`}
          >
            <Video className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="tracking-wide truncate">Camera Test</span>}
          </button>

          {/* Màn hình giám sát */}
          <NavLink
            to="/monitoring"
            onClick={onClose}
            title="Màn hình giám sát"
            className={({ isActive }) =>
              `mt-2 flex w-full items-center rounded-lg border py-2.5 text-xs font-bold transition-all ${
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
              } ${
                isActive
                  ? 'border-amber-400 bg-amber-500 text-slate-950 shadow-md'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-amber-500/60 hover:text-white'
              }`
            }
          >
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="tracking-wide truncate">Màn hình giám sát</span>}
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
                  title={item.name}
                  className={({ isActive }) =>
                    `group relative flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors my-0.5 ${
                      isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
                    } ${
                      isActive
                        ? 'bg-[#1E293B] text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive
                              ? 'text-white'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        {!isCollapsed && <span className="truncate">{item.name}</span>}
                      </div>

                      {/* Badge in full mode */}
                      {!isCollapsed && item.badge !== undefined && item.badge !== null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold shrink-0 ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      )}

                      {/* Badge dot in collapsed mode */}
                      {isCollapsed && item.badge !== undefined && item.badge !== null && (
                        <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-red-500 animate-ping" />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer System Info */}
        <div className={`border-t border-slate-800/80 bg-[#080D1F] transition-all ${
          isCollapsed ? 'p-3 text-center' : 'p-4'
        }`}>
          {isCollapsed ? (
            <div className="flex justify-center" title="Edge AI Engine: Hoạt động (Hải Phòng Node)">
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse shrink-0" />
                <span className="font-semibold text-slate-300 truncate">Edge AI Engine:</span>
                <span className="text-emerald-400 font-medium shrink-0">Hoạt động</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-mono truncate">
                Hải Phòng Node • v2.6.4-pro
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
};
