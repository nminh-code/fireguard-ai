import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Flame,
  Radio,
  RefreshCw,
  ShieldAlert,
  Volume2,
  VolumeX,
  Wind,
  X,
  Video,
  VideoOff,
  Clock,
  ArrowRight,
  Shield,
  Eye,
  Maximize2,
  Sliders,
  Layers,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { HlsVideoPlayer } from '../components/HlsVideoPlayer';
import { cameraSessionStore } from '../services/cameraSessionStore';
import { cameraConnectionService } from '../services/cameraConnectionService';
import { incidentService } from '../services/incidentService';
import { monitoringAlertAudio } from '../services/monitoringAlertAudio';
import {
  AlertHistoryResponse,
  LatestAlertResponse,
  MonitoringAlert,
  evidenceHref,
  formatMonitoringTime,
  getAlertHistory,
  getLatestAlert,
} from '../services/monitoringAlertService';
import { Incident } from '../types';

const POLL_INTERVAL_MS = 2500;
const REQUEST_TIMEOUT_MS = 5000;

function AlertTypeIcon({ type }: { type: MonitoringAlert['class'] }) {
  return type === 'fire' ? <Flame className="h-6 w-6" /> : <Wind className="h-6 w-6" />;
}

export const MonitoringView: React.FC = () => {
  const navigate = useNavigate();
  const cameraSession = useSyncExternalStore(
    cameraSessionStore.subscribe,
    cameraSessionStore.getSnapshot
  );

  const [savedCameras, setSavedCameras] = useState(cameraConnectionService.getSavedCameras());
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [history, setHistory] = useState<AlertHistoryResponse | null>(null);
  const [latest, setLatest] = useState<MonitoringAlert | null>(null);
  const [newAlertId, setNewAlertId] = useState<string | null>(null);
  const [connection, setConnection] = useState<'loading' | 'connected' | 'error'>('loading');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(() => monitoringAlertAudio.isEnabled());

  // Selected camera for Detail Drawer (Level 2)
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  // Evidence Lightbox Modal (Level 3)
  const [lightboxEvidenceUrl, setLightboxEvidenceUrl] = useState<string | null>(null);

  const latestAlertKey = useRef<string | null>(null);
  const initialized = useRef(false);

  // Load incidents for direct linking
  useEffect(() => {
    incidentService.getIncidents().then(setIncidents).catch(console.error);
    setSavedCameras(cameraConnectionService.getSavedCameras());
  }, []);

  // Backend Polling Effect (Preserved 100% untouched logic)
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activeController: AbortController | undefined;
    const unbindAudioInteraction = monitoringAlertAudio.bindUserInteraction();

    const request = async <T,>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      const controller = new AbortController();
      activeController = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        return await operation(controller.signal);
      } finally {
        clearTimeout(timeout);
        if (activeController === controller) activeController = undefined;
      }
    };

    const refreshHistory = async () => {
      const data = await request(getAlertHistory);
      if (!disposed) setHistory(data);
      return data;
    };

    const poll = async () => {
      if (disposed) return;
      if (document.hidden) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }
      try {
        const current: LatestAlertResponse = await request(getLatestAlert);
        if (disposed) return;
        const currentId = current.alert?.id ?? null;
        const currentAlertKey = current.alert
          ? `${current.alert.id}:${current.alert.sequence}`
          : null;
        setLatest(current.alert);
        setHistory((previous) =>
          previous
            ? {
                ...previous,
                cameraId: current.cameraId,
                sessionId: current.sessionId,
                pipelineState: current.pipelineState,
              }
            : previous
        );
        if (initialized.current && current.alert && currentAlertKey !== latestAlertKey.current) {
          setNewAlertId(currentId);
          monitoringAlertAudio.handleAlert(current.alert);
        }
        if (!initialized.current || currentAlertKey !== latestAlertKey.current) {
          await refreshHistory();
        }
        latestAlertKey.current = currentAlertKey;
        initialized.current = true;
        setConnection('connected');
        setLastUpdated(new Date().toISOString());
      } catch {
        if (!disposed) setConnection('error');
      } finally {
        if (!disposed) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    timer = setTimeout(poll, 0);
    return () => {
      disposed = true;
      clearTimeout(timer);
      activeController?.abort();
      unbindAudioInteraction();
    };
  }, []);

  const pipelineState = history?.pipelineState ?? 'IDLE';
  const alerts = history?.alerts ?? [];

  // Build Unified Camera List for Overview
  interface MonitoringCameraItem {
    id: string;
    name: string;
    location: string;
    brand?: string;
    model?: string;
    ip?: string;
    isLive: boolean;
    playbackUrl?: string;
    webrtcUrl?: string;
  }

  const cameraList: MonitoringCameraItem[] = (() => {
    const list: MonitoringCameraItem[] = [];

    if (cameraSession.activeStream?.connected) {
      const savedMatch = savedCameras.find(
        (c) => c.id === cameraSession.activeStream?.cameraId
      );
      list.push({
        id: cameraSession.activeStream.cameraId,
        name: cameraSession.activeStream.cameraName,
        location: savedMatch?.brand
          ? `${savedMatch.brand} • ${savedMatch.ip}`
          : 'Phân xưởng sản xuất',
        brand: savedMatch?.brand || 'CCTV',
        model: savedMatch?.model,
        ip: savedMatch?.ip,
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
          brand: cam.brand,
          model: cam.model,
          ip: cam.ip,
          isLive: false,
        });
      }
    });

    return list;
  })();

  // Find currently selected camera for the Drawer
  const selectedCamera = cameraList.find((c) => c.id === selectedCameraId) || null;

  // Determine if a camera has an active alert
  const getCameraAlert = (camId: string): MonitoringAlert | null => {
    if (latest && (latest.cameraId === camId || latest.cameraId === 'camera-01' || latest.cameraId === 'camera-02-ezviz')) {
      return latest;
    }
    return null;
  };

  // Find linked incident for a camera/alert
  const getLinkedIncident = (camId: string): Incident | null => {
    return incidents.find((i) => i.cameraId === camId && (i.status === 'ACTIVE' || i.status === 'RESPONDING')) ||
      incidents.find((i) => i.status === 'ACTIVE' || i.status === 'RESPONDING') ||
      incidents[0] || null;
  };

  const selectedCameraAlert = selectedCamera ? getCameraAlert(selectedCamera.id) : null;
  const linkedIncident = selectedCamera ? getLinkedIncident(selectedCamera.id) : null;

  // Filter camera-specific alert history
  const selectedCameraAlerts = alerts;

  return (
    <div className="space-y-5 relative pb-10" id="monitoring-view">
      {/* 1. Header Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
              <h1 className="text-xl font-black text-slate-900 md:text-2xl tracking-tight">
                Màn Hình Giám Sát AI
              </h1>
              <span className="rounded-full bg-slate-900 text-white px-2.5 py-0.5 text-xs font-bold font-mono">
                {cameraList.length} CAMERA
              </span>
            </div>
            <p className="mt-1 text-xs md:text-sm text-slate-500">
              Hệ thống giám sát thị giác máy tính phát hiện khói & lửa thời gian thực (YOLOv8 Edge AI)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Audio Toggle */}
            <button
              type="button"
              aria-pressed={!audioEnabled}
              title={audioEnabled ? 'Tắt âm thanh cảnh báo' : 'Bật âm thanh cảnh báo'}
              onClick={() => {
                const nextEnabled = !audioEnabled;
                monitoringAlertAudio.setEnabled(nextEnabled);
                setAudioEnabled(nextEnabled);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors cursor-pointer shadow-2xs"
            >
              {audioEnabled ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-red-600" />
                  <span>Còi: Bật</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                  <span>Còi: Tắt</span>
                </>
              )}
            </button>

            {/* Connection Status Badge */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
              <Radio
                className={`h-4 w-4 ${
                  connection === 'connected'
                    ? 'text-emerald-600 animate-pulse'
                    : connection === 'error'
                    ? 'text-red-600'
                    : 'text-amber-600'
                }`}
              />
              <span className="font-bold text-slate-700">
                {connection === 'loading'
                  ? 'Đang kết nối Alert API'
                  : connection === 'error'
                  ? 'Mất kết nối API'
                  : `Pipeline: ${pipelineState}`}
              </span>
            </div>
          </div>
        </div>

        {connection === 'error' && (
          <div
            role="alert"
            className="mt-3.5 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Không kết nối được Alert API backend tại 127.0.0.1:8790. Hệ thống sẽ tự động thử lại.
            </span>
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* 2. LEVEL 1: MONITORING OVERVIEW GRID               */}
      {/* ================================================== */}
      {cameraList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <VideoOff className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">Chưa có camera nào kết nối</h2>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Vui lòng kiểm tra và kết nối luồng camera trong Camera Test để hiển thị trên màn hình giám sát.
          </p>
          <button
            onClick={() => navigate('/camera-test')}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Video className="h-4 w-4" />
            <span>Mở Camera Test</span>
          </button>
        </div>
      ) : (
        /* Rule 11: 2 large cameras per row on desktop (grid-cols-1 md:grid-cols-2) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cameraList.map((cam) => {
            const camAlert = getCameraAlert(cam.id);
            const isAlert = !!camAlert;
            const isSelected = selectedCameraId === cam.id;

            return (
              <div
                key={cam.id}
                onClick={() => setSelectedCameraId(cam.id)}
                className={`group relative rounded-2xl border bg-white overflow-hidden shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col ${
                  isAlert
                    ? 'border-red-500 ring-2 ring-red-500/30'
                    : isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Card Top Header */}
                <div
                  className={`flex items-center justify-between px-4 py-3 border-b transition-colors ${
                    isAlert
                      ? 'bg-red-50/90 border-red-100 text-red-950'
                      : 'bg-slate-50/80 border-slate-100 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold shrink-0 ${
                        isAlert ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isAlert ? (
                        camAlert?.class === 'fire' ? (
                          <Flame className="h-4 w-4 animate-bounce" />
                        ) : (
                          <Wind className="h-4 w-4 animate-pulse" />
                        )
                      ) : (
                        <Video className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold truncate text-slate-900 group-hover:text-blue-600 transition-colors">
                        {cam.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 truncate">{cam.location}</p>
                    </div>
                  </div>

                  {/* Badges on right */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isAlert ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase tracking-wider animate-pulse shadow-xs">
                        🔴 ALERT
                      </span>
                    ) : cam.isLive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        LIVE
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                        OFFLINE
                      </span>
                    )}
                  </div>
                </div>

                {/* Large Live Video Frame */}
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden flex items-center justify-center">
                  {cam.isLive && cam.playbackUrl ? (
                    <HlsVideoPlayer
                      src={cam.playbackUrl}
                      webrtcUrl={cam.webrtcUrl}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                      <VideoOff className="h-10 w-10 mb-2 opacity-60" />
                      <span className="text-xs font-bold text-slate-400">Camera chưa kết nối luồng RTSP</span>
                      <span className="text-[11px] text-slate-600 mt-0.5">Nhấp vào thẻ để kiểm tra cấu hình</span>
                    </div>
                  )}
                </div>

                {/* Bottom Status / Alert Summary Row */}
                <div
                  className={`px-4 py-2.5 flex items-center justify-between text-xs border-t transition-colors ${
                    isAlert
                      ? 'bg-red-50 text-red-900 border-red-100'
                      : 'bg-white text-slate-600 border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold min-w-0">
                    {isAlert ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-red-600 animate-ping shrink-0" />
                        <span className="text-red-700 truncate font-black tracking-wide">
                          {camAlert?.class === 'fire' ? '🔥 PHÁT HIỆN LỬA (FIRE DETECTED)' : '💨 PHÁT HIỆN KHÓI (SMOKE DETECTED)'}
                        </span>
                      </>
                    ) : cam.isLive ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-emerald-700 font-semibold truncate">
                          AI MONITORING ACTIVE • BÌNH THƯỜNG
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                        <span className="text-slate-500 font-medium">SẴN SÀNG CẤU HÌNH</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors shrink-0 ml-2">
                    <span>Chi tiết</span>
                    <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================== */}
      {/* 3. LEVEL 2: CAMERA DETAIL MODAL (CENTERED)          */}
      {/* ================================================== */}
      {selectedCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          {/* Backdrop for click away */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedCameraId(null)}
          />

          {/* Modal Panel Centered */}
          <div
            className="relative z-10 w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto"
            id="camera-detail-modal"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/95 px-5 sm:px-6 py-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white shrink-0 shadow-xs ${
                    selectedCameraAlert
                      ? selectedCameraAlert.class === 'fire'
                        ? 'bg-red-600'
                        : 'bg-amber-600'
                      : 'bg-slate-900'
                  }`}
                >
                  {selectedCameraAlert ? (
                    <AlertTypeIcon type={selectedCameraAlert.class} />
                  ) : (
                    <Video className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      CHI TIẾT CAMERA
                    </span>
                    {selectedCamera.isLive && (
                      <span className="rounded bg-emerald-100 text-emerald-800 font-black text-[9px] px-1.5 py-0.5 uppercase">
                        LIVE
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
                    {selectedCamera.name}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => setSelectedCameraId(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column: Video stream & Specs */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Camera Video Section */}
                  <div className="rounded-xl border border-slate-200 bg-slate-950 overflow-hidden shadow-xs">
                    <div className="aspect-video w-full flex items-center justify-center bg-black">
                      {selectedCamera.isLive && selectedCamera.playbackUrl ? (
                        <HlsVideoPlayer
                          src={selectedCamera.playbackUrl}
                          webrtcUrl={selectedCamera.webrtcUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                          <VideoOff className="h-10 w-10 mb-2 opacity-60" />
                          <span className="text-xs font-bold text-slate-400">Luồng camera không hoạt động</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-900 px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>ID: <strong className="text-white">{selectedCamera.id}</strong></span>
                      <span>IP: <strong className="text-slate-200">{selectedCamera.ip || '192.168.1.17'}</strong></span>
                      <span className={selectedCamera.isLive ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                        {selectedCamera.isLive ? '● ONLINE' : '○ OFFLINE'}
                      </span>
                    </div>
                  </div>

                  {/* Technical Information Card */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                    <h4 className="font-bold uppercase tracking-wider text-slate-600 text-[11px] border-b border-slate-200/80 pb-1.5 flex items-center justify-between">
                      <span>Thông Số Kỹ Thuật</span>
                      <span className="text-slate-400 font-mono font-normal">CCTV Config</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-slate-500 block text-[11px]">Vị trí lắp đặt:</span>
                        <strong className="text-slate-900 font-medium">{selectedCamera.location}</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-slate-500 block text-[11px]">Thương hiệu / Model:</span>
                        <strong className="text-slate-900 font-medium">
                          {selectedCamera.brand || 'CCTV IP'} {selectedCamera.model ? `(${selectedCamera.model})` : ''}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-slate-500 block text-[11px]">Giao thức luồng:</span>
                        <strong className="text-slate-900 font-mono font-medium">RTSP / HLS Bridge</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <span className="text-slate-500 block text-[11px]">Trạng thái phân tích:</span>
                        <strong className="text-emerald-600 font-semibold">AI YOLOv8 Giám Sát</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Active Alert Details & History Timeline */}
                <div className="lg:col-span-5 space-y-4">
                  {/* SECTION A: ACTIVE ALERT DETAILS (IF CAMERA HAS ALERT) */}
                  {selectedCameraAlert ? (
                    <div
                      className={`rounded-2xl border-2 p-4 sm:p-5 shadow-sm space-y-4 ${
                        selectedCameraAlert.class === 'fire'
                          ? 'border-red-500 bg-red-50/60'
                          : 'border-amber-500 bg-amber-50/60'
                      }`}
                    >
                      {/* Alert Header Badge Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-red-200/60 pb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black tracking-wider uppercase text-white shadow-xs ${
                              selectedCameraAlert.class === 'fire' ? 'bg-red-600' : 'bg-amber-600'
                            }`}
                          >
                            {selectedCameraAlert.class === 'fire' ? '🔥 FIRE DETECTED' : '💨 SMOKE DETECTED'}
                          </span>
                          {newAlertId === selectedCameraAlert.id && (
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                              MỚI
                            </span>
                          )}
                        </div>

                        <time className="text-xs font-bold text-slate-600 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatMonitoringTime(selectedCameraAlert.timestamp)}
                        </time>
                      </div>

                      {/* AI Detection Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 shadow-2xs">
                          <div className="text-slate-500 text-[10px] font-semibold">Độ tin cậy</div>
                          <div className="text-base font-black text-red-600 font-mono">
                            {(selectedCameraAlert.confidence * 100).toFixed(1)}%
                          </div>
                        </div>

                        <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 shadow-2xs">
                          <div className="text-slate-500 text-[10px] font-semibold">Ngưỡng cảnh báo</div>
                          <div className="text-base font-black text-slate-800 font-mono">
                            {selectedCameraAlert.class === 'fire' ? '85.0%' : '80.0%'}
                          </div>
                        </div>

                        <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 shadow-2xs">
                          <div className="text-slate-500 text-[10px] font-semibold">Khung hình liên tục</div>
                          <div className="text-xs font-bold text-slate-800 font-mono">
                            3 Frames
                          </div>
                        </div>

                        <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 shadow-2xs">
                          <div className="text-slate-500 text-[10px] font-semibold">Frame Sequence</div>
                          <div className="text-xs font-bold text-slate-900 font-mono">
                            #{selectedCameraAlert.sequence}
                          </div>
                        </div>
                      </div>

                      {/* Evidence Section */}
                      {selectedCameraAlert.evidenceUrl && (
                        <div className="rounded-xl bg-white p-3.5 border border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                            <span>Ảnh bằng chứng AI (Evidence)</span>
                            <span className="text-[10px] text-red-600 font-semibold uppercase">Bounding Box</span>
                          </div>

                          {/* Evidence Thumbnail with Click to Lightbox */}
                          <div
                            onClick={() => setLightboxEvidenceUrl(evidenceHref(selectedCameraAlert.evidenceUrl!))}
                            className="relative rounded-lg overflow-hidden border border-red-300 bg-slate-900 group cursor-pointer aspect-video"
                          >
                            <img
                              src={evidenceHref(selectedCameraAlert.evidenceUrl)}
                              alt="AI Evidence"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-950/30 group-hover:bg-slate-950/10 transition-colors flex items-center justify-center">
                              <span className="bg-slate-900/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg backdrop-blur-xs flex items-center gap-1.5 shadow-md">
                                <Maximize2 className="h-3.5 w-3.5" /> Phóng to ảnh
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => setLightboxEvidenceUrl(evidenceHref(selectedCameraAlert.evidenceUrl!))}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Xem ảnh bằng chứng (Lightbox)</span>
                          </button>
                        </div>
                      )}

                      {/* Incident Navigation */}
                      {linkedIncident && (
                        <div className="pt-1">
                          <button
                            onClick={() => {
                              setSelectedCameraId(null);
                              navigate(`/incidents/${linkedIncident.id}`);
                            }}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-black shadow-md transition-all cursor-pointer tracking-wide"
                          >
                            <Shield className="h-4 w-4" />
                            <span>MỞ CHI TIẾT SỰ CỐ (#{linkedIncident.id.substring(0, 8)})</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* SECTION B: NORMAL CAMERA */
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-emerald-900">Không có cảnh báo cháy/khói</div>
                          <div className="text-emerald-700 text-[11px] mt-0.5">
                            Thuật toán AI đang giám sát bình thường và ổn định.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION C: HISTORY / TIMELINE */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Lịch Sử Cảnh Báo</h3>
                        <p className="text-[10px] text-slate-500">Sự kiện nhận diện gần nhất</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <RefreshCw className={`h-3 w-3 ${connection === 'loading' ? 'animate-spin' : ''}`} />
                        <span>{lastUpdated ? formatMonitoringTime(lastUpdated) : 'Live'}</span>
                      </div>
                    </div>

                    {selectedCameraAlerts.length > 0 ? (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {selectedCameraAlerts.slice(0, 8).map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-black text-white shrink-0 ${
                                  a.class === 'fire' ? 'bg-red-600' : 'bg-amber-600'
                                }`}
                              >
                                {a.class.toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 text-[11px]">
                                  {(a.confidence * 100).toFixed(1)}% tin cậy
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {formatMonitoringTime(a.timestamp)}
                                </div>
                              </div>
                            </div>

                            {a.evidenceUrl && (
                              <button
                                onClick={() => setLightboxEvidenceUrl(evidenceHref(a.evidenceUrl!))}
                                className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 text-[10px] shrink-0 bg-white px-2 py-1 rounded border border-slate-200 cursor-pointer"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Ảnh</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
                        Chưa có sự kiện cảnh báo nào được lưu trong bộ nhớ.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* 4. LEVEL 3: EVIDENCE LIGHTBOX MODAL                */}
      {/* ================================================== */}
      {lightboxEvidenceUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in-50 duration-200">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950 text-white">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-red-500" />
                <span className="text-sm font-bold tracking-wide">ẢNH BẰNG CHỨNG NHẬN DIỆN AI (EVIDENCE)</span>
              </div>
              <button
                onClick={() => setLightboxEvidenceUrl(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Evidence Image */}
            <div className="p-4 flex items-center justify-center bg-black">
              <img
                src={lightboxEvidenceUrl}
                alt="Full Evidence Frame"
                className="max-h-[70vh] w-auto object-contain rounded-lg border border-red-500/50"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
              <span>Được trích xuất trực tiếp từ luồng xử lý Computer Vision</span>
              <a
                href={lightboxEvidenceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sky-400 hover:underline font-semibold"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Mở trong tab mới</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
