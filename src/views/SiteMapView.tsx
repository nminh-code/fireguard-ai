import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Incident } from '../types';
import { cameraService } from '../services/cameraService';
import { incidentService } from '../services/incidentService';
import { realtimeService } from '../services/realtimeService';
import { CameraDetailModal } from './CameraDetailModal';
import factoryMapImg from '../assets/factory_sitemap_3d.png';
import cam08FireImg from '../assets/cam08_fire_thumbnail.png';
import {
  MapPin,
  Flame,
  RotateCw,
  Plus,
  Minus,
  Target,
  ChevronDown,
  Building2,
  Warehouse,
  Factory,
  Building,
  Wrench,
  Car,
  DoorClosed,
  Zap,
} from 'lucide-react';

export const SiteMapView: React.FC = () => {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [activeCameraModal, setActiveCameraModal] = useState<Camera | null>(null);
  const [hoveredCamera, setHoveredCamera] = useState<Camera | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const loadData = async () => {
    const [cams, incs] = await Promise.all([
      cameraService.getCameras(),
      incidentService.getIncidents(),
    ]);
    setCameras(cams);
    const active = incs.find((i) => i.status === 'ACTIVE' || i.status === 'RESPONDING');
    setActiveIncident(active || null);
  };

  useEffect(() => {
    loadData();

    const unsubCam = realtimeService.subscribeToCameraUpdates(() => {
      loadData();
    });

    const unsubInc = realtimeService.subscribeToIncidentEvents(() => {
      loadData();
    });

    const unsubGlobal = realtimeService.subscribeToGlobalState(() => {
      loadData();
    });

    return () => {
      unsubCam();
      unsubInc();
      unsubGlobal();
    };
  }, []);

  const totalCameras = 24;
  const onlineCount = 23;
  const fireCount = 1;
  const offlineCount = 0;

  // Zone pins configuration matching the reference 3D map exactly
  const cameraPins = [
    // Kho nguyên liệu (Fire hazard at CAM-08)
    { code: 'CAM-01', x: 31, y: 25.5, status: 'ONLINE', zone: 'Kho nguyên liệu' },
    { code: 'CAM-02', x: 23.5, y: 35.5, status: 'ONLINE', zone: 'Kho nguyên liệu' },
    { code: 'CAM-07', x: 26.5, y: 43, status: 'ONLINE', zone: 'Kho nguyên liệu' },
    { code: 'CAM-08', x: 30.5, y: 32.5, status: 'FIRE', zone: 'Kho nguyên liệu' },

    // Xưởng sản xuất 1
    { code: 'CAM-03', x: 48, y: 25.5, status: 'ONLINE', zone: 'Xưởng sản xuất 1' },
    { code: 'CAM-04', x: 64, y: 29.5, status: 'ONLINE', zone: 'Xưởng sản xuất 1' },
    { code: 'CAM-09', x: 66, y: 34, status: 'ONLINE', zone: 'Xưởng sản xuất 1' },
    { code: 'CAM-10', x: 53.5, y: 41, status: 'ONLINE', zone: 'Xưởng sản xuất 1' },
    { code: 'CAM-11', x: 63.5, y: 38.5, status: 'ONLINE', zone: 'Xưởng sản xuất 1' },

    // Xưởng sản xuất 2
    { code: 'CAM-05', x: 58.5, y: 52.5, status: 'ONLINE', zone: 'Xưởng sản xuất 2' },
    { code: 'CAM-06', x: 68, y: 59.8, status: 'ONLINE', zone: 'Xưởng sản xuất 2' },
    { code: 'CAM-12', x: 61, y: 65, status: 'ONLINE', zone: 'Xưởng sản xuất 2' },

    // Kho thành phẩm
    { code: 'CAM-15', x: 23, y: 58, status: 'ONLINE', zone: 'Kho thành phẩm' },
    { code: 'CAM-16', x: 32.5, y: 57, status: 'ONLINE', zone: 'Kho thành phẩm' },

    // Văn phòng
    { code: 'CAM-14', x: 44, y: 55.5, status: 'ONLINE', zone: 'Văn phòng' },

    // Khu kỹ thuật
    { code: 'CAM-12', x: 76, y: 47.5, status: 'WARNING', zone: 'Khu kỹ thuật' },

    // Bãi xe
    { code: 'CAM-13', x: 33.5, y: 80.5, status: 'ONLINE', zone: 'Bãi xe' },

    // Cổng chính
    { code: 'CAM-17', x: 51.5, y: 82.5, status: 'ONLINE', zone: 'Cổng chính' },

    // Trạm điện
    { code: 'CAM-18', x: 75.5, y: 75.5, status: 'WARNING', zone: 'Trạm điện' },
  ];

  // Zone text labels on the map
  const zoneLabels = [
    { title: 'Kho nguyên liệu', x: 27, y: 28.5 },
    { title: 'Xưởng sản xuất 1', x: 55, y: 29.5 },
    { title: 'Kho thành phẩm', x: 28, y: 54.5 },
    { title: 'Văn phòng', x: 44, y: 52.5 },
    { title: 'Xưởng sản xuất 2', x: 62, y: 55.5 },
    { title: 'Khu kỹ thuật', x: 74, y: 44.5 },
    { title: 'Bãi xe', x: 31, y: 73.5 },
    { title: 'Cổng chính', x: 51.5, y: 79.5 },
    { title: 'Trạm điện', x: 75.5, y: 72 },
  ];

  const zoneList = [
    { name: 'Kho nguyên liệu', cameras: 4, icon: Warehouse },
    { name: 'Xưởng sản xuất 1', cameras: 5, icon: Factory },
    { name: 'Xưởng sản xuất 2', cameras: 4, icon: Factory },
    { name: 'Kho thành phẩm', cameras: 2, icon: Warehouse },
    { name: 'Văn phòng', cameras: 1, icon: Building },
    { name: 'Khu kỹ thuật', cameras: 1, icon: Wrench },
    { name: 'Bãi xe', cameras: 1, icon: Car },
    { name: 'Cổng chính', cameras: 1, icon: DoorClosed },
    { name: 'Trạm điện', cameras: 1, icon: Zap },
  ];

  return (
    <div className="space-y-4" id="sitemap-page">
      {/* Top Header Row matching Reference Image */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left side Title */}
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
            <MapPin className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 leading-tight">
              Sơ Đồ Mặt Bằng Nhà Máy
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Bản đồ giám sát toàn bộ hệ thống CCTV/IP Camera theo từng khu vực.
            </p>
          </div>
        </div>

        {/* Right side Quick Stats + Refresh Button */}
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <div>
                <div className="text-xs font-bold text-slate-900 leading-none">{totalCameras} Cameras</div>
                <div className="text-[10px] text-slate-400">Tổng số camera</div>
              </div>
            </div>

            <div className="h-6 w-[1px] bg-slate-200" />

            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <div>
                <div className="text-xs font-bold text-slate-900 leading-none">{onlineCount} Online</div>
                <div className="text-[10px] text-slate-400">Đang hoạt động</div>
              </div>
            </div>

            <div className="h-6 w-[1px] bg-slate-200" />

            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
              <div>
                <div className="text-xs font-bold text-red-600 leading-none">{fireCount} Fire</div>
                <div className="text-[10px] text-red-400 font-medium">Đang báo cháy</div>
              </div>
            </div>

            <div className="h-6 w-[1px] bg-slate-200" />

            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              <div>
                <div className="text-xs font-bold text-slate-900 leading-none">{offlineCount} Offline</div>
                <div className="text-[10px] text-slate-400">Mất kết nối</div>
              </div>
            </div>
          </div>

          <button
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RotateCw className="h-4 w-4" />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid: Left Map (3/4) & Right Panels (1/4) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Interactive 3D Map Container (3 Columns) */}
        <div className="lg:col-span-3 relative rounded-2xl border border-slate-200 bg-slate-900 shadow-md overflow-hidden min-h-[560px] flex flex-col justify-between">
          {/* Background 3D Render Image */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img
              src={factoryMapImg}
              alt="Factory 3D Sitemap"
              className="w-full h-full object-cover transition-transform duration-300"
              style={{ transform: `scale(${zoomLevel})` }}
            />
            {/* Subtle Overlay to make pins pop */}
            <div className="absolute inset-0 bg-slate-950/15" />
          </div>

          {/* Top Left Dropdown Filter overlay */}
          <div className="relative z-20 p-4 flex items-center justify-between">
            <button className="flex items-center gap-2 rounded-lg bg-slate-900/80 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-white border border-white/20 shadow-lg hover:bg-slate-900">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Tất cả camera</span>
              <ChevronDown className="h-4 w-4 text-slate-300 ml-1" />
            </button>
          </div>

          {/* Zone Title Text Overlays on Buildings */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            {zoneLabels.map((lbl, idx) => (
              <div
                key={idx}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md bg-slate-900/85 backdrop-blur-xs px-2.5 py-1 text-[11px] font-extrabold text-white border border-white/20 shadow-md whitespace-nowrap"
                style={{ left: `${lbl.x}%`, top: `${lbl.y}%` }}
              >
                {lbl.title}
              </div>
            ))}
          </div>

          {/* Camera Pin Markers matching exact locations */}
          <div className="absolute inset-0 z-20">
            {cameraPins.map((pin, idx) => {
              const isFire = pin.status === 'FIRE';
              const isWarning = pin.status === 'WARNING';

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (isFire && activeIncident) {
                      navigate(`/incidents/${activeIncident.id}`);
                    } else {
                      const foundCam = cameras.find((c) => c.code === pin.code);
                      if (foundCam) setActiveCameraModal(foundCam);
                    }
                  }}
                  onMouseEnter={() => {
                    const foundCam = cameras.find((c) => c.code === pin.code);
                    if (foundCam) setHoveredCamera(foundCam);
                  }}
                  onMouseLeave={() => setHoveredCamera(null)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                >
                  {/* Fire Emergency Pulsing Glow Circle */}
                  {isFire && (
                    <div className="absolute -inset-6 rounded-full bg-red-600/50 animate-ping" />
                  )}

                  {/* Marker Pill Badge */}
                  <div
                    className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-xl border transition-all transform hover:scale-110 ${
                      isFire
                        ? 'bg-red-600 border-white text-white ring-4 ring-red-500/40 animate-pulse'
                        : isWarning
                        ? 'bg-amber-500 border-amber-200 text-slate-950 font-bold'
                        : 'bg-emerald-600 border-emerald-300 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {isFire ? (
                      <Flame className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                    <span>{pin.code}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Controls Bar & 3D Minimap Box */}
          <div className="relative z-20 p-4 flex items-end justify-between">
            {/* 3D Minimap Box Inset (Bottom Left) */}
            <div className="w-36 h-24 rounded-xl border-2 border-white/30 bg-slate-900/90 overflow-hidden shadow-2xl backdrop-blur-sm relative group">
              <img
                src={factoryMapImg}
                alt="Minimap"
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute inset-2 border-2 border-red-500/80 rounded-sm pointer-events-none" />
            </div>

            {/* Map Controls (Bottom Right) */}
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                <button
                  onClick={() => setZoomLevel((prev) => Math.min(prev + 0.2, 1.8))}
                  className="p-2 text-slate-700 hover:bg-slate-100 border-b border-slate-100 cursor-pointer"
                  title="Zoom In"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoomLevel((prev) => Math.max(prev - 0.2, 1))}
                  className="p-2 text-slate-700 hover:bg-slate-100 border-b border-slate-100 cursor-pointer"
                  title="Zoom Out"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="p-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Center View"
                >
                  <Target className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={() => setZoomLevel(1)}
                className="flex items-center gap-1.5 rounded-xl bg-white/95 backdrop-blur-md px-3 py-2 text-xs font-bold text-slate-800 border border-slate-200 shadow-lg hover:bg-white cursor-pointer"
              >
                <Target className="h-3.5 w-3.5 text-slate-600" />
                <span>Fit to factory</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar Panels (1 Column) */}
        <div className="space-y-4">
          {/* Card 1: Emergency Fire Incident Alert Card */}
          <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-white">
                <Flame className="h-4 w-4 fill-white" />
              </div>
              <span>Camera đang báo cháy</span>
            </div>

            {/* Thumbnail Image Preview */}
            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
              <img
                src={cam08FireImg}
                alt="CAM-08 Fire Incident"
                className="w-full h-32 object-cover"
              />
              <div className="absolute top-2 right-2 rounded-md bg-red-600 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide animate-pulse">
                FIRE
              </div>
              <div className="absolute bottom-2 left-2 text-white drop-shadow-md">
                <div className="font-extrabold text-xs">CAM-08</div>
                <div className="text-[11px] text-slate-200">Kho nguyên liệu</div>
              </div>
            </div>

            {/* View Incident Detail Red Button */}
            <button
              onClick={() => {
                if (activeIncident) {
                  navigate(`/incidents/${activeIncident.id}`);
                } else {
                  navigate('/incidents');
                }
              }}
              className="mt-3 w-full rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Xem chi tiết sự cố</span>
              <span>→</span>
            </button>
          </div>

          {/* Card 2: Camera Status Breakdown Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900">Trạng thái camera</h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span>Online</span>
                </div>
                <span className="font-bold text-slate-900">23</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span>Cảnh báo</span>
                </div>
                <span className="font-bold text-slate-900">1</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                  <span>Báo cháy</span>
                </div>
                <span className="font-bold text-slate-900">1</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  <span>Offline</span>
                </div>
                <span className="font-bold text-slate-900">0</span>
              </div>
            </div>
          </div>

          {/* Card 3: Factory Zones List Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900">Các khu vực</h3>

            <div className="space-y-2.5 text-xs max-h-72 overflow-y-auto pr-1">
              {zoneList.map((zn, idx) => {
                const Icon = zn.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-slate-700 hover:text-slate-900 py-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-slate-500" />
                      <span className="font-medium">{zn.name}</span>
                    </div>
                    <span className="text-slate-400 text-[11px] font-mono">{zn.cameras} camera</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Camera Detail Modal when clicking on pin */}
      {activeCameraModal && (
        <CameraDetailModal
          camera={activeCameraModal}
          onClose={() => setActiveCameraModal(null)}
          onReconnect={(cam) => {
            cameraService.setCameraStatus(cam.id, 'ONLINE', 'AI_MONITORING');
            loadData();
          }}
        />
      )}
    </div>
  );
};
