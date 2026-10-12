import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole } from './types';
import { authService } from './services/authService';
import { realtimeService } from './services/realtimeService';
import { backendErrorMessage, subscribeBackendErrors } from './services/backendApi';

import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { RealtimeToast } from './components/RealtimeToast';

import { AuthView } from './views/AuthView';
import { CamerasView } from './views/CamerasView';
import { HistoryView } from './views/HistoryView';
import { NotificationsView } from './views/NotificationsView';
import { SettingsView } from './views/SettingsView';
import { ManagementView } from './views/ManagementView';
import { CameraTestView } from './views/CameraTestView';
import { MonitoringView } from './views/MonitoringView';
import { IncidentsView } from './views/IncidentsView';
import { IncidentDetailView } from './views/IncidentDetailView';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authService.isLoggedIn());
  const [currentUser, setCurrentUser] = useState<User>(authService.getCurrentUser());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(backendErrorMessage());
  useEffect(() => subscribeBackendErrors(() => setBackendError(backendErrorMessage())), []);

  useEffect(() => {
    const unsubAuth = realtimeService.subscribeToAuthEvents((user) => {
      setCurrentUser(user);
    });

    return () => {
      unsubAuth();
    };
  }, []);

  const handleRoleChange = (role: UserRole) => {
    const updated = authService.switchRole(role);
    setCurrentUser(updated);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <AuthView
        onLoginSuccess={() => {
          setIsAuthenticated(true);
          setCurrentUser(authService.getCurrentUser());
        }}
      />
    );
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased selection:bg-red-500 selection:text-white">
        {/* Responsive Sidebar with Collapse/Expand */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          userRole={currentUser.role}
        />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Top Navigation Bar */}
          <Topbar
            onToggleSidebar={() => {
              if (window.innerWidth >= 1024) {
                setIsSidebarCollapsed((prev) => !prev);
              } else {
                setIsSidebarOpen((prev) => !prev);
              }
            }}
            currentUser={currentUser}
            onRoleChange={handleRoleChange}
            onLogout={handleLogout}
          />

          {/* Page Scrollable Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8" id="main-content">
            {backendError && <p role="alert" className="mb-4 text-sm text-red-700">{backendError}</p>}
            <div className="w-full">
              <Routes>
                <Route path="/" element={<Navigate to="/monitoring" replace />} />
                <Route path="/monitoring" element={<MonitoringView />} />
                <Route path="/cameras" element={<CamerasView />} />
                <Route path="/incidents" element={<IncidentsView />} />
                <Route path="/incidents/:id" element={<IncidentDetailView />} />
                <Route path="/map" element={<Navigate to="/monitoring" replace />} />
                <Route path="/history" element={<HistoryView />} />
                <Route path="/notifications" element={<NotificationsView />} />
                <Route path="/settings" element={<SettingsView />} />
                <Route path="/management" element={<ManagementView />} />
                <Route path="/camera-test" element={<CameraTestView />} />
                <Route path="/camera-connect" element={<CameraTestView />} />
                <Route path="*" element={<Navigate to="/monitoring" replace />} />
              </Routes>
            </div>
          </main>
        </div>

        {/* Global Floating Emergency Toast */}
        <RealtimeToast />
      </div>
    </BrowserRouter>
  );
}
