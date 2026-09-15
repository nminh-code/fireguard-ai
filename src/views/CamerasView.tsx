import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, CameraStatus } from '../types';
import { cameraService } from '../services/cameraService';
import { realtimeService } from '../services/realtimeService';
import { CctvPlayer } from '../components/CctvPlayer';
import { CameraDetailModal } from './CameraDetailModal';
import {
  Cctv,
  Search,
  Filter,
  Flame,
  Radio,
  VideoOff,
  Eye,
  CheckCircle2,
  Grid,
  List,
  Columns2,
  LayoutGrid,
} from 'lucide-react';

export const CamerasView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | CameraStatus>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [gridSize, setGridSize] = useState<'large' | 'compact'>('large');
  const [activeCameraModal, setActiveCameraModal] = useState<Camera | null>(null);

  useEffect(() => {
    // If filter in query param (e.g. ?filter=offline)
    const paramFilter = searchParams.get('filter');
    if (paramFilter === 'offline') {
      setSelectedStatus('OFFLINE');
    }
  }, [searchParams]);

  const loadCameras = async () => {
    const list = await cameraService.getCameras();
    setCameras(list);
    setLoading(false);
  };

  useEffect(() => {
    loadCameras();

    const unsubCamera = realtimeService.subscribeToCameraUpdates(() => {
      loadCameras();
    });

    const unsubGlobal = realtimeService.subscribeToGlobalState(() => {
      loadCameras();
    });

    return () => {
      unsubCamera();
      unsubGlobal();
    };
  }, []);

  // Filtered cameras list
  const filteredCameras = cameras.filter((cam) => {
    const matchesSearch =
      cam.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cam.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesZone = selectedZone === 'ALL' || cam.zoneId === selectedZone;
    const matchesStatus = selectedStatus === 'ALL' || cam.status === selectedStatus;

    return matchesSearch && matchesZone && matchesStatus;
  });

  const zones = [
    { id: 'ALL', name: 'Tất cả khu vực' },
    { id: 'zone-kho-a', name: 'Kho nguyên liệu A' },
    { id: 'zone-xuong-1', name: 'Xưởng sản xuất 1' },
    { id: 'zone-xuong-2', name: 'Xưởng sản xuất 2' },
    { id: 'zone-kho-b', name: 'Kho thành phẩm B' },
    { id: 'zone-vp', name: 'Văn phòng' },
    { id: 'zone-cong', name: 'Cổng & Trạm bảo vệ' },
  ];

  return (
    <div className="space-y-6" id="cameras-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
              Hệ Thống Live Cameras CCTV/IP
            </h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {cameras.length} camera
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tích hợp toàn bộ luồng RTSP của doanh nghiệp vào AI FireGuard để nhận diện khói & lửa tự động
          </p>
        </div>

        {/* View & Density toggles */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {viewMode === 'grid' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setGridSize('large')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  gridSize === 'large'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Lưới lớn (2 cột to rõ)"
              >
                <Columns2 className="h-4 w-4" />
                <span>2 Cột (To rõ)</span>
              </button>
              <button
                onClick={() => setGridSize('compact')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  gridSize === 'compact'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Lưới gọn (4 cột)"
              >
                <LayoutGrid className="h-4 w-4" />
                <span>4 Cột</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Dạng lưới thẻ"
            >
              <Grid className="h-4 w-4" />
              <span className="hidden sm:inline">Lưới</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Dạng danh sách bảng"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Bảng</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã camera (CAM-08), tên camera, vị trí..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden"
            />
          </div>

          {/* Zone filter select */}
          <div className="flex items-center gap-2">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-slate-800 focus:outline-hidden"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>

            {/* Status pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(['ALL', 'ONLINE', 'OFFLINE', 'FIRE'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    selectedStatus === st
                      ? st === 'FIRE'
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL'
                    ? 'Tất cả'
                    : st === 'FIRE'
                    ? '🔥 Cháy'
                    : st === 'ONLINE'
                    ? 'Online'
                    : 'Offline'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading & Empty states */}
      {loading ? (
        <div
          className={
            gridSize === 'large'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-5 animate-pulse'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse'
          }
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={`rounded-xl bg-slate-200 ${
                gridSize === 'large' ? 'h-80' : 'h-64'
              }`}
            />
          ))}
        </div>
      ) : filteredCameras.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Cctv className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-800">Không tìm thấy camera phù hợp</h3>
          <p className="mt-1 text-xs text-slate-500">
            Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc trạng thái
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedZone('ALL');
              setSelectedStatus('ALL');
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-3.5 py-1.5 text-xs font-semibold"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div
          className={
            gridSize === 'large'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-5'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          }
        >
          {filteredCameras.map((camera) => (
            <div
              key={camera.id}
              onClick={() => setActiveCameraModal(camera)}
              className={`group flex flex-col justify-between rounded-xl border bg-white ${
                gridSize === 'large' ? 'p-3.5' : 'p-3'
              } shadow-2xs hover:shadow-md transition-all cursor-pointer ${
                camera.status === 'FIRE'
                  ? 'border-2 border-red-500 ring-2 ring-red-500/20'
                  : camera.status === 'OFFLINE'
                  ? 'border-slate-300 opacity-90'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              {/* CCTV Feed Preview */}
              <div>
                <CctvPlayer
                  camera={camera}
                  className={`aspect-video w-full rounded-lg ${
                    gridSize === 'large' ? 'min-h-[250px] sm:min-h-[290px]' : ''
                  }`}
                />

                {/* Card Info */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                      {camera.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        camera.status === 'FIRE'
                          ? 'bg-red-100 text-red-700 animate-pulse'
                          : camera.status === 'OFFLINE'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {camera.status === 'FIRE' ? '🔥 CHÁY' : camera.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm sm:text-base text-slate-900 line-clamp-1 group-hover:text-red-700 transition-colors">
                    {camera.name}
                  </h3>

                  <div className="text-xs sm:text-sm text-slate-500 flex items-center justify-between pt-1">
                    <span className="truncate max-w-[220px]">📍 {camera.location}</span>
                    <span className="text-[11px] sm:text-xs font-mono text-slate-400 shrink-0">
                      {camera.lastUpdate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom AI Status bar */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-slate-600 font-medium">
                  <Eye className="h-3 w-3 text-slate-400" />
                  <span>
                    {camera.aiStatus === 'FIRE_DETECTED'
                      ? 'Lửa xác nhận'
                      : camera.aiStatus === 'AI_MONITORING'
                      ? 'AI Giám Sát'
                      : 'Ngoại tuyến'}
                  </span>
                </span>
                <span className="text-slate-400 font-mono text-[10px]">{camera.ipAddress}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table List View */
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Camera ID</th>
                  <th className="px-4 py-3">Tên Camera</th>
                  <th className="px-4 py-3">Khu Vực</th>
                  <th className="px-4 py-3">Địa Chỉ IP</th>
                  <th className="px-4 py-3">Trạng Thái</th>
                  <th className="px-4 py-3">AI Monitoring</th>
                  <th className="px-4 py-3">Cập Nhật</th>
                  <th className="px-4 py-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCameras.map((camera) => (
                  <tr
                    key={camera.id}
                    onClick={() => setActiveCameraModal(camera)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{camera.code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{camera.name}</td>
                    <td className="px-4 py-3">{camera.location}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{camera.ipAddress}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          camera.status === 'FIRE'
                            ? 'bg-red-100 text-red-700 animate-pulse'
                            : camera.status === 'OFFLINE'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            camera.status === 'FIRE'
                              ? 'bg-red-600'
                              : camera.status === 'OFFLINE'
                              ? 'bg-slate-400'
                              : 'bg-emerald-500'
                          }`}
                        />
                        {camera.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{camera.aiStatus}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{camera.lastUpdate}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-semibold text-red-700 hover:underline">
                        Chi tiết →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Camera Detail Modal */}
      {activeCameraModal && (
        <CameraDetailModal
          camera={activeCameraModal}
          onClose={() => setActiveCameraModal(null)}
          onReconnect={(cam) => {
            cameraService.setCameraStatus(cam.id, 'ONLINE', 'AI_MONITORING');
            loadCameras();
          }}
        />
      )}
    </div>
  );
};
