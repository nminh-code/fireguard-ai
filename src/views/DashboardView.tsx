import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  Radio,
  Clock,
  Cpu,
  Shield,
  History,
  Flame,
  Wind,
  HardHat,
  ArrowRight,
  Maximize2,
  CheckCircle2,
  VideoOff,
} from 'lucide-react';
import { HlsVideoPlayer } from '../components/HlsVideoPlayer';
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

  // Compute unified camera list
  const cameraList = (() => {
    const list: Array<{
      id: string;
      name: string;
      location: string;
      isLive: boolean;
      playbackUrl?: string;
      webrtcUrl?: string;
    }> = [];

    if (cameraSession.activeStream?.connected) {
      const savedMatch = savedCameras.find((c) => c.id === cameraSession.activeStream?.cameraId);
      list.push({
        id: cameraSession.activeStream.cameraId,
        name: cameraSession.activeStream.cameraName,
        location: savedMatch?.brand ? `${savedMatch.brand} • ${savedMatch.ip}` : 'Phân xưởng sản xuất',
        isLive: true,
        playbackUrl: cameraSession.activeStream.playbackUrl,
        webrtcUrl: cameraSession.activeStream.webrtcUrl,
      });
    }

    savedCameras.forEach((cam) => {
      if (!list.some((c) => c.id === cam.id)) {
        list.push({
          id: cam.id,
          name: cam.name,
          location: `${cam.brand || 'RTSP'} • ${cam.ip || '192.168.1.8'}`,
          isLive: false,
        });
      }
    });

    return list;
  })();

  const totalCameras = cameraList.length;
  const onlineCameras = cameraList.filter((c) => c.isLive).length;
  const activeIncidents = incidents.filter(
    (i) => i.status === 'ACTIVE' || i.status === 'RESPONDING'
  );
  const primaryIncident = activeIncidents[0] || null;

  return (
    <div className="space-y-4 pb-8" id="dashboard-view">
      {/* 1. 4 KPI CARDS ROW (Directly at top of Dashboard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: CAMERA */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
            <Video className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              CAMERA
            </div>
            <div className="mt-0.5 text-2xl font-black text-slate-900">
              {totalCameras}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${totalCameras > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span>{totalCameras > 0 ? 'đã kết nối' : 'chưa kết nối'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: ĐANG ONLINE */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 border-l-4 border-l-emerald-500 bg-white p-4 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50/70 border border-emerald-100 text-emerald-600">
            <Radio className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              ĐANG ONLINE
            </div>
            <div className="mt-0.5 text-2xl font-black text-slate-900">
              {onlineCameras} <span className="text-lg font-bold text-slate-400">/ {totalCameras}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              camera
            </div>
          </div>
        </div>

        {/* Card 3: SỰ CỐ ĐANG HOẠT ĐỘNG */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 border-l-4 border-l-red-500 bg-white p-4 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 border border-red-100 text-red-500">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              SỰ CỐ ĐANG HOẠT ĐỘNG
            </div>
            <div className="mt-0.5 text-2xl font-black text-red-600">
              {activeIncidents.length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              sự cố
            </div>
          </div>
        </div>

        {/* Card 4: AI MONITORING */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 border-l-4 border-l-emerald-500 bg-white p-4 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50/70 border border-emerald-100 text-emerald-600">
            <Cpu className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              AI MONITORING
            </div>
            <div className={`mt-0.5 text-2xl font-black ${isAlertApiOnline ? 'text-emerald-600' : 'text-slate-700'}`}>
              {isAlertApiOnline ? 'ACTIVE' : 'STANDBY'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {isAlertApiOnline ? '1 module' : '0 module'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN DASHBOARD CONTENT (2 COLUMNS: LEFT 60% / RIGHT 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: Camera giám sát + Trạng thái module AI */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card: Camera giám sát */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-slate-800" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-none">
                    Camera giám sát
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tổng quan trạng thái camera và luồng video trực tiếp
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/monitoring')}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Tất cả camera</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Grid of Camera Cards */}
            {cameraList.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <VideoOff className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-800">Chưa có camera nào kết nối</p>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  Kết nối camera thông qua Camera Test để bắt đầu giám sát trực tiếp.
                </p>
                <button
                  onClick={() => navigate('/camera-test')}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Đi đến Camera Test</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {cameraList.map((cam) => {
                    const isAlert = primaryIncident?.cameraId === cam.id;

                    return (
                      <div
                        key={cam.id}
                        className={`rounded-xl border bg-white overflow-hidden shadow-2xs transition-all ${
                          isAlert
                            ? 'border-red-500 ring-2 ring-red-500/20'
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Camera Card Header */}
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50/70 border-b border-slate-100">
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {cam.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {cam.location}
                            </div>
                          </div>
                          {isAlert ? (
                            <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider">
                              CẢNH BÁO
                            </span>
                          ) : cam.isLive ? (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                              LIVE
                            </span>
                          ) : (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                              OFFLINE
                            </span>
                          )}
                        </div>

                        {/* Video Feed / Preview */}
                        <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                          {cam.isLive && cam.playbackUrl ? (
                            <HlsVideoPlayer
                              src={cam.playbackUrl}
                              webrtcUrl={cam.webrtcUrl}
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 text-slate-500">
                              <VideoOff className="h-8 w-8 mb-1" />
                              <span className="text-[11px]">Chưa kết nối luồng</span>
                            </div>
                          )}

                          {/* Overlay timestamp & format */}
                          <div className="pointer-events-none absolute top-2 left-2 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white backdrop-blur-xs">
                            {new Date().toISOString().slice(0, 10)} {new Date().toLocaleTimeString('vi-VN')}
                          </div>

                          <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-slate-300 backdrop-blur-xs">
                            1920x1080 • HLS
                          </div>

                          <button
                            onClick={() => navigate('/monitoring')}
                            title="Xem phòng giám sát"
                            className="absolute bottom-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                          >
                            <Maximize2 className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Camera Card Footer */}
                        <div className="flex items-center justify-between px-3 py-2 text-xs border-t border-slate-100 bg-white">
                          {isAlert ? (
                            <>
                              <div className="flex items-center gap-1.5 font-bold text-red-600 text-[11px]">
                                <Flame className="h-3.5 w-3.5 animate-bounce" />
                                <span>CẢNH BÁO: {primaryIncident.eventType === 'FIRE_CONFIRMED' ? 'CHÁY' : 'KHÓI'}</span>
                              </div>
                              <span className="text-[11px] font-bold text-red-600 font-mono">
                                Độ tin cậy: {primaryIncident.fireConfidence}%
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                                <span className={`h-2 w-2 rounded-full ${cam.isLive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                <span className="font-medium">{cam.isLive ? 'Đang giám sát' : 'Ngoại tuyến'}</span>
                              </div>
                              <button
                                onClick={() => navigate('/monitoring')}
                                className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                              >
                                Xem chi tiết
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtle Add Camera CTA Banner */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-center sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200/70 text-slate-500">
                      <VideoOff className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Chưa có camera nào khác</div>
                      <div className="text-[11px] text-slate-500">Kết nối camera thông qua Camera Test để bắt đầu giám sát</div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/camera-test')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <Video className="h-3.5 w-3.5" />
                    <span>Đi đến Camera Test</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card: AI MONITORING */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-slate-800" />
                <h2 className="text-sm font-bold text-slate-900 tracking-wide">
                  AI MONITORING
                </h2>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Module 1: Fire Detection */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 border border-red-100 text-red-600">
                    <Flame className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Fire Detection</span>
                </div>
                <span
                  className={`rounded-md px-2.5 py-1 text-[10px] font-black tracking-wider uppercase ${
                    isAlertApiOnline
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isAlertApiOnline ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>

              {/* Module 2: PPE Detection */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 border border-amber-100 text-amber-600">
                    <HardHat className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">PPE Detection</span>
                </div>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 tracking-wider uppercase border border-slate-200/60">
                  STANDBY
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sự cố đang hoạt động + Cảnh báo gần nhất */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card: Sự cố đang hoạt động */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-800" />
                <h2 className="text-sm font-bold text-slate-900">
                  Sự cố đang hoạt động
                </h2>
              </div>
              <button
                onClick={() => navigate('/incidents')}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {primaryIncident ? (
              <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5 space-y-3">
                {/* Incident Badges Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-2xs text-red-600">
                      <Flame className="h-4 w-4" />
                    </div>
                    <span className="rounded-md bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                      {primaryIncident.eventType === 'FIRE_CONFIRMED' ? 'FIRE DETECTED' : 'SMOKE DETECTED'}
                    </span>
                    <span className="rounded-md bg-red-600 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                      {primaryIncident.severity}
                    </span>
                  </div>
                  <span className="rounded-md bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-bold">
                    Đang xử lý
                  </span>
                </div>

                {/* Incident Thumbnail & Details */}
                <div className="flex gap-3 items-center">
                  <div className="relative h-16 w-24 shrink-0 rounded-lg overflow-hidden bg-slate-900 border border-red-200">
                    {primaryIncident.snapshotUrl ? (
                      <img
                        src={primaryIncident.snapshotUrl}
                        alt="Incident Snapshot"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-red-400">
                        <Flame className="h-6 w-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 border border-red-500/70" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {primaryIncident.cameraCode} • {primaryIncident.location}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{primaryIncident.detectedAt} • {new Date().toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => navigate(`/incidents/${primaryIncident.id}`)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center rounded-xl bg-slate-50/50 border border-slate-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-800">Không có sự cố nào đang diễn ra</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Hệ thống hiện tại đang an toàn và ổn định
                </p>
              </div>
            )}
          </div>

          {/* Card: Cảnh báo gần nhất */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-800" />
                <h2 className="text-sm font-bold text-slate-900">
                  Cảnh báo gần nhất
                </h2>
              </div>
              <button
                onClick={() => navigate('/history')}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {recentAlerts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Chưa có cảnh báo nào gần đây.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentAlerts.slice(0, 5).map((alt) => (
                  <div
                    key={alt.id}
                    onClick={() => navigate('/monitoring')}
                    className="flex items-center justify-between py-2.5 text-xs hover:bg-slate-50 px-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          alt.class === 'fire'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {alt.class === 'fire' ? (
                          <Flame className="h-4 w-4" />
                        ) : (
                          <Wind className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {alt.class === 'fire' ? 'Lửa được phát hiện' : 'Khói được phát hiện'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {alt.cameraId} • Khu vực giám sát
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatMonitoringTime(alt.timestamp)}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          alt.confidence >= 0.8
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {alt.confidence >= 0.8 ? 'HIGH' : 'MEDIUM'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
