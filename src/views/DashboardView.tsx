import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Flame,
  HardHat,
  Wind,
  Video,
} from 'lucide-react';
import { cameraConnectionService } from '../services/cameraConnectionService';
import { cameraSessionStore } from '../services/cameraSessionStore';
import { incidentService } from '../services/incidentService';
import { realtimeService } from '../services/realtimeService';
import {
  getAlertHistory,
  formatMonitoringTime,
  MonitoringAlert,
} from '../services/monitoringAlertService';
import { Incident } from '../types';

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const cameraSession = useSyncExternalStore(
    cameraSessionStore.subscribe,
    cameraSessionStore.getSnapshot
  );

  const [savedCameras, setSavedCameras] = useState(cameraConnectionService.getSavedCameras());
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<MonitoringAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAlertApiOnline, setIsAlertApiOnline] = useState(false);

  const loadDashboardData = async () => {
    try {
      const incList = await incidentService.getIncidents();
      setIncidents(incList);
      setSavedCameras(cameraConnectionService.getSavedCameras());

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      try {
        const hist = await getAlertHistory(controller.signal);
        setRecentAlerts(hist.alerts || []);
        setIsAlertApiOnline(true);
      } catch {
        setIsAlertApiOnline(false);
      } finally {
        clearTimeout(timeout);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    const unsubGlobal = realtimeService.subscribeToGlobalState(() => {
      loadDashboardData();
    });

    const unsubIncident = realtimeService.subscribeToIncidentEvents(() => {
      loadDashboardData();
    });

    return () => {
      unsubGlobal();
      unsubIncident();
    };
  }, []);

  // Compute real metrics
  const totalCameras =
    savedCameras.length +
    (cameraSession.activeStream && !savedCameras.some((c) => c.id === cameraSession.activeStream?.cameraId)
      ? 1
      : 0);

  const onlineCameras = cameraSession.activeStream?.connected ? 1 : 0;
  const offlineCameras = Math.max(0, totalCameras - onlineCameras);

  const activeIncidents = incidents.filter(
    (i) => i.status === 'ACTIVE' || i.status === 'RESPONDING'
  );

  const isConfigured = totalCameras > 0;

  // System status determination
  const systemStatus: {
    label: string;
    dotColor: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
  } = !isConfigured
    ? {
        label: 'NOT CONFIGURED',
        dotColor: 'bg-slate-400',
        textColor: 'text-slate-600',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
      }
    : activeIncidents.length > 0
    ? {
        label: 'ATTENTION REQUIRED',
        dotColor: 'bg-red-600 animate-pulse',
        textColor: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      }
    : offlineCameras > 0 || !isAlertApiOnline
    ? {
        label: 'PARTIAL OUTAGE',
        dotColor: 'bg-amber-500',
        textColor: 'text-amber-800',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
      }
    : {
        label: 'SYSTEM OPERATIONAL',
        dotColor: 'bg-emerald-500 animate-pulse',
        textColor: 'text-emerald-800',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
      };

  return (
    <div className="space-y-4 pb-8" id="dashboard-view">
      {/* TOP: Compact Operational Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-slate-900 uppercase">
              FireVis Control Center
            </h1>
          </div>
          <p className="text-xs text-slate-500">Safety monitoring overview</p>
        </div>

        {/* System Status Pill */}
        <div
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-bold tracking-wide ${systemStatus.bgColor} ${systemStatus.textColor} ${systemStatus.borderColor}`}
        >
          <span className={`h-2 w-2 rounded-full ${systemStatus.dotColor}`} />
          <span>{systemStatus.label}</span>
        </div>
      </div>

      {/* KEY METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: CAMERAS */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Cameras
          </div>
          <div className="mt-1 text-2xl font-black font-mono text-slate-900">
            {totalCameras}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {totalCameras === 0 ? 'no devices' : 'connected'}
          </div>
        </div>

        {/* Metric 2: ONLINE */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Online
          </div>
          <div className="mt-1 text-2xl font-black font-mono text-emerald-600">
            {onlineCameras}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            / {totalCameras} total
          </div>
        </div>

        {/* Metric 3: ACTIVE INCIDENTS */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active Incidents
          </div>
          <div
            className={`mt-1 text-2xl font-black font-mono ${
              activeIncidents.length > 0 ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {activeIncidents.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {activeIncidents.length > 0 ? 'requires action' : 'stable'}
          </div>
        </div>

        {/* Metric 4: AI MONITORING */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            AI Monitoring
          </div>
          <div className="mt-1 text-2xl font-black font-mono text-slate-900">
            {isAlertApiOnline ? 'ACTIVE' : isConfigured ? 'STANDBY' : 'OFFLINE'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {isAlertApiOnline ? '1 module active' : 'engine idle'}
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION (2 Columns: Camera Health + Active Incidents) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CAMERA HEALTH */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Camera Health
              </h2>
              <button
                onClick={() => navigate('/monitoring')}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View all</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {totalCameras === 0 ? (
              <div className="py-8 text-center">
                <Video className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No cameras connected.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Connect a camera through Camera Test to start monitoring.
                </p>
                <button
                  onClick={() => navigate('/camera-test')}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Go to Camera Test</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* Active Stream Camera */}
                {cameraSession.activeStream?.connected && (
                  <div className="flex items-center justify-between py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-slate-900">
                        {cameraSession.activeStream.cameraName}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({cameraSession.activeStream.cameraId})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        Online
                      </span>
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        Live stream available
                      </span>
                    </div>
                  </div>
                )}

                {/* Saved Configured Cameras */}
                {savedCameras
                  .filter((cam) => cam.id !== cameraSession.activeStream?.cameraId)
                  .map((cam) => (
                    <div key={cam.id} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        <span className="font-semibold text-slate-800">{cam.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({cam.brand || 'RTSP'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          Offline
                        </span>
                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          Stream unavailable
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE INCIDENTS */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Active Incidents
                </h2>
                {activeIncidents.length > 0 && (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {activeIncidents.length}
                  </span>
                )}
              </div>
              {activeIncidents.length > 0 && (
                <button
                  onClick={() => navigate('/incidents')}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View all</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>

            {activeIncidents.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-800">No active incidents</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  System is currently stable
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/70 p-2.5 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span className="font-bold text-xs text-red-900">
                          FIRE DETECTED
                        </span>
                        <span className="rounded bg-red-600 px-1.5 py-0.2 text-[9px] font-black text-white uppercase">
                          {inc.severity}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {inc.location} ({inc.cameraCode})
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {inc.detectedAt} • Confidence: {inc.fireConfidence}%
                      </div>
                    </div>

                    <span className="text-xs font-bold text-red-600 hover:underline flex items-center gap-0.5">
                      View <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION (2 Columns: Recent Alerts + AI Monitoring) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RECENT ALERTS */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Recent Alerts
            </h2>
            <button
              onClick={() => navigate('/history')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No recent alerts.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentAlerts.slice(0, 4).map((alt) => (
                <div
                  key={alt.id}
                  onClick={() => navigate('/monitoring')}
                  className="flex items-center justify-between py-2 text-xs hover:bg-slate-50 px-1 rounded transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {alt.class === 'fire' ? (
                      <Flame className="h-3.5 w-3.5 text-red-600" />
                    ) : (
                      <Wind className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    <span className="font-medium text-slate-800 capitalize">
                      {alt.class} detected
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-slate-500 font-mono text-[11px]">
                    <span className="font-semibold text-slate-700">{alt.cameraId}</span>
                    <span>{formatMonitoringTime(alt.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI MONITORING */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="border-b border-slate-100 pb-2.5 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              AI Monitoring
            </h2>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {/* Module 1: Fire Detection */}
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-red-600" />
                <span className="font-semibold text-slate-900">Fire Detection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isAlertApiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span
                  className={`font-bold text-[11px] ${
                    isAlertApiOnline ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  {isAlertApiOnline ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>
            </div>

            {/* Module 2: PPE Detection */}
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                <HardHat className="h-4 w-4 text-amber-600" />
                <span className="font-semibold text-slate-900">PPE Detection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="font-bold text-[11px] text-slate-500">STANDBY</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
