import React, { useState } from 'react';
import { Camera, Incident } from '../types';
import { CctvPlayer } from '../components/CctvPlayer';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Radio,
  VideoOff,
  Flame,
  Shield,
  Activity,
  Server,
  RefreshCw,
  ExternalLink,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface CameraDetailModalProps {
  camera: Camera | null;
  onClose: () => void;
  onReconnect?: (camera: Camera) => void;
}

export const CameraDetailModal: React.FC<CameraDetailModalProps> = ({
  camera,
  onClose,
  onReconnect,
}) => {
  const navigate = useNavigate();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectSuccess, setReconnectSuccess] = useState(false);

  if (!camera) return null;

  const isOffline = camera.status === 'OFFLINE';
  const isFire = camera.status === 'FIRE';

  const handleSimulateReconnect = () => {
    setIsReconnecting(true);
    setReconnectSuccess(false);
    setTimeout(() => {
      setIsReconnecting(false);
      setReconnectSuccess(true);
      if (onReconnect) {
        onReconnect(camera);
      }
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm ${
                isFire
                  ? 'bg-red-600 text-white animate-pulse'
                  : isOffline
                  ? 'bg-slate-200 text-slate-600'
                  : 'bg-slate-900 text-white'
              }`}
            >
              {camera.code}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{camera.name}</h3>
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    isFire
                      ? 'bg-red-100 text-red-700 animate-pulse'
                      : isOffline
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {isFire ? '🔥 FIRE DETECTED' : camera.status}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>{camera.location}</span>
                <span>•</span>
                <span>Cập nhật: {camera.lastUpdate}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Main Video Stream Player */}
          <div className="space-y-2">
            <CctvPlayer camera={camera} className="aspect-video w-full rounded-xl shadow-lg" />

            {/* If camera is fire, prominent incident jump button */}
            {isFire && (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 p-3 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                  <Flame className="h-4 w-4 fill-red-600 animate-pulse" />
                  <span>Cảnh báo: Camera đang ghi nhận đám cháy thời gian thực!</span>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    navigate('/incidents');
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>MỞ MÀN HÌNH SỰ CỐ</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Offline Warning Card */}
          {isOffline && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <VideoOff className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-red-950">CAMERA OFFLINE</h4>
                    <p className="text-xs text-red-800 mt-0.5">
                      Last seen: <span className="font-mono font-semibold">{camera.lastSeen}</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Mất luồng RTSP tại địa chỉ IP: {camera.ipAddress}. Kiểm tra dây mạng PoE hoặc
                      nguồn cấp trạm phụ.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSimulateReconnect}
                  disabled={isReconnecting}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
                  <span>{isReconnecting ? 'Đang kết nối lại...' : 'Thử kết nối lại luồng'}</span>
                </button>
              </div>

              {reconnectSuccess && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Lệnh ping RTSP thành công! Luồng camera sẽ tự động phục hồi.</span>
                </div>
              )}
            </div>
          )}

          {/* Details 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Technical Information */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">
                <Server className="h-4 w-4 text-slate-700" />
                <span>Thông Số Kỹ Thuật Camera</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Mã camera (ID):</span>
                  <span className="font-mono font-bold text-slate-900">{camera.code}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Địa chỉ IP:</span>
                  <span className="font-mono font-semibold text-slate-900">{camera.ipAddress}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Luồng RTSP:</span>
                  <span className="font-mono text-slate-700 truncate max-w-[220px]" title={camera.streamUrl}>
                    {camera.streamUrl}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Model thiết bị:</span>
                  <span className="font-medium text-slate-900">{camera.model}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Độ phân giải & Tốc độ:</span>
                  <span className="font-mono text-slate-900">{camera.resolution}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Uptime (Thời gian ổn định):</span>
                  <span className="font-bold text-emerald-600">{camera.uptime}</span>
                </div>
              </div>
            </div>

            {/* AI Monitoring & Events Status */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">
                <Shield className="h-4 w-4 text-slate-700" />
                <span>Trạng Thái Giám Sát AI</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Trạng thái AI phân tích:</span>
                    <span className="font-bold text-slate-900">{camera.aiStatus}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        isFire ? 'bg-red-600 w-full' : isOffline ? 'bg-slate-300 w-0' : 'bg-emerald-500 w-full'
                      }`}
                    />
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Độ tin cậy nhận diện lửa:</span>
                    <span className={`font-mono font-bold ${isFire ? 'text-red-600' : 'text-slate-700'}`}>
                      {camera.fireConfidence || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Độ tin cậy nhận diện khói:</span>
                    <span className={`font-mono font-bold ${isFire ? 'text-amber-600' : 'text-slate-700'}`}>
                      {camera.smokeConfidence || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                    <span>Ngưỡng kích hoạt cảnh báo:</span>
                    <span>85% (3 frames liên tiếp)</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">Tọa độ sơ đồ:</span> X: {camera.mapCoords.x}%, Y:{' '}
                  {camera.mapCoords.y}% (Khu vực {camera.location})
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
