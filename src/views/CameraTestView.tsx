import React, { useState, useEffect } from 'react';
import {
  CameraConnectionConfig,
  CameraConnectionResult,
  CameraConnectionStatus,
  CameraBrand,
  CameraProtocol,
} from '../types';
import { cameraConnectionService } from '../services/cameraConnectionService';
import { cameraSessionStore } from '../services/cameraSessionStore';
import {
  Video,
  Radio,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  AlertTriangle,
  Trash2,
  Layers,
} from 'lucide-react';

export const CameraTestView: React.FC = () => {
  const initialCameraState = cameraSessionStore.getSnapshot();

  // Form State - Empty / Unhardcoded
  const [formData, setFormData] = useState<CameraConnectionConfig>(
    initialCameraState.formData
  );

  const [showPassword, setShowPassword] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<CameraConnectionStatus>(initialCameraState.connectionStatus);
  const [connectionResult, setConnectionResult] =
    useState<CameraConnectionResult | null>(
      initialCameraState.connectionResult
    );
  const [isTesting, setIsTesting] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [savedCameras, setSavedCameras] = useState<CameraConnectionConfig[]>([]);

  // Load saved configurations on mount
  useEffect(() => {
    refreshSavedCameras();
  }, []);

  const refreshSavedCameras = () => {
    const list = cameraConnectionService.getSavedCameras();
    setSavedCameras(list);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const nextFormData: CameraConnectionConfig = {
      ...formData,
      [name]:
        name === 'port' ? (value === '' ? '' : Number(value) || value) : value,
    };
    setFormData(nextFormData);
    cameraSessionStore.updateDraft(nextFormData);
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ip || !formData.name) {
      alert('Vui lòng nhập Tên Camera và Địa chỉ IP.');
      return;
    }

    const assignedId =
      formData.id.trim() ||
      `CAM-${Math.floor(100 + Math.random() * 900)}`;

    const configToTest: CameraConnectionConfig = {
      ...formData,
      id: assignedId,
    };

    setFormData(configToTest);
    setIsTesting(true);
    setConnectionStatus('CONNECTING');
    setConnectionResult(null);
    cameraSessionStore.setConnecting(configToTest);
    setSaveSuccessMsg(null);

    try {
      // Calls camera service abstraction
      const result = await cameraConnectionService.testConnection(configToTest);
      setConnectionResult(result);
      setConnectionStatus(result.status);
      cameraSessionStore.setConnectionResult(configToTest, result);
    } catch {
      setConnectionStatus('FAILED');
      const failedResult: CameraConnectionResult = {
        cameraId: assignedId,
        status: 'FAILED',
        streamStatus: 'UNAVAILABLE',
        apiStatus: 'UNAVAILABLE',
        lastChecked: new Date().toLocaleString(),
        errorMessage: 'Không kết nối được video bridge.',
      };
      setConnectionResult(failedResult);
      cameraSessionStore.setConnectionResult(configToTest, failedResult);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCamera = async () => {
    if (!formData.name || !formData.ip) {
      alert('Vui lòng nhập Tên Camera và Địa chỉ IP để lưu cấu hình.');
      return;
    }

    const assignedId =
      formData.id.trim() ||
      `CAM-${Math.floor(100 + Math.random() * 900)}`;

    const configToSave: CameraConnectionConfig = {
      ...formData,
      id: assignedId,
    };

    await cameraConnectionService.saveCamera(configToSave);
    refreshSavedCameras();
    setFormData(configToSave);
    cameraSessionStore.updateDraft(configToSave);
    setSaveSuccessMsg(`Đã lưu cấu hình ${configToSave.name} thành công.`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const handleLoadCamera = (camera: CameraConnectionConfig) => {
    const { model: _model, apiUrl: _apiUrl, ...visibleCameraConfig } = camera;
    const nextFormData: CameraConnectionConfig = {
      ...visibleCameraConfig,
      password: '', // Keep password blank when loading for security
    };
    setFormData(nextFormData);
    setConnectionStatus('NOT_CONNECTED');
    setConnectionResult(null);
    cameraSessionStore.replaceDraft(nextFormData);
    setSaveSuccessMsg(null);
  };

  const handleDeleteCamera = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Bạn có chắc muốn xóa camera “${name}”?`)) {
      cameraConnectionService.deleteCamera(id);
      refreshSavedCameras();
      if (formData.id === id) {
        handleResetForm();
      }
    }
  };

  const handleResetForm = () => {
    setFormData({
      id: '',
      name: '',
      brand: 'Hikvision',
      ip: '',
      port: 554,
      protocol: 'RTSP',
      username: '',
      password: '',
      streamUrl: '',
    });
    setConnectionStatus('NOT_CONNECTED');
    setConnectionResult(null);
    setSaveSuccessMsg(null);
    cameraSessionStore.resetCameraTest();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Connect Real Camera
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Connect an existing CCTV/IP camera to Favis AI.
        </p>
      </div>

      {saveSuccessMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 animate-in fade-in-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Grid: Form on Left, Status/Summary/Result on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Connection Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-red-600" />
                <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                  Thông Tin Camera (Camera Connection Form)
                </h2>
              </div>
              <button
                type="button"
                onClick={handleResetForm}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
                title="Đặt lại các trường về mặc định"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Đặt lại</span>
              </button>
            </div>

            <form onSubmit={handleTestConnection} className="p-5 space-y-4">
              {/* Camera Name */}
              <div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Camera Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="VD: Camera Kho Hóa Chất Cửa Đông"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                    required
                  />
                </div>

              </div>

              {/* Brand */}
              <div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Brand (Hãng sản xuất) <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="brand"
                    value={formData.brand}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                  >
                    <option value="Hikvision">Hikvision</option>
                    <option value="Dahua">Dahua</option>
                    <option value="Ezviz">Ezviz</option>
                    <option value="Imou">Imou</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

              </div>

              {/* IP, Port, Protocol */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    IP Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ip"
                    value={formData.ip}
                    onChange={handleInputChange}
                    placeholder="192.168.1.120"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Port
                  </label>
                  <input
                    type="text"
                    name="port"
                    value={formData.port ?? ''}
                    onChange={handleInputChange}
                    placeholder="554 / 80"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Protocol <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="protocol"
                    value={formData.protocol}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                  >
                    <option value="RTSP">RTSP (Cổng 554)</option>
                    <option value="ONVIF">ONVIF (Cổng 80/8080)</option>
                    <option value="HTTP">HTTP</option>
                    <option value="HTTPS">HTTPS</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Username & Password (Password strictly masked) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username || ''}
                    onChange={handleInputChange}
                    placeholder="admin"
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Password (Bảo mật)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password || ''}
                      onChange={handleInputChange}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 font-mono focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Mật khẩu không bao giờ được log hoặc hiển thị trong summary.
                  </p>
                </div>
              </div>

              {/* Optional Stream URL */}
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Stream URL (Optional)
                    </label>
                    <span className="text-[11px] text-slate-400">
                      RTSP / HLS Stream
                    </span>
                  </div>
                  <input
                    type="text"
                    name="streamUrl"
                    value={formData.streamUrl || ''}
                    onChange={handleInputChange}
                    placeholder="rtsp://user:pass@192.168.1.120:554/Streaming/Channels/101"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 font-mono focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-hidden"
                  />
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isTesting}
                  id="btn-test-connection"
                  className="flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 active:scale-98 text-white px-5 py-2.5 text-sm font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Radio
                    className={`h-4 w-4 ${
                      isTesting ? 'animate-spin text-white' : 'text-white'
                    }`}
                  />
                  <span>
                    {isTesting ? 'CONNECTING...' : 'TEST CONNECTION'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveCamera}
                  id="btn-save-camera"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 active:scale-98 text-slate-700 px-4 py-2.5 text-sm font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  <Save className="h-4 w-4 text-slate-500" />
                  <span>SAVE CAMERA (LƯU CẤU HÌNH)</span>
                </button>
              </div>
            </form>
          </div>

          {/* Saved Cameras List */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-600" />
                <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                  Danh Sách Camera Đã Cấu Hình
                </h2>
              </div>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-mono text-slate-700 font-bold">
                {savedCameras.length} camera
              </span>
            </div>

            <div className="p-4">
              <p className="text-xs text-slate-500 mb-3">
                Danh sách camera đã lưu cấu hình trong hệ thống. Bấm vào để nạp lại vào form hoặc kiểm tra kết nối:
              </p>

              <div className="divide-y divide-slate-100">
                {savedCameras.map((cam) => {
                  const isCurrent = formData.id === cam.id;
                  return (
                    <div
                      key={cam.id}
                      onClick={() => handleLoadCamera(cam)}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-red-50/60 border border-red-200'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{cam.name}</span>
                          <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                            {cam.brand}
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {cam.ip}:{cam.port || 554}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium line-clamp-1">
                          {cam.protocol} stream
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                          <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                          Not Connected
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteCamera(cam.id, cam.name, e)}
                          className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
                          title="Xóa cấu hình"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Connection Status, Summary, Connection Result (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Connection Status Panel */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Trạng Thái Kết Nối
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                CONNECTION STATUS
              </span>
            </div>

            <div className="pt-4 flex flex-col items-center text-center">
              {connectionStatus === 'NOT_CONNECTED' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3 border border-slate-200">
                    <Video className="h-7 w-7" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
                    <span className="font-mono font-bold text-lg text-slate-800 tracking-wide">
                      NOT CONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Chưa thực hiện kiểm tra kết nối tới camera. Bấm &ldquo;TEST
                    CONNECTION&rdquo; để bắt đầu.
                  </p>
                </>
              )}

              {connectionStatus === 'CONNECTING' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-3 border border-amber-200 animate-pulse">
                    <Radio className="h-7 w-7 animate-spin" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping"></span>
                    <span className="font-mono font-bold text-lg text-amber-700 tracking-wide">
                      CONNECTING...
                    </span>
                  </div>
                  <p className="text-xs text-amber-600 mt-1">
                    Đang kiểm tra kết nối tới camera...
                  </p>
                </>
              )}

              {connectionStatus === 'CONNECTED' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3 border border-emerald-200">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <span className="font-mono font-bold text-lg text-emerald-700 tracking-wide">
                      CONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-1">
                    Kết nối thành công tới camera.
                  </p>
                </>
              )}

              {connectionStatus === 'FAILED' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3 border border-red-200">
                    <XCircle className="h-7 w-7" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                    <span className="font-mono font-bold text-lg text-red-600 tracking-wide">
                      CONNECTION FAILED
                    </span>
                  </div>
                  <p className="text-xs text-red-700 mt-1 max-w-xs font-medium">
                    {connectionResult?.errorMessage ||
                      'Backend connection service not configured'}
                  </p>
                </>
              )}

              {connectionStatus === 'DISCONNECTED' && (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3 border border-slate-200">
                    <XCircle className="h-7 w-7" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-500"></span>
                    <span className="font-mono font-bold text-lg text-slate-700 tracking-wide">
                      DISCONNECTED
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Phiên kết nối camera đã ngắt.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* 2. Camera Information Summary (Password is strictly excluded) */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tóm Tắt Cấu Hình
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                CAMERA SUMMARY
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Camera Name:</span>
                <span className="font-semibold text-slate-900 text-right">
                  {formData.name || '(Chưa nhập)'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Brand:</span>
                <span className="font-medium text-slate-900">
                  {formData.brand}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">IP Address:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formData.ip || '(Chưa nhập)'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Protocol:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formData.protocol}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Port:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formData.port || '554'}
                </span>
              </div>
            </div>

            <div className="rounded bg-slate-50 p-2 text-[11px] text-slate-500 border border-slate-100 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>Password được ẩn hoàn toàn theo nguyên tắc bảo mật.</span>
            </div>
          </div>

          {/* 3. Connection Result (Requirement 5) */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Kết Quả Kết Nối
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                CONNECTION RESULT
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Status:</span>
                <span
                  className={`font-mono font-bold ${
                    connectionStatus === 'CONNECTED'
                      ? 'text-emerald-600'
                      : connectionStatus === 'FAILED'
                      ? 'text-red-600'
                      : 'text-slate-500'
                  }`}
                >
                  {connectionStatus}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Stream:</span>
                <span
                  className={`font-mono font-bold ${
                    connectionResult?.streamStatus === 'AVAILABLE'
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                  }`}
                >
                  {connectionResult?.streamStatus || 'UNAVAILABLE'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">API:</span>
                <span
                  className={`font-mono font-bold ${
                    connectionResult?.apiStatus === 'AVAILABLE'
                      ? 'text-emerald-600'
                      : 'text-slate-500'
                  }`}
                >
                  {connectionResult?.apiStatus || 'UNAVAILABLE'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Last checked:</span>
                <span className="font-mono text-slate-600">
                  {connectionResult?.lastChecked || 'Chưa kiểm tra'}
                </span>
              </div>
            </div>

            {connectionResult?.errorMessage && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  <span>Chi tiết phản hồi:</span>
                </div>
                <p className="text-[11px] leading-relaxed font-mono">
                  {connectionResult.errorMessage}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
