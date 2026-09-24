import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardStats, Camera, Incident } from '../types';
import { incidentService } from '../services/incidentService';
import { cameraService } from '../services/cameraService';
import { realtimeService } from '../services/realtimeService';
import { soundManager } from '../utils/audioAlert';
import { CctvPlayer } from '../components/CctvPlayer';
import {
  Cctv,
  Flame,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Radio,
  Eye,
  MapPin,
  Zap,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [featuredCameras, setFeaturedCameras] = useState<Camera[]>([]);
  const [offlineCameras, setOfflineCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [s, incs, cams] = await Promise.all([
        incidentService.getDashboardStats(),
        incidentService.getIncidents(),
        cameraService.getCameras(),
      ]);

      setStats(s);
      const active = incs.find((i) => i.status === 'ACTIVE' || i.status === 'RESPONDING');
      setActiveIncident(active || null);

      // Featured cameras: Active fire camera first, or key warehouse cameras
      const fireCam = cams.find((c) => c.status === 'FIRE');
      const otherCams = cams.filter((c) => c.id !== fireCam?.id).slice(0, 3);
      setFeaturedCameras(fireCam ? [fireCam, ...otherCams] : cams.slice(0, 4));

      // Offline cameras list
      const off = cams.filter((c) => c.status === 'OFFLINE');
      setOfflineCameras(off);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const unsubGlobal = realtimeService.subscribeToGlobalState(() => {
      fetchDashboardData();
    });

    const unsubIncident = realtimeService.subscribeToIncidentEvents(() => {
      fetchDashboardData();
    });

    const unsubCamera = realtimeService.subscribeToCameraUpdates(() => {
      fetchDashboardData();
    });

    return () => {
      unsubGlobal();
      unsubIncident();
      unsubCamera();
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6" id="dashboard-view">
      {/* Factory Overview Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
                Nhà máy ABC - Hải Phòng
              </h1>
              <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                KCN Đình Vũ
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5">
              <span className="text-xs text-slate-500 font-medium">Trạng thái hệ thống:</span>
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                SYSTEM OPERATIONAL
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Prominent Incident Banner: Normal vs Active Fire */}
      {activeIncident ? (
        <div
          className="rounded-xl border-2 border-red-600 bg-red-50 p-5 shadow-md animate-fade-in"
          id="banner-active-incident"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-md">
                <Flame className="h-7 w-7 fill-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-black text-white uppercase tracking-wider animate-pulse">
                    🔴 ACTIVE FIRE INCIDENT
                  </span>
                  <span className="text-xs font-mono font-bold text-red-800">
                    Mã sự cố: #{activeIncident.code}
                  </span>
                  <span className="text-xs text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded font-bold">
                    CẤP ĐỘ: {activeIncident.severity}
                  </span>
                </div>

                <div className="mt-2 text-slate-900">
                  <span className="text-base font-bold text-red-950">
                    {activeIncident.location}
                  </span>
                  <span className="text-slate-400 mx-2">•</span>
                  <span className="text-sm font-semibold text-slate-700">
                    Camera: {activeIncident.cameraCode}
                  </span>
                  <span className="text-slate-400 mx-2">•</span>
                  <span className="text-sm font-mono text-slate-600">
                    Phát hiện lúc: {activeIncident.detectedAt}
                  </span>
                  <span className="text-slate-400 mx-2">•</span>
                  <span className="text-sm font-bold text-red-700">
                    AI Xác nhận: {activeIncident.fireConfidence}%
                  </span>
                </div>

                <p className="text-xs text-red-900 mt-1">
                  Đám cháy được hệ thống AI Favis phát hiện tự động. Yêu cầu bộ phận an ninh và
                  đội PCCC cơ sở kiểm tra hiện trường ngay lập tức!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate(`/incidents/${activeIncident.id}`)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 active:scale-98 text-white px-5 py-3 text-sm font-bold shadow-md transition-all cursor-pointer"
                id="btn-view-incident-banner"
              >
                <span>XEM CHI TIẾT SỰ CỐ</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-2xs flex items-center justify-between"
          id="banner-system-normal"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-emerald-900">🟢 SYSTEM NORMAL</span>
                <span className="text-xs text-emerald-700 font-medium">
                  Không phát hiện sự cố cháy nào trong toàn bộ 6 phân khu nhà máy
                </span>
              </div>
              <p className="text-xs text-emerald-800/80 mt-0.5">
                AI Vision đang giám sát liên tục theo thời gian thực (chu kỳ quét 1.2s/luồng)
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playFireAlarm();
              incidentService.simulateFireEvent();
            }}
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-emerald-200 px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer font-medium"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Thử nghiệm báo cháy</span>
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Cameras */}
        <div
          onClick={() => navigate('/cameras')}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Cameras</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Cctv className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{stats.totalCameras}</span>
            <span className="text-xs text-slate-500 font-medium">Camera CCTV/IP</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span>Bảo phủ 6 khu vực nhà máy</span>
          </div>
        </div>

        {/* Cameras Online */}
        <div
          onClick={() => navigate('/cameras')}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Cameras Online</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{stats.camerasOnline}</span>
            <span className="text-xs text-slate-500 font-medium">/ {stats.totalCameras} luồng</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">Tỷ lệ trực tuyến</span>
            <span className="font-semibold text-slate-700">
              {Math.round((stats.camerasOnline / stats.totalCameras) * 100)}%
            </span>
          </div>
        </div>

        {/* Active Incidents */}
        <div
          onClick={() => navigate('/incidents')}
          className={`rounded-xl border p-5 shadow-2xs transition-colors cursor-pointer ${
            stats.activeIncidents > 0
              ? 'border-red-300 bg-red-50/40 hover:border-red-400'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Incidents</span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                stats.activeIncidents > 0
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-3xl font-black ${
                stats.activeIncidents > 0 ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {stats.activeIncidents}
            </span>
            <span className="text-xs text-slate-500 font-medium">Sự cố cháy</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {stats.activeIncidents > 0 ? (
              <span className="font-bold text-red-700">Cần xử lý khẩn cấp →</span>
            ) : (
              <span className="text-emerald-700 font-medium">Không có rủi ro</span>
            )}
          </div>
        </div>

      </div>

      {/* Live CCTV Streams Section (Full Width) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Luồng Giám Sát Trọng Điểm (Live CCTV Feeds)</h2>
          </div>
          <button
            onClick={() => navigate('/cameras')}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
          >
            <span>Xem tất cả 24 camera</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {featuredCameras.map((cam) => (
            <div
              key={cam.id}
              onClick={() => navigate(`/cameras`)}
              className="group relative rounded-xl border border-slate-200 bg-white p-3 shadow-2xs hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer"
            >
              <CctvPlayer camera={cam} className="aspect-video min-h-[240px] sm:min-h-[280px] w-full" />
              <div className="mt-3 px-1 pb-0.5 flex items-center justify-between text-xs sm:text-sm">
                <div>
                  <span className="font-bold text-slate-900">{cam.code}:</span>{' '}
                  <span className="text-slate-600 font-medium">{cam.name}</span>
                </div>
                <span
                  className={`font-semibold text-xs px-2.5 py-1 rounded ${
                    cam.status === 'FIRE'
                      ? 'bg-red-100 text-red-700 font-bold animate-pulse'
                      : cam.status === 'OFFLINE'
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {cam.status === 'FIRE' ? '🔥 CHÁY' : cam.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row: Offline alerts & Site map link */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Quick link to Site Map */}
          <div
            onClick={() => navigate('/map')}
            className={`rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex items-center justify-between hover:bg-slate-50/80 transition-colors cursor-pointer ${
              offlineCameras.length === 0 ? 'md:col-span-2' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Sơ Đồ Bố Trí Nhà Máy (Site Map 2D)</h4>
                <p className="text-xs text-slate-500">
                  Xem trực quan vị trí 24 camera và cảnh báo cháy trên mặt bằng sản xuất Hải Phòng
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-900 flex items-center gap-1 shrink-0 ml-3">
              Mở sơ đồ →
            </span>
          </div>

          {/* Quick Offline Alert Card if cameras offline */}
          {offlineCameras.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    Cảnh Báo: {offlineCameras.length} Camera Mất Tín Hiệu
                  </h4>
                  <p className="text-xs text-amber-800/90 mt-0.5">
                    {offlineCameras.map((c) => `${c.code} - ${c.name}`).join(', ')}
                  </p>
                  <button
                    onClick={() => navigate('/cameras?filter=offline')}
                    className="mt-2 text-xs font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer"
                  >
                    Kiểm tra tình trạng camera ngay →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
