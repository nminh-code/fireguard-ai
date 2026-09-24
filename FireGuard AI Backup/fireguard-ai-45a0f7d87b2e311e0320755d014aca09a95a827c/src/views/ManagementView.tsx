import React, { useState, useEffect } from 'react';
import { User, Camera, Site, UserRole } from '../types';
import { authService } from '../services/authService';
import { cameraService } from '../services/cameraService';
import { siteService } from '../services/siteService';
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
} from 'lucide-react';

export const ManagementView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(authService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<'users' | 'cameras' | 'site' | 'roles'>('cameras');
  const [users, setUsers] = useState<User[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [site, setSite] = useState<Site | null>(null);

  // Modals / forms
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newCameraCode, setNewCameraCode] = useState('');
  const [newCameraName, setNewCameraName] = useState('');
  const [newCameraIp, setNewCameraIp] = useState('');
  const [newCameraRtsp, setNewCameraRtsp] = useState('');
  const [newCameraZone, setNewCameraZone] = useState('zone-kho-a');

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('SECURITY');

  const loadData = async () => {
    const [u, c, s] = await Promise.all([
      authService.getUsers(),
      cameraService.getCameras(),
      siteService.getSite(),
    ]);
    setUsers(u);
    setCameras(c);
    setSite(s);
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

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCameraCode || !newCameraName) return;

    await cameraService.addCamera({
      code: newCameraCode.toUpperCase(),
      name: newCameraName,
      location:
        newCameraZone === 'zone-kho-a'
          ? 'Kho nguyên liệu A'
          : newCameraZone === 'zone-xuong-1'
          ? 'Xưởng sản xuất 1'
          : 'Khu vực sản xuất',
      zoneId: newCameraZone,
      streamUrl: newCameraRtsp || `rtsp://192.168.1.100:554/live/${newCameraCode.toLowerCase()}`,
      ipAddress: newCameraIp || '192.168.1.100',
      status: 'ONLINE',
      aiStatus: 'AI_MONITORING',
      lastUpdate: 'Vừa xong',
      lastSeen: 'Hiện tại',
      model: 'Hikvision DS-2CD2T87G2-L (8MP)',
      resolution: '4K @ 30fps',
      fps: 25,
      uptime: '100%',
      mapCoords: { x: 50, y: 50 },
    });

    setNewCameraCode('');
    setNewCameraName('');
    setNewCameraIp('');
    setNewCameraRtsp('');
    setShowAddCamera(false);
    loadData();
  };

  const handleDeleteCamera = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa camera này khỏi luồng giám sát AI?')) {
      await cameraService.deleteCamera(id);
      loadData();
    }
  };

  return (
    <div className="space-y-6" id="management-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
              Quản Trị Hệ Thống (Management)
            </h1>
            <span className="rounded-full bg-slate-900 text-white px-2.5 py-0.5 text-xs font-bold uppercase">
              Admin Control
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý tài khoản cán bộ, danh bạ camera CCTV doanh nghiệp và sơ đồ cơ sở sản xuất
          </p>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-800 text-xs">
            <Lock className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Bạn đang đăng nhập quyền <strong className="uppercase">{currentUser.role}</strong>. Một
              số quyền chỉnh sửa nâng cao chỉ dành cho <strong>ADMIN</strong>.
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('cameras')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'cameras'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Cctv className="h-3.5 w-3.5" />
          <span>Camera CCTV/IP ({cameras.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Nhân Sự & Phân Quyền ({users.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('site')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'site'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>Thông Tin Nhà Máy</span>
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'roles'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Ma Trận Quyền Hạn (RBAC)</span>
        </button>
      </div>

      {/* Tab: CAMERAS */}
      {activeTab === 'cameras' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Danh Sách Camera Tích Hợp Vào AI Vision
            </h3>
            <button
              onClick={() => setShowAddCamera(true)}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm Camera Mới</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Mã Camera</th>
                    <th className="px-4 py-3">Tên Thiết Bị</th>
                    <th className="px-4 py-3">Vị Trí Hiện Trường</th>
                    <th className="px-4 py-3">Địa Chỉ IP</th>
                    <th className="px-4 py-3">RTSP Stream</th>
                    <th className="px-4 py-3">Trạng Thái</th>
                    <th className="px-4 py-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cameras.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{c.code}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                      <td className="px-4 py-3">{c.location}</td>
                      <td className="px-4 py-3 font-mono">{c.ipAddress}</td>
                      <td className="px-4 py-3 font-mono text-slate-400 truncate max-w-xs">
                        {c.streamUrl}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === 'FIRE'
                              ? 'bg-red-100 text-red-700'
                              : c.status === 'ONLINE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteCamera(c.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Xóa camera"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Danh Sách Cán Bộ Trực Và Quản Lý</h3>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Họ và Tên</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Vai Trò (Role)</th>
                    <th className="px-4 py-3">Số Điện Thoại</th>
                    <th className="px-4 py-3">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span>{u.name}</span>
                      </td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'MANAGER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{u.phone || '0988 123 456'}</td>
                      <td className="px-4 py-3 text-emerald-600 font-semibold">● {u.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: SITE */}
      {activeTab === 'site' && site && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Thông Tin Cơ Sở Sản Xuất
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block mb-1">Tên cơ sở:</span>
              <span className="font-bold text-slate-900">{site.name}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Địa chỉ:</span>
              <span className="font-medium text-slate-800">{site.address}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Số lượng phân khu (Zones):</span>
              <span className="font-bold text-slate-900">{site.zones.length} khu</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Tổng số camera đã cấu hình:</span>
              <span className="font-bold text-slate-900">{site.totalCameras} camera</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: ROLES (RBAC Matrix) */}
      {activeTab === 'roles' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Ma Trận Phân Quyền Truy Cập (Role-Based Access Control)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Tính Năng / Hành Động</th>
                  <th className="px-4 py-3 text-center">ADMIN</th>
                  <th className="px-4 py-3 text-center">MANAGER</th>
                  <th className="px-4 py-3 text-center">SECURITY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">Xem Dashboard & Live Cameras</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    Nhận Cảnh Báo Cháy & Xem Incident Detail
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    Thao Tác Bắt Đầu Xử Lý (START RESPONSE)
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    Đánh Dấu Giải Quyết Sự Cố (MARK RESOLVED)
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">Thêm / Xóa Camera CCTV RTSP</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-slate-300">✗ Không</td>
                  <td className="px-4 py-3 text-center text-slate-300">✗ Không</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-900">Thay Đổi Ngưỡng AI Detection</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">✓ Có</td>
                  <td className="px-4 py-3 text-center text-slate-300">✗ Không</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Add Camera */}
      {showAddCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Thêm Camera CCTV Vào Favis AI</h3>

            <form onSubmit={handleAddCamera} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mã camera (ID):</label>
                <input
                  type="text"
                  required
                  value={newCameraCode}
                  onChange={(e) => setNewCameraCode(e.target.value)}
                  placeholder="Ví dụ: CAM-25"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tên camera:</label>
                <input
                  type="text"
                  required
                  value={newCameraName}
                  onChange={(e) => setNewCameraName(e.target.value)}
                  placeholder="Ví dụ: Camera Cổng Phụ 02"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Phân khu (Zone):</label>
                <select
                  value={newCameraZone}
                  onChange={(e) => setNewCameraZone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-800 focus:outline-hidden"
                >
                  <option value="zone-kho-a">Kho nguyên liệu A</option>
                  <option value="zone-xuong-1">Xưởng sản xuất 1</option>
                  <option value="zone-xuong-2">Xưởng sản xuất 2</option>
                  <option value="zone-kho-b">Kho thành phẩm B</option>
                  <option value="zone-vp">Văn phòng</option>
                  <option value="zone-cong">Cổng & Trạm bảo vệ</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Địa chỉ IP:</label>
                <input
                  type="text"
                  value={newCameraIp}
                  onChange={(e) => setNewCameraIp(e.target.value)}
                  placeholder="192.168.1.125"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Luồng RTSP Stream:</label>
                <input
                  type="text"
                  value={newCameraRtsp}
                  onChange={(e) => setNewCameraRtsp(e.target.value)}
                  placeholder="rtsp://admin:pass@192.168.1.125:554/Streaming/Channels/101"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-800 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCamera(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs cursor-pointer"
                >
                  Thêm & Kích hoạt AI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
