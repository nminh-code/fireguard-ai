import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Site, SiteZone, Camera, Incident } from '../types';
import { siteService } from '../services/siteService';
import { cameraService } from '../services/cameraService';
import { incidentService } from '../services/incidentService';
import { realtimeService } from '../services/realtimeService';
import { CameraDetailModal } from './CameraDetailModal';
import {
  MapPin,
  Flame,
  Radio,
  VideoOff,
  Eye,
  Info,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const SiteMapView: React.FC = () => {
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [selectedZone, setSelectedZone] = useState<SiteZone | null>(null);
  const [activeCameraModal, setActiveCameraModal] = useState<Camera | null>(null);
  const [hoveredCamera, setHoveredCamera] = useState<Camera | null>(null);

  const loadData = async () => {
    const [s, cams, incs] = await Promise.all([
      siteService.getSite(),
      cameraService.getCameras(),
      incidentService.getIncidents(),
    ]);
    setSite(s);
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

  if (!site) return null;

  return (
    <div className="space-y-6" id="site-map-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
              Sơ Đồ Mặt Bằng Nhà Máy (2D Site Plan)
            </h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {site.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Bản đồ định vị 24 camera CCTV/IP và trạng thái báo cháy tức thời theo phân khu nhà máy
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-800 font-semibold text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>ONLINE (Bình thường)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 text-amber-800 font-semibold text-[11px]">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>OFFLINE / CẢNH BÁO</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-50 text-red-800 font-black text-[11px] animate-pulse">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-ping" />
            <span>🔥 SỰ CỐ CHÁY (FIRE)</span>
          </div>
        </div>
      </div>

      {/* Main 2D Floor Canvas Container */}
      <div className="relative rounded-2xl border-2 border-slate-300 bg-slate-100 p-4 sm:p-6 shadow-xs overflow-hidden">
        {/* Floor Blueprint Canvas */}
        <div className="relative w-full aspect-16/10 min-h-[480px] rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
          {/* Blueprint Grid Lines Background */}
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                'linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Plant Compass & Scale */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-3 bg-black/60 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-white/10 text-white text-[11px] font-mono">
            <span>BẮC (NORTH) ↑</span>
            <span className="text-slate-500">|</span>
            <span>TỶ LỆ: 1:500</span>
          </div>

          {/* Zones Layout (6 Areas) */}
          {site.zones.map((zone) => {
            const hasFire = zone.cameraIds.some((cid) => {
              const cam = cameras.find((c) => c.id === cid);
              return cam?.status === 'FIRE';
            });

            return (
              <div
                key={zone.id}
                onClick={() => setSelectedZone(zone)}
                className={`absolute rounded-xl border-2 transition-all cursor-pointer p-3.5 flex flex-col justify-between ${
                  hasFire
                    ? 'border-red-500 bg-red-950/40 hover:bg-red-950/60 shadow-lg ring-2 ring-red-500/40'
                    : 'border-slate-700/80 bg-slate-800/60 hover:bg-slate-800/90 hover:border-slate-500'
                }`}
                style={{
                  left: `${zone.coordinates.x}%`,
                  top: `${zone.coordinates.y}%`,
                  width: `${zone.coordinates.width}%`,
                  height: `${zone.coordinates.height}%`,
                }}
              >
                {/* Zone Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                        {zone.name}
                      </span>
                      {hasFire && (
                        <span className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow animate-pulse">
                          <Flame className="h-3 w-3 fill-yellow-300" />
                          CHÁY
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Mã: {zone.code} • Diện tích: {zone.area}
                    </div>
                  </div>

                  <span className="text-[10px] bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded border border-white/5 font-mono">
                    {zone.cameraIds.length} Cams
                  </span>
                </div>

                {/* Zone bottom info */}
                <div className="text-[10px] text-slate-400 truncate hidden sm:block">
                  {zone.description}
                </div>
              </div>
            );
          })}

          {/* Camera Markers on Map */}
          {cameras.map((cam) => {
            const isFire = cam.status === 'FIRE';
            const isOffline = cam.status === 'OFFLINE';

            return (
              <div
                key={cam.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isFire && activeIncident) {
                    navigate(`/incidents/${activeIncident.id}`);
                  } else {
                    setActiveCameraModal(cam);
                  }
                }}
                onMouseEnter={() => setHoveredCamera(cam)}
                onMouseLeave={() => setHoveredCamera(null)}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125"
                style={{
                  left: `${cam.mapCoords.x}%`,
                  top: `${cam.mapCoords.y}%`,
                }}
                id={`marker-${cam.code.toLowerCase()}`}
              >
                {/* Pulsing ring for Fire */}
                {isFire && (
                  <div className="absolute -inset-2.5 rounded-full bg-red-500/50 animate-ping" />
                )}

                {/* Marker Button */}
                <div
                  className={`flex items-center gap-1 rounded-full px-2 py-1 shadow-lg text-[10px] font-bold border-2 transition-all ${
                    isFire
                      ? 'bg-red-600 border-yellow-300 text-white animate-bounce'
                      : isOffline
                      ? 'bg-amber-600 border-amber-300 text-white'
                      : 'bg-emerald-600 border-emerald-300 text-white hover:bg-emerald-500'
                  }`}
                >
                  {isFire ? (
                    <Flame className="h-3 w-3 fill-yellow-300 text-yellow-300" />
                  ) : isOffline ? (
                    <VideoOff className="h-3 w-3" />
                  ) : (
                    <Radio className="h-3 w-3" />
                  )}
                  <span>{cam.code}</span>
                </div>
              </div>
            );
          })}

          {/* Hover Popover preview */}
          {hoveredCamera && (
            <div
              className="absolute z-30 pointer-events-none rounded-xl bg-slate-950/95 border border-slate-700 text-white p-3 shadow-2xl w-60 -translate-x-1/2 text-left"
              style={{
                left: `${hoveredCamera.mapCoords.x}%`,
                top: `${hoveredCamera.mapCoords.y - 12}%`,
              }}
            >
              <div className="flex items-center justify-between text-xs font-bold border-b border-slate-800 pb-1.5 mb-1.5">
                <span className="font-mono">{hoveredCamera.code}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    hoveredCamera.status === 'FIRE'
                      ? 'bg-red-600 text-white'
                      : hoveredCamera.status === 'OFFLINE'
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {hoveredCamera.status}
                </span>
              </div>
              <div className="text-xs font-semibold">{hoveredCamera.name}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{hoveredCamera.location}</div>
              <div className="mt-2 text-[10px] text-slate-400 flex justify-between border-t border-slate-800/80 pt-1.5">
                <span>AI: {hoveredCamera.aiStatus}</span>
                <span className="font-mono">{hoveredCamera.ipAddress}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zone Detail Drawer / Card if selected */}
      {selectedZone && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">{selectedZone.name}</h3>
              <p className="text-xs text-slate-500">
                Mã khu: {selectedZone.code} • Diện tích: {selectedZone.area} • {selectedZone.description}
              </p>
            </div>
            <button
              onClick={() => setSelectedZone(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {selectedZone.cameraIds.map((cid) => {
              const cam = cameras.find((c) => c.id === cid);
              if (!cam) return null;
              return (
                <div
                  key={cam.id}
                  onClick={() => setActiveCameraModal(cam)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer hover:shadow-xs transition-all ${
                    cam.status === 'FIRE'
                      ? 'bg-red-50 border-red-300'
                      : cam.status === 'OFFLINE'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{cam.code}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        cam.status === 'FIRE' ? 'bg-red-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      {cam.status}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800 mt-1 truncate">{cam.name}</div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">{cam.ipAddress}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal View for Camera */}
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
