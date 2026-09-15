import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole } from './types';
import { authService } from './services/authService';
import { incidentService } from './services/incidentService';
import { realtimeService } from './services/realtimeService';

import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { RealtimeToast } from './components/RealtimeToast';

import { DashboardView } from './views/DashboardView';
import { CamerasView } from './views/CamerasView';
import { IncidentsView } from './views/IncidentsView';
import { IncidentDetailView } from './views/IncidentDetailView';
import { SiteMapView } from './views/SiteMapView';
import { HistoryView } from './views/HistoryView';
import { NotificationsView } from './views/NotificationsView';
import { SettingsView } from './views/SettingsView';
import { ManagementView } from './views/ManagementView';
import { CameraTestView } from './views/CameraTestView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User>(authService.getCurrentUser());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeIncidentsCount, setActiveIncidentsCount] = useState(0);

  const refreshCounts = async () => {
    const stats = await incidentService.getDashboardStats();
    setActiveIncidentsCount(stats.activeIncidents);
  };

  useEffect(() => {
    refreshCounts();

    const unsubGlobal = realtimeService.subscribeToGlobalState(() => {
      refreshCounts();
    });

    const unsubIncident = realtimeService.subscribeToIncidentEvents(() => {
      refreshCounts();
    });

    const unsubAuth = realtimeService.subscribeToAuthEvents((user) => {
      setCurrentUser(user);
    });

    return () => {
      unsubGlobal();
      unsubIncident();
      unsubAuth();
    };
  }, []);

  const handleRoleChange = (role: UserRole) => {
    const updated = authService.switchRole(role);
    setCurrentUser(updated);
  };

  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased selection:bg-red-500 selection:text-white">
        {/* Responsive Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          userRole={currentUser.role}
          activeIncidentsCount={activeIncidentsCount}
        />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Top Navigation Bar */}
          <Topbar
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            currentUser={currentUser}
            onRoleChange={handleRoleChange}
          />

          {/* Page Scrollable Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8" id="main-content">
            <div className="mx-auto max-w-7xl">
              <Routes>
                <Route path="/" element={<DashboardView />} />
                <Route path="/cameras" element={<CamerasView />} />
                <Route path="/incidents" element={<IncidentsView />} />
                <Route path="/incidents/:id" element={<IncidentDetailView />} />
                <Route path="/map" element={<SiteMapView />} />
                <Route path="/history" element={<HistoryView />} />
                <Route path="/notifications" element={<NotificationsView />} />
                <Route path="/settings" element={<SettingsView />} />
                <Route path="/management" element={<ManagementView />} />
                <Route path="/camera-test" element={<CameraTestView />} />
                <Route path="/camera-connect" element={<CameraTestView />} />
                <Route path="*" element={<Navigate to="/" replace />} />
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
