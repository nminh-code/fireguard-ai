import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole, CameraConnectionConfig, CameraBrand, CameraProtocol } from '../types';
import { authService } from '../services/authService';
import { cameraConnectionService } from '../services/cameraConnectionService';
import { cameraSessionStore } from '../services/cameraSessionStore';
import { realtimeService } from '../services/realtimeService';
import {
  Users,
  Cctv,
  Building2,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Search,
  Video,
  Activity,
  Flame,
  HardHat,
  Radio,
  ExternalLink,
  Sliders,
  X,
} from 'lucide-react';

export const ManagementView: React.FC = () => {
  const navigate = useNavigate();
  const cameraSession = useSyncExternalStore(
    cameraSessionStore.subscribe,
    cameraSessionStore.getSnapshot
  );

  const [currentUser, setCurrentUser] = useState<User>(authService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'cameras' | 'modules' | 'users' | 'roles'>('cameras');
  const [users, setUsers] = useState<User[]>([]);
  const [savedCameras, setSavedCameras] = useState<CameraConnectionConfig[]>([]);

  // Modal form for adding/editing real camera config
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [cameraForm, setCameraForm] = useState<CameraConnectionConfig>({
    id: '',
    name: '',
    brand: 'Hikvision',
    model: '',
    ip: '',
    port: 554,
    protocol: 'RTSP',
    username: '',
    password: '',
    streamUrl: '',
  });

  const loadData = async () => {
    const u = await authService.getUsers();
    setUsers(u);
    setSavedCameras(cameraConnectionService.getSavedCameras());
  };

  useEffect(() => {
    loadData();

    const unsubAuth = realtimeService.subscribeToAuthEvents((user) => {
      setCurrentUser(user);
    });

    const unsubGlobal = realtimeService.subscribeToGlobalState(() => {
      loadData();
    });

    return () => {
      unsubAuth();
      unsubGlobal();
    };
  }, []);

  const isAdmin = currentUser.role === 'ADMIN';

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cameraForm.name || !cameraForm.ip) {
      alert('Vui lòng nhập Tên Camera và Địa chỉ IP.');
      return;
    }

    const assignedId =
      cameraForm.id.trim() || `cam-${Date.now().toString().slice(-6)}`;

    const configToSave: CameraConnectionConfig = {
      ...cameraForm,
      id: assignedId,
    };

    await cameraConnectionService.saveCamera(configToSave);
    setSavedCameras(cameraConnectionService.getSavedCameras());
    setShowAddCameraModal(false);
    setCameraForm({
      id: '',
      name: '',
      brand: 'Hikvision',
      model: '',
      ip: '',
      port: 554,
      protocol: 'RTSP',
      username: '',
      password: '',
      streamUrl: '',
    });
  };

  const handleDeleteCamera = (id: string, name: string) => {
    if (confirm(`Bạn có chắc muốn xóa camera "${name}" khỏi danh sách quản lý?`)) {
      cameraConnectionService.deleteCamera(id);
      setSavedCameras(cameraConnectionService.getSavedCameras());
    }
  };

  return (
    <div className="space-y-6 pb-12" id="management-view">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
              Quản Trị Vận Hành
            </h1>
            <span className="rounded-full bg-slate-900 text-white px-2.5 py-0.5 text-xs font-bold uppercase font-mono">
              Admin Console
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý danh bạ camera CCTV/RTSP thật, cấu hình 2 AI Modules (Fire & PPE) và phân quyền nhân sự
          </p>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-800 text-xs">
            <Lock className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Bạn đang đăng nhập quyền <strong className="uppercase">{currentUser.role}</strong>. Một số tính năng cấu hình nâng cao yêu cầu quyền <strong>ADMIN</strong>.
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('cameras')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'cameras'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
        >
          <Video className="h-3.5 w-3.5" />
          <span>Danh Sách Camera Thật ({savedCameras.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('modules')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'modules'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Cấu Hình 2 AI Modules</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'users'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Nhân Sự & Phân Quyền ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'roles'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Ma Trận Quyền Hạn (RBAC)</span>
        </button>
      </div>

      {/* TAB 1: REAL CAMERAS MANAGEMENT */}
      {activeTab === 'cameras' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                Camera CCTV/IP Thực Tế Đã Đăng Ký ({savedCameras.length})
              </h2>
              <p className="text-xs text-slate-500">
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/camera-test')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
              >
                <Video className="h-3.5 w-3.5 text-red-600" />
                <span>Kiểm tra kết nối (Camera Test)</span>
              </button>

              <button
                onClick={() => setShowAddCameraModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm Cấu Hình Camera</span>
              </button>
            </div>
          </div>

          {savedCameras.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <Video className="h-10 w-10 text-slate-400 mx-auto" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">Chưa có camera nào được lưu</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Hãy thêm camera mới hoặc kiểm tra kết nối camera trong Camera Test để nạp vào hệ thống.
              </p>
              <button
                onClick={() => navigate('/camera-test')}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 text-white px-4 py-2 text-xs font-bold shadow-xs hover:bg-red-700"
              >
                <span>MỞ CAMERA TEST</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Tên Camera</th>
                      <th className="px-4 py-3">Thương Hiệu / Model</th>
                      <th className="px-4 py-3">Địa Chỉ IP / Port</th>
                      <th className="px-4 py-3">Giao Thức</th>
                      <th className="px-4 py-3">Luồng RTSP</th>
                      <th className="px-4 py-3">Trạng Thái Live</th>
                      <th className="px-4 py-3 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {savedCameras.map((cam) => {
                      const isLive = cameraSession.activeStream?.cameraId === cam.id;
                      return (
                        <tr key={cam.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            <div>{cam.name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-800">{cam.brand}</span>
                            {cam.model && <span className="text-slate-500 block text-[11px]">{cam.model}</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {cam.ip}:{cam.port || 554}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {cam.protocol || 'RTSP'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500 truncate max-w-xs">
                            {cam.streamUrl || `rtsp://${cam.ip}:${cam.port || 554}/live`}
                          </td>
                          <td className="px-4 py-3">
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                ● LIVE
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-medium">
                                CONFIGURED
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  cameraSessionStore.replaceDraft(cam);
                                  navigate('/camera-test');
                                }}
                                className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Kiểm tra kết nối camera này"
                              >
                                <Video className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCamera(cam.id, cam.name)}
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Xóa camera"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI MODULES MANAGEMENT (Strictly 2 modules: Fire & PPE) */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              Quản Trị Các Module AI Vision (2 Modules Chuẩn)
            </h2>
            <p className="text-xs text-slate-500">
              Kiểm soát trạng thái phân tích, ngưỡng độ tin cậy và mô hình AI cho camera thật
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Module 1: Fire Detection */}
            <div className="rounded-xl border-2 border-red-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                    <Flame className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">🔥 FIRE DETECTION</h3>
                    <span className="text-[11px] text-slate-500">Phát hiện đám cháy & khói bốc cao</span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  RUNNING (FastAPI :8790)
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Mô hình AI:</span>
                  <span className="font-mono font-bold text-slate-900">YOLOv8-FireGuard v3</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Ngưỡng tin cậy phát hiện lửa:</span>
                  <span className="font-bold text-red-700">85% (Confidence &ge; 0.85)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Ngưỡng tin cậy phát hiện khói:</span>
                  <span className="font-bold text-amber-700">80% (Confidence &ge; 0.80)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Cơ chế xác thực:</span>
                  <span className="text-slate-800">Cửa sổ trượt 3 khung hình liên tiếp</span>
                </div>
              </div>
            </div>

            {/* Module 2: PPE Detection */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <HardHat className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">🦺 PPE DETECTION</h3>
                    <span className="text-[11px] text-slate-500">Giám sát mũ bảo hiểm & áo bảo hộ</span>
                  </div>
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  STANDBY
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Mô hình AI:</span>
                  <span className="font-mono font-bold text-slate-900">YOLOv8-PPE Industrial</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Phát hiện Mũ bảo hộ:</span>
                  <span className="font-bold text-slate-800">Kích hoạt</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Phát hiện Áo phản quang:</span>
                  <span className="font-bold text-slate-800">Kích hoạt</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Trạng thái triển khai:</span>
                  <span className="text-slate-500">Sẵn sàng kích hoạt</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              Danh Sách Nhân Sự Vận Hành Hệ Thống ({users.length})
            </h2>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Họ và Tên</th>
                    <th className="px-4 py-3">Email Liên Hệ</th>
                    <th className="px-4 py-3">Số Điện Thoại</th>
                    <th className="px-4 py-3">Vai Trò Hệ Thống</th>
                    <th className="px-4 py-3">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{u.name}</td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3 font-mono">{u.phone || '0912 345 678'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${u.role === 'ADMIN'
                            ? 'bg-slate-900 text-white'
                            : u.role === 'MANAGER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                            }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ROLES (RBAC) */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              Ma Trận Phân Quyền Vận Hành (Role-Based Access Control)
            </h2>
            <p className="text-xs text-slate-500">
              Quy định quyền hạn xem video, xử lý sự cố và cấu hình camera giữa các cấp bậc
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Tính Năng / Hành Động</th>
                    <th className="px-4 py-3 text-center">ADMIN</th>
                    <th className="px-4 py-3 text-center">MANAGER</th>
                    <th className="px-4 py-3 text-center">SECURITY (Bảo Vệ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { action: 'Xem Màn hình giám sát (Live Monitoring & Overview)', admin: true, manager: true, sec: true },
                    { action: 'Xem Chi tiết Camera & Bằng chứng AI (Evidence Lightbox)', admin: true, manager: true, sec: true },
                    { action: 'Tiếp nhận sự cố & Đánh dấu xử lý sự cố (Incidents)', admin: true, manager: true, sec: true },
                    { action: 'Kiểm tra & Kết nối Camera mới (Camera Test)', admin: true, manager: true, sec: false },
                    { action: 'Thêm / Xóa / Chỉnh sửa cấu hình Camera CCTV', admin: true, manager: false, sec: false },
                    { action: 'Cấu hình tham số AI & Ngưỡng báo cháy', admin: true, manager: false, sec: false },
                    { action: 'Quản lý tài khoản người dùng & Đổi vai trò', admin: true, manager: false, sec: false },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.action}</td>
                      <td className="px-4 py-3 text-center">
                        {row.admin ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.manager ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" /> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.sec ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" /> : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm Cấu Hình Camera Mới */}
      {showAddCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-red-600" />
                <h3 className="font-bold text-base text-slate-900">Thêm Cấu Hình Camera CCTV/IP</h3>
              </div>
              <button
                onClick={() => setShowAddCameraModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCamera} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên Camera (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Camera Xưởng Đúc 01"
                  value={cameraForm.name}
                  onChange={(e) => setCameraForm({ ...cameraForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thương hiệu</label>
                  <select
                    value={cameraForm.brand}
                    onChange={(e) => setCameraForm({ ...cameraForm, brand: e.target.value as CameraBrand })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Hikvision">Hikvision</option>
                    <option value="Dahua">Dahua</option>
                    <option value="Ezviz">Ezviz</option>
                    <option value="Imou">Imou</option>
                    <option value="Other">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giao thức</label>
                  <select
                    value={cameraForm.protocol}
                    onChange={(e) => setCameraForm({ ...cameraForm, protocol: e.target.value as CameraProtocol })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="RTSP">RTSP</option>
                    <option value="ONVIF">ONVIF</option>
                    <option value="HTTP">HTTP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Địa chỉ IP (*)</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.100"
                    value={cameraForm.ip}
                    onChange={(e) => setCameraForm({ ...cameraForm, ip: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Port</label>
                  <input
                    type="number"
                    placeholder="554"
                    value={cameraForm.port}
                    onChange={(e) => setCameraForm({ ...cameraForm, port: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Đường dẫn RTSP Stream (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder="rtsp://192.168.1.100:554/h264/ch1/main"
                  value={cameraForm.streamUrl}
                  onChange={(e) => setCameraForm({ ...cameraForm, streamUrl: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCameraModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 cursor-pointer"
                >
                  Lưu Cấu Hình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
