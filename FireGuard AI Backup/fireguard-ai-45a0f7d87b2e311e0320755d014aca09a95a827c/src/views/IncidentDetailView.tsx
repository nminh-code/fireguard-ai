import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Incident, Camera } from '../types';
import { incidentService } from '../services/incidentService';
import { cameraService } from '../services/cameraService';
import { authService } from '../services/authService';
import { realtimeService } from '../services/realtimeService';
import { soundManager } from '../utils/audioAlert';
import { CctvPlayer } from '../components/CctvPlayer';
import {
  Flame,
  ArrowLeft,
  ShieldAlert,
  Clock,
  MapPin,
  Cctv,
  CheckCircle2,
  AlertOctagon,
  Play,
  Check,
  AlertTriangle,
  Send,
  PhoneCall,
  Volume2,
  VolumeX,
  Share2,
} from 'lucide-react';

export const IncidentDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundActive, setSoundActive] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolverName, setResolverName] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const currentUser = authService.getCurrentUser();

  const loadIncident = async () => {
    if (!id) return;
    const inc = await incidentService.getIncident(id);
    if (inc) {
      setIncident(inc);
      const cam = await cameraService.getCamera(inc.cameraId);
      setCamera(cam);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadIncident();

    const unsub = realtimeService.subscribeToIncidentEvents((updated) => {
      if (updated.id === id || updated.code === id) {
        setIncident({ ...updated });
      }
    });

    return () => unsub();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 p-6 animate-pulse">
        <div className="h-20 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[450px] bg-slate-200 rounded-xl" />
          <div className="h-[450px] bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center my-6">
        <AlertOctagon className="mx-auto h-12 w-12 text-slate-300" />
        <h2 className="mt-3 text-base font-bold text-slate-900">Không tìm thấy mã sự cố</h2>
        <p className="mt-1 text-xs text-slate-500">Mã sự cố "{id}" không tồn tại hoặc đã bị hủy.</p>
        <button
          onClick={() => navigate('/incidents')}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2 text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách sự cố
        </button>
      </div>
    );
  }

  const isCritical = incident.severity === 'CRITICAL' || incident.severity === 'HIGH';
  const isActive = incident.status === 'ACTIVE';
  const isResponding = incident.status === 'RESPONDING';
  const isResolved = incident.status === 'RESOLVED';
  const isFalseAlarm = incident.status === 'FALSE_ALARM';

  const handleStartResponse = async () => {
    setActionLoading(true);
    await incidentService.startResponse(incident.id, `${currentUser.name} (${currentUser.role})`);
    setActionLoading(false);
  };

  const handleOpenResolveModal = () => {
    setResolverName(currentUser.name || 'Nguyễn Văn A');
    setResolveNotes('Đám cháy tại pallet kệ 04 đã được khống chế dập tắt bằng 2 bình bọt foam.');
    setShowResolveModal(true);
  };

  const handleConfirmResolve = async () => {
    setActionLoading(true);
    soundManager.playSuccessTone();
    await incidentService.resolveIncident(incident.id, resolverName, resolveNotes);
    setShowResolveModal(false);
    setActionLoading(false);
  };

  const handleMarkFalseAlarm = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xác nhận đây là BÁO ĐỘNG GIẢ (False Alarm)?')) {
      setActionLoading(true);
      await incidentService.markFalseAlarm(
        incident.id,
        currentUser.name,
        'Hơi nóng từ quá trình thông gió máy ép'
      );
      setActionLoading(false);
    }
  };

  const toggleSound = () => {
    if (!soundActive) {
      soundManager.playFireAlarm();
      setSoundActive(true);
    } else {
      setSoundActive(false);
    }
  };

  return (
    <div className="space-y-6" id="incident-detail-view">
      {/* Top navigation back + emergency call bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/incidents')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Danh sách sự cố</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              soundActive
                ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {soundActive ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline">Còi báo động</span>
          </button>

          <a
            href="tel:114"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>GỌI 114 PCCC</span>
          </a>
        </div>
      </div>

      {/* EMERGENCY PRIORITY HEADER (Section 9 & 21 Mandate) */}
      <div
        className={`rounded-2xl border-2 p-5 md:p-6 shadow-md ${
          isActive
            ? 'border-red-600 bg-red-50 text-red-950'
            : isResponding
            ? 'border-amber-500 bg-amber-50 text-amber-950'
            : isResolved
            ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
            : 'border-slate-300 bg-slate-100 text-slate-900'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/10 pb-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm text-white ${
                isActive
                  ? 'bg-red-600 animate-pulse'
                  : isResponding
                  ? 'bg-amber-600'
                  : isResolved
                  ? 'bg-emerald-600'
                  : 'bg-slate-600'
              }`}
            >
              {isResolved ? (
                <CheckCircle2 className="h-7 w-7" />
              ) : (
                <Flame className="h-7 w-7 fill-white" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl md:text-2xl font-black tracking-tight uppercase">
                  🔥 FIRE CONFIRMED
                </span>
                <span className="text-sm font-mono font-bold px-2.5 py-0.5 rounded-md bg-white/80 border border-black/10">
                  Incident #{incident.code}
                </span>
              </div>
              <div className="text-xs font-medium opacity-80 mt-0.5">
                AI phát hiện qua camera an ninh CCTV và kích hoạt trạng thái báo động khẩn cấp
              </div>
            </div>
          </div>

          {/* Incident Status Pill */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider shadow-xs ${
                isActive
                  ? 'bg-red-600 text-white animate-pulse'
                  : isResponding
                  ? 'bg-amber-600 text-white'
                  : isResolved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-white'
              }`}
            >
              STATUS: {incident.status}
            </span>
          </div>
        </div>

        {/* 6 Essential Emergency Data Points (Section 21) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
          <div className="rounded-xl bg-white/90 p-3 border border-black/5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              📍 LOCATION
            </div>
            <div className="text-sm font-black text-slate-900 mt-1 truncate">
              {incident.location}
            </div>
          </div>

          <div className="rounded-xl bg-white/90 p-3 border border-black/5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              📹 CAMERA
            </div>
            <div className="text-sm font-mono font-black text-slate-900 mt-1">
              {incident.cameraCode}
            </div>
          </div>

          <div className="rounded-xl bg-white/90 p-3 border border-black/5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              🕐 DETECTED
            </div>
            <div className="text-sm font-mono font-black text-slate-900 mt-1">
              {incident.detectedAt}
            </div>
          </div>

          <div className="rounded-xl bg-white/90 p-3 border border-black/5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              🔥 SEVERITY
            </div>
            <div className="text-sm font-black text-red-600 mt-1">
              {incident.severity}
            </div>
          </div>

          <div className="rounded-xl bg-white/90 p-3 border border-black/5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              🤖 AI CONFIDENCE
            </div>
            <div className="text-sm font-mono font-black text-red-600 mt-1">
              {incident.fireConfidence}%
            </div>
          </div>

          <div className="rounded-xl bg-white/90 p-3 border border-black/5 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              ⚡ SITE ID
            </div>
            <div className="text-sm font-mono font-bold text-slate-700 mt-1">
              HẢI PHÒNG #01
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Incident Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: LIVE CAMERA VIEW & AI ANALYSIS */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cctv className="h-4 w-4 text-slate-700" />
                <h3 className="font-bold text-sm text-slate-900">
                  LIVE CAMERA VIEW — {incident.cameraCode} ({incident.location})
                </h3>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                ĐANG PHÁT TRỰC TIẾP
              </span>
            </div>

            {/* Video Player */}
            {camera ? (
              <CctvPlayer camera={camera} showAiOverlay={true} className="aspect-video w-full" />
            ) : (
              <div className="aspect-video w-full bg-slate-900 rounded-lg flex items-center justify-center text-slate-500">
                Không tìm thấy nguồn camera
              </div>
            )}

            {/* AI Analysis telemetry bar (Section 9 mandate) */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="text-xs text-red-800 font-semibold">Fire detected (Ngọn lửa)</div>
                <div className="text-2xl font-black font-mono text-red-600 mt-0.5">
                  {incident.fireConfidence}%
                </div>
                <div className="text-[10px] text-red-700 mt-1">Độ chính xác AI cao (V3 Engine)</div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="text-xs text-amber-800 font-semibold">Smoke detected (Khói đặc)</div>
                <div className="text-2xl font-black font-mono text-amber-600 mt-0.5">
                  {incident.smokeConfidence}%
                </div>
                <div className="text-[10px] text-amber-700 mt-1">Mật độ khói lan rộng 3.5m</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-700 font-semibold">Cảm biến nhiệt ước tính</div>
                <div className="text-2xl font-black font-mono text-slate-900 mt-0.5">
                  182°C
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Vượt ngưỡng an toàn kho 45°C</div>
              </div>
            </div>
          </div>

          {/* Quick Facility Notes & Evacuation Guide */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Ghi Chú Vận Hành Hiện Trường
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              {incident.notes ||
                'Vị trí kệ 04 nằm ngay cạnh lối thoát hiểm phía Đông. Khuyến nghị cô lập ngay aptomat tổng phân xưởng A và hướng dẫn công nhân di chuyển ra bãi tập kết an toàn số 01.'}
            </p>
          </div>
        </div>

        {/* Right 5 Columns: Actions & Incident Timeline */}
        <div className="lg:col-span-5 space-y-5">
          {/* Emergency Response Action Panel */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">⚡ HÀNH ĐỘNG PHẢN ỨNG KHẨN CẤP</h3>
              <span className="text-[11px] font-medium text-slate-500">
                Quyền hạn: {currentUser.role}
              </span>
            </div>

            {/* Resolved Info Box if already resolved */}
            {isResolved && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 space-y-1 text-emerald-950">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>SỰ CỐ ĐÃ ĐƯỢC GIẢI QUYẾT HOÀN TOÀN</span>
                </div>
                <div className="text-xs pt-1">
                  <span className="font-semibold">Resolved by:</span> {incident.resolvedBy}
                </div>
                <div className="text-xs">
                  <span className="font-semibold">Resolved at:</span> {incident.resolvedAt}
                </div>
                {incident.notes && (
                  <div className="text-xs text-emerald-800 mt-1 italic bg-white/60 p-2 rounded">
                    "{incident.notes}"
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {isActive && (
                <button
                  onClick={handleStartResponse}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
                  id="btn-start-response"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>BẮT ĐẦU XỬ LÝ [START RESPONSE]</span>
                </button>
              )}

              {(isActive || isResponding) && (
                <button
                  onClick={handleOpenResolveModal}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
                  id="btn-mark-resolved"
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>ĐÁNH DẤU ĐÃ XỬ LÝ [MARK RESOLVED]</span>
                </button>
              )}

              {(isActive || isResponding) && (
                <button
                  onClick={handleMarkFalseAlarm}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                  id="btn-false-alarm"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                  <span>Báo Động Giả (False Alarm)</span>
                </button>
              )}
            </div>
          </div>

          {/* INCIDENT TIMELINE (Section 9 mandate) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Tiến Trình Sự Cố (Timeline)</h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {incident.timeline.length} sự kiện
              </span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {incident.timeline.map((item, idx) => (
                <div key={item.id || idx} className="relative group text-left">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-6 top-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
                      item.type === 'DETECTED'
                        ? 'bg-red-600 text-white'
                        : item.type === 'CREATED'
                        ? 'bg-red-500 text-white'
                        : item.type === 'RESOLVED'
                        ? 'bg-emerald-600 text-white'
                        : item.type === 'RESPONDING'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-700 text-white'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{item.title}</span>
                      <span className="text-[11px] font-mono font-semibold text-slate-500">
                        {item.time}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {item.description}
                    </p>

                    {item.actor && (
                      <div className="mt-1 text-[10px] font-medium text-slate-400">
                        Thực hiện: <span className="text-slate-700">{item.actor}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Mark Resolved */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900">Xác Nhận Giải Quyết Sự Cố Cháy</h3>
            </div>

            <p className="text-xs text-slate-600">
              Vui lòng nhập họ tên người chỉ huy hiện trường và biện pháp đã xử lý trước khi đóng sự
              cố.
            </p>

            <div className="space-y-3 text-xs text-left">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Người chịu trách nhiệm giải quyết (Resolved by):
                </label>
                <input
                  type="text"
                  value={resolverName}
                  onChange={(e) => setResolverName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 font-medium focus:border-slate-800 focus:outline-hidden"
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Biện pháp khắc phục / Ghi chú hiện trường:
                </label>
                <textarea
                  rows={3}
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-800 focus:outline-hidden"
                  placeholder="Mô tả chi tiết phương pháp dập tắt..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmResolve}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer"
              >
                Xác nhận hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
