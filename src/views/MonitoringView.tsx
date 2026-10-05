import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Flame,
  Wind,
  HardHat,
  Radio,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Volume2,
  VolumeX,
  Maximize2,
  Eye,
  RefreshCw,
  Video,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { HlsVideoPlayer } from '../components/HlsVideoPlayer';
import { cameraSessionStore } from '../services/cameraSessionStore';
import { cameraConnectionService } from '../services/cameraConnectionService';
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
import { CameraConnectionConfig } from '../types';

const POLL_INTERVAL_MS = 2500;
const REQUEST_TIMEOUT_MS = 5000;

interface MonitoringCameraItem {
  id: string;
  name: string;
  location?: string;
  brand?: string;
  ip?: string;
  isLiveStream: boolean;
  playbackUrl?: string;
  webrtcUrl?: string;
  status: 'LIVE' | 'OFFLINE' | 'CONNECTING';
}

export const MonitoringView: React.FC = () => {
  const navigate = useNavigate();
  const cameraSession = useSyncExternalStore(
    cameraSessionStore.subscribe,
    cameraSessionStore.getSnapshot
  );

  const [savedCameras, setSavedCameras] = useState<CameraConnectionConfig[]>([]);
  const [history, setHistory] = useState<AlertHistoryResponse | null>(null);
  const [latest, setLatest] = useState<MonitoringAlert | null>(null);
  const [newAlertId, setNewAlertId] = useState<string | null>(null);
  const [connection, setConnection] = useState<'loading' | 'connected' | 'error'>('loading');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(() => monitoringAlertAudio.isEnabled());

  // Level 2 & Level 3 states
  const [selectedCamera, setSelectedCamera] = useState<MonitoringCameraItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [evidenceLightboxAlert, setEvidenceLightboxAlert] = useState<MonitoringAlert | null>(null);

  const latestAlertKey = useRef<string | null>(null);
  const initialized = useRef(false);

  // Load saved camera configurations
  useEffect(() => {
    const list = cameraConnectionService.getSavedCameras();
    setSavedCameras(list);
  }, [cameraSession]);

  // AI Alert polling loop
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
        if (
          initialized.current &&
          current.alert &&
          currentAlertKey !== latestAlertKey.current
        ) {
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

  // Consolidate camera list for Level 1 Overview
  const cameraList: MonitoringCameraItem[] = [];

  if (cameraSession.activeStream?.connected) {
    cameraList.push({
      id: cameraSession.activeStream.cameraId,
      name: cameraSession.activeStream.cameraName || 'Camera Live 01',
      location: 'Phân xưởng sản xuất',
      isLiveStream: true,
      playbackUrl: cameraSession.activeStream.playbackUrl,
      webrtcUrl: cameraSession.activeStream.webrtcUrl,
      status: 'LIVE',
    });
  }

  savedCameras.forEach((cam) => {
    if (!cameraList.some((c) => c.id === cam.id)) {
      cameraList.push({
        id: cam.id,
        name: cam.name,
        location: cam.brand ? `${cam.brand} • ${cam.ip}` : cam.ip,
        brand: cam.brand,
        ip: cam.ip,
        isLiveStream: false,
        status: 'OFFLINE',
      });
    }
  });

  // Check if camera has an active alert
  const getCameraAlert = (camId: string): MonitoringAlert | null => {
    if (!latest) return null;
    if (latest.cameraId === camId || latest.cameraId === 'CAM-01' || cameraList.length === 1) {
      return latest;
    }
    return null;
  };

  const handleOpenDrawer = (cam: MonitoringCameraItem) => {
    setSelectedCamera(cam);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const activeAlerts = latest ? [latest] : [];

  return (
    <div className="relative space-y-5 pb-10" id="monitoring-view">
      {/* Top Operational Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Màn hình giám sát (Live Monitoring)
            </h1>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 font-mono">
              {cameraList.length} CAMERAS
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Trung tâm giám sát an toàn công nghiệp 24/7 — AI Fire & Smoke Detection
          </p>
        </div>

        {/* Status Indicators & Audio Control */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium">
            <Radio
              className={`h-3.5 w-3.5 ${
                connection === 'connected'
                  ? 'text-emerald-600 animate-pulse'
                  : connection === 'error'
                  ? 'text-red-600'
                  : 'text-amber-500'
              }`}
            />
            <span className="text-slate-700">
              {connection === 'connected'
                ? `Edge AI: ${history?.pipelineState || 'RUNNING'}`
                : connection === 'error'
                ? 'Edge AI: Mất kết nối'
                : 'Đang kết nối...'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !audioEnabled;
              monitoringAlertAudio.setEnabled(next);
              setAudioEnabled(next);
            }}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold transition-colors cursor-pointer ${
              audioEnabled
                ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}
            title={audioEnabled ? 'Tắt còi cảnh báo' : 'Bật còi cảnh báo'}
          >
            {audioEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-amber-600" />
            )}
            <span>{audioEnabled ? 'Còi: BẬT' : 'Còi: TẮT'}</span>
          </button>
        </div>
      </div>

      {/* Connection Warning Banner */}
      {connection === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Không thể kết nối FastAPI tại <code>http://127.0.0.1:8790</code>. Đang thử kết nối lại tự động.
          </span>
        </div>
      )}

      {/* LEVEL 1: Active Alerts Summary Banner (if any) */}
      {activeAlerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 shadow-xs animate-in fade-in-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
              <span className="font-bold text-sm text-red-900">
                🔴 {activeAlerts.length} Cảnh báo đang hoạt động:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {activeAlerts.map((alt) => (
                  <button
                    key={alt.id}
                    onClick={() => {
                      const cam = cameraList.find((c) => c.id === alt.cameraId) || cameraList[0];
                      if (cam) handleOpenDrawer(cam);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    {alt.class === 'fire' ? (
                      <Flame className="h-3 w-3" />
                    ) : (
                      <Wind className="h-3 w-3" />
                    )}
                    <span>
                      {alt.cameraId} — {alt.class.toUpperCase()} DETECTED
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <span className="text-[11px] text-red-700 font-medium">
              Nhấp vào camera để xem chi tiết AI & Bằng chứng
            </span>
          </div>
        </div>
      )}

      {/* LEVEL 1: MONITORING OVERVIEW (Responsive Camera Grid) */}
      {cameraList.length === 0 ? (
        /* Empty State */
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center shadow-2xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Video className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">Chưa có camera nào được kết nối</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Hệ thống chưa nhận diện luồng camera. Hãy chuyển qua trang Camera Test để kết nối camera CCTV/RTSP thật vào hệ thống.
          </p>
          <button
            onClick={() => navigate('/camera-test')}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition-colors cursor-pointer"
          >
            <Video className="h-4 w-4" />
            <span>KẾT NỐI CAMERA NGAY</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameraList.map((cam) => {
            const camAlert = getCameraAlert(cam.id);
            const isAlert = !!camAlert;

            return (
              <div
                key={cam.id}
                onClick={() => handleOpenDrawer(cam)}
                className={`group relative flex flex-col rounded-xl border bg-white overflow-hidden shadow-2xs transition-all duration-150 cursor-pointer hover:shadow-md ${
                  isAlert
                    ? 'border-red-500 ring-2 ring-red-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Card Header: Camera ID/Name + Status Indicator */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {cam.name}
                      </span>
                    </div>
                    {cam.location && (
                      <span className="text-[11px] text-slate-500 truncate block">
                        {cam.location}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {cam.status === 'LIVE' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                        LIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        OFFLINE
                      </span>
                    )}
                  </div>
                </div>

                {/* Video Screen Area */}
                <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                  {cam.isLiveStream && cam.playbackUrl ? (
                    <div className="h-full w-full pointer-events-none">
                      <HlsVideoPlayer
                        src={cam.playbackUrl}
                        webrtcUrl={cam.webrtcUrl}
                        controls={false}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-500">
                      <Video className="h-8 w-8 text-slate-600" />
                      <span className="text-xs font-medium">Chưa có tín hiệu live</span>
                    </div>
                  )}

                  {/* Hover Quick Inspection Button */}
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-900 shadow-md backdrop-blur-xs">
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>Xem chi tiết</span>
                    </span>
                  </div>

                  {/* Top-Right Alert Ribbon */}
                  {isAlert && (
                    <div className="absolute top-2 right-2 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wide shadow-md animate-pulse">
                      🔴 {camAlert.class.toUpperCase()} DETECTED
                    </div>
                  )}
                </div>

                {/* Card Footer: Normal or Alert Type */}
                <div
                  className={`px-3.5 py-2 text-xs flex items-center justify-between border-t ${
                    isAlert
                      ? 'bg-red-50 text-red-900 border-red-100 font-bold'
                      : 'bg-white text-slate-600 border-slate-100 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isAlert ? (
                      <>
                        <Flame className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span>CẢNH BÁO: {camAlert.class.toUpperCase()}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>Trạng thái bình thường</span>
                      </>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 group-hover:text-slate-700 transition-colors">
                    Chi tiết &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LEVEL 2: CAMERA DETAIL SIDE DRAWER / PANEL */}
      {isDrawerOpen && selectedCamera && (
        <>
          {/* Backdrop for drawer */}
          <div
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-2xs transition-opacity"
            onClick={handleCloseDrawer}
          />

          {/* Side Drawer Container */}
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200"
            id="camera-detail-drawer"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <Video className="h-5 w-5 text-slate-800" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {selectedCamera.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {selectedCamera.id} {selectedCamera.location ? `• ${selectedCamera.location}` : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseDrawer}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                title="Đóng bảng chi tiết"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Enlarged Live Camera Stream */}
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-md">
                <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 text-[11px] font-mono text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        selectedCamera.status === 'LIVE'
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span className="font-bold">
                      {selectedCamera.status === 'LIVE' ? 'LIVE STREAM' : 'OFFLINE'}
                    </span>
                  </div>
                  <span>1080p @ 25fps</span>
                </div>

                <div className="aspect-video w-full bg-black">
                  {selectedCamera.isLiveStream && selectedCamera.playbackUrl ? (
                    <HlsVideoPlayer
                      src={selectedCamera.playbackUrl}
                      webrtcUrl={selectedCamera.webrtcUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-slate-500">
                      <Video className="h-10 w-10 mb-2" />
                      <span className="text-xs">Camera chưa có luồng phát trực tiếp</span>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Detection Details */}
              {(() => {
                const camAlert = getCameraAlert(selectedCamera.id);
                if (camAlert) {
                  return (
                    <div className="rounded-xl border-2 border-red-500 bg-red-50/70 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                          <Flame className="h-4 w-4 text-red-600" />
                          <span>PHÁT HIỆN SỰ CỐ: {camAlert.class.toUpperCase()}</span>
                        </div>
                        <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
                          HIGH SEVERITY
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-white/80 p-3 rounded-lg border border-red-200">
                        <div>
                          <span className="text-slate-500 block">Độ tin cậy AI:</span>
                          <strong className="text-slate-900 text-sm font-mono">
                            {(camAlert.confidence * 100).toFixed(1)}%
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Thời điểm phát hiện:</span>
                          <strong className="text-slate-900 text-xs font-mono">
                            {formatMonitoringTime(camAlert.timestamp)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Frame Resolution:</span>
                          <span className="text-slate-800 font-mono text-xs">
                            {camAlert.width} &times; {camAlert.height}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Sequence ID:</span>
                          <span className="text-slate-800 font-mono text-xs">
                            #{camAlert.sequence}
                          </span>
                        </div>
                      </div>

                      {/* Evidence Image Preview (Level 2 -> Level 3 Lightbox trigger) */}
                      {camAlert.evidenceUrl && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-slate-700">
                            <span className="font-bold">Ảnh bằng chứng (Snapshot AI):</span>
                            <span className="text-[11px] text-slate-500">Chụp lúc phát hiện</span>
                          </div>
                          <div
                            onClick={() => setEvidenceLightboxAlert(camAlert)}
                            className="group relative aspect-video w-full rounded-lg border border-slate-300 bg-slate-900 overflow-hidden cursor-pointer hover:border-red-500 transition-colors"
                          >
                            <img
                              src={evidenceHref(camAlert.evidenceUrl)}
                              alt="Evidence Snapshot"
                              className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 flex items-center justify-center transition-colors">
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-xs">
                                <Eye className="h-3.5 w-3.5" />
                                <span>Phóng to bằng chứng</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* View Incident Action */}
                      <button
                        onClick={() => {
                          handleCloseDrawer();
                          navigate('/incidents');
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition-colors cursor-pointer"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        <span>QUẢN LÝ SỰ CỐ NÀY (VIEW INCIDENT)</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center space-y-1">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
                    <h3 className="text-xs font-bold text-slate-900">Không có cảnh báo hoạt động</h3>
                    <p className="text-[11px] text-slate-500">
                      Camera đang vận hành bình thường, không ghi nhận đám cháy hoặc vi phạm an toàn.
                    </p>
                  </div>
                );
              })()}

              {/* Camera Connection Metadata */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Thông số kết nối camera
                </h3>
                <div className="divide-y divide-slate-100 text-xs text-slate-600">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Địa chỉ IP:</span>
                    <span className="font-mono text-slate-900">{selectedCamera.ip || '127.0.0.1'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Giao thức:</span>
                    <span className="font-semibold text-slate-900">RTSP / HLS Bridge</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Thương hiệu:</span>
                    <span className="text-slate-900">{selectedCamera.brand || 'Hikvision'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Trạng thái:</span>
                    <span
                      className={`font-bold ${
                        selectedCamera.status === 'LIVE' ? 'text-emerald-600' : 'text-slate-500'
                      }`}
                    >
                      {selectedCamera.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* LEVEL 3: EVIDENCE DETAIL MODAL / LIGHTBOX */}
      {evidenceLightboxAlert && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in-50">
          <div className="relative flex flex-col w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl overflow-hidden">
            {/* Lightbox Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-950">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <h3 className="font-bold text-sm text-slate-100">
                  Bằng Chứng AI (Evidence) — Camera {evidenceLightboxAlert.cameraId}
                </h3>
              </div>
              <button
                onClick={() => setEvidenceLightboxAlert(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Lightbox Body: Image */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
              {evidenceLightboxAlert.evidenceUrl ? (
                <img
                  src={evidenceHref(evidenceLightboxAlert.evidenceUrl)}
                  alt="Evidence Lightbox"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-500">Không có ảnh bằng chứng</span>
              )}
            </div>

            {/* Lightbox Footer: Metadata details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-800 bg-slate-950 p-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">LOẠI CẢNH BÁO</span>
                <strong className="text-red-400 font-sans uppercase">
                  {evidenceLightboxAlert.class}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">CONFIDENCE</span>
                <strong className="text-slate-200">
                  {(evidenceLightboxAlert.confidence * 100).toFixed(1)}%
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">THỜI GIAN GHI NHẬN</span>
                <span className="text-slate-300">
                  {formatMonitoringTime(evidenceLightboxAlert.timestamp)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">SEQUENCE ID</span>
                <span className="text-slate-300">#{evidenceLightboxAlert.sequence}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
