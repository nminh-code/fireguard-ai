import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Flame,
  HardHat,
  Radio,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Video,
  Layers,
  Activity,
  Server,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { cameraConnectionService } from '../services/cameraConnectionService';
import { cameraSessionStore } from '../services/cameraSessionStore';
import { incidentService } from '../services/incidentService';
import { realtimeService } from '../services/realtimeService';
import {
  getLatestAlert,
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

  const loadOperationalData = async () => {
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
    loadOperationalData();

    const unsubGlobal = realtimeService.subscribeToGlobalState(() => {
      loadOperationalData();
    });

    const unsubIncident = realtimeService.subscribeToIncidentEvents(() => {
      loadOperationalData();
    });

    return () => {
      unsubGlobal();
      unsubIncident();
    };
  }, []);

  // Compute actual camera metrics
  const totalCameras = savedCameras.length + (cameraSession.activeStream && !savedCameras.some(c => c.id === cameraSession.activeStream?.cameraId) ? 1 : 0);
  const onlineCameras = cameraSession.activeStream?.connected ? 1 : 0;
  const offlineCameras = Math.max(0, totalCameras - onlineCameras);

  const activeIncidents = incidents.filter(
    (i) => i.status === 'ACTIVE' || i.status === 'RESPONDING'
  );

  const isConfigured = totalCameras > 0;

  return (
    <div className="space-y-6 pb-12" id="dashboard-view">
      {/* Factory Operational Status Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              Hệ Thống Giám Sát An Toàn Vận Hành (FireVis Industrial)
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Trung tâm chỉ huy & kiểm soát an toàn phòng chống cháy nổ nhà máy
          </p>
        </div>

        {/* Global Operational Readiness Badge */}
        <div className="flex items-center gap-2">
          {activeIncidents.length > 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs animate-pulse">
              <Flame className="h-4 w-4" />
              <span>CÓ {activeIncidents.length} SỰ CỐ HOẠT ĐỘNG</span>
            </div>
          ) : isConfigured ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>HỆ THỐNG VẬN HÀNH BÌNH THƯỜNG</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <AlertTriangle className="h-4 w-4 text-slate-500" />
              <span>CHƯA CẤU HÌNH CAMERA</span>
            </div>
          )}
        </div>
      </div>

      {/* When NO camera is configured: Show clear industrial Empty State CTA */}
      {!isConfigured ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center shadow-2xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Video className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900 uppercase tracking-wide">
            Hệ Thống Chưa Được Cấu Hình (System Not Configured)
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Chưa có camera nào được kết nối với hệ thống giám sát. Hãy thêm cấu hình và kiểm tra kết nối camera để bắt đầu theo dõi an toàn.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate('/camera-test')}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition-colors cursor-pointer"
            >
              <Video className="h-4 w-4" />
              <span>ĐẾN TRANG CAMERA TEST</span>
            </button>
            <button
              onClick={() => navigate('/monitoring')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span>MỞ MÀN HÌNH GIÁM SÁT</span>
            </button>
          </div>
        </div>
      ) : (
        /* Real Metrics Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Cameras */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Tổng Số Camera
              </span>
              <Video className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {totalCameras}
              </span>
              <span className="text-xs text-slate-500">thiết bị</span>
            </div>
          </div>

          {/* Online Cameras */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Camera Trực Tuyến
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 font-mono">
                {onlineCameras}
              </span>
              <span className="text-xs text-slate-500">đang live</span>
            </div>
          </div>

          {/* Offline Cameras */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Camera Ngoại Tuyến
              </span>
              <span className="h-2 w-2 rounded-full bg-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-700 font-mono">
                {offlineCameras}
              </span>
              <span className="text-xs text-slate-500">chưa kết nối stream</span>
            </div>
          </div>

          {/* Active Incidents */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Sự Cố Hoạt Động
              </span>
              <ShieldAlert
                className={`h-4 w-4 ${
                  activeIncidents.length > 0 ? 'text-red-600' : 'text-slate-400'
                }`}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-2xl font-black font-mono ${
                  activeIncidents.length > 0 ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {activeIncidents.length}
              </span>
              <span className="text-xs text-slate-500">sự cố cần xử lý</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): AI Modules Status & Connected Cameras */}
        <div className="lg:col-span-7 space-y-6">
          {/* AI Modules Status (Strictly 2 Modules: Fire & PPE) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-700" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                  Trạng Thái Các Module AI
                </h2>
              </div>
              <span className="text-xs text-slate-500">2 Modules chuẩn</span>
            </div>

            <div className="space-y-3">
              {/* Module 1: Fire Detection */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      🔥 FIRE DETECTION (Phát hiện khói & lửa)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Mô hình YOLOv8 Fire/Smoke • Phân tích thời gian thực
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    ACTIVE
                  </span>
                </div>
              </div>

              {/* Module 2: PPE Detection */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <HardHat className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      🦺 PPE DETECTION (Giám sát đồ bảo hộ)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Phát hiện Mũ bảo hộ & Áo phản quang công nhân
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
                    STANDBY
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Connected Cameras Table / Overview */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                Danh Sách Camera Đã Lưu ({savedCameras.length})
              </h2>
              <button
                onClick={() => navigate('/monitoring')}
                className="text-xs font-bold text-slate-700 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Mở giám sát</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {savedCameras.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Chưa có camera nào trong cấu hình. Hãy vào Camera Test để thêm camera.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {savedCameras.map((cam) => {
                  const isLive = cameraSession.activeStream?.cameraId === cam.id;
                  return (
                    <div
                      key={cam.id}
                      className="flex items-center justify-between py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <Video className="h-4 w-4 text-slate-400" />
                        <div>
                          <span className="font-bold text-slate-900 block">{cam.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {cam.brand} • {cam.ip}
                          </span>
                        </div>
                      </div>

                      <div>
                        {isLive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            LIVE
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-medium">
                            CONFIGURED
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Active Incidents & Recent AI Alerts */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Incidents Container */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                  Sự Cố Đang Hoạt Động
                </h2>
              </div>
              <button
                onClick={() => navigate('/incidents')}
                className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
              >
                Xem tất cả
              </button>
            </div>

            {activeIncidents.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-5 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
                <h3 className="mt-2 text-xs font-bold text-slate-900">Không có sự cố nào</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Nhà máy đang trong điều kiện an toàn, không có mã sự cố mở.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className="rounded-lg border border-red-200 bg-red-50/60 p-3 hover:bg-red-50 transition-colors cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-red-900">#{inc.code}</span>
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                        {inc.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700">
                      <strong>{inc.location}</strong> ({inc.cameraCode})
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                      <span>Độ tin cậy: {inc.fireConfidence}%</span>
                      <span>Lúc: {inc.detectedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent AI Detections List */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                Cảnh Báo Gần Nhất (Recent Alerts)
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">
                {isAlertApiOnline ? '🟢 API Online' : '⚪ Standby'}
              </span>
            </div>

            {recentAlerts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Chưa có cảnh báo nào được ghi nhận gần đây.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {recentAlerts.slice(0, 5).map((alt) => (
                  <div key={alt.id} className="py-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white uppercase ${
                          alt.class === 'fire' ? 'bg-red-600' : 'bg-amber-600'
                        }`}
                      >
                        {alt.class}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {formatMonitoringTime(alt.timestamp)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Camera: {alt.cameraId}</span>
                      <span className="font-mono font-bold">
                        {(alt.confidence * 100).toFixed(1)}%
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
