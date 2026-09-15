import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Incident, IncidentSeverity, IncidentStatus } from '../types';
import { incidentService } from '../services/incidentService';
import { realtimeService } from '../services/realtimeService';
import {
  Flame,
  Search,
  Filter,
  ArrowRight,
  Clock,
  MapPin,
  Cctv,
  AlertTriangle,
  CheckCircle2,
  Zap,
} from 'lucide-react';

export const IncidentsView: React.FC = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncidentStatus>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | IncidentSeverity>('ALL');

  const loadIncidents = async () => {
    const list = await incidentService.getIncidents();
    setIncidents(list);
    setLoading(false);
  };

  useEffect(() => {
    loadIncidents();

    const unsub = realtimeService.subscribeToIncidentEvents(() => {
      loadIncidents();
    });

    const unsubGlobal = realtimeService.subscribeToGlobalState(() => {
      loadIncidents();
    });

    return () => {
      unsub();
      unsubGlobal();
    };
  }, []);

  const filtered = incidents.filter((inc) => {
    const matchesSearch =
      inc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.cameraCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
    const matchesSeverity = severityFilter === 'ALL' || inc.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  return (
    <div className="space-y-6" id="incidents-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
              Quản Lý Sự Cố Cháy (Incidents)
            </h1>
            <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-bold">
              {incidents.filter((i) => i.status === 'ACTIVE' || i.status === 'RESPONDING').length}{' '}
              đang hoạt động
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Sự cố chỉ được tạo khi backend nhận event FIRE_CONFIRMED từ hệ thống AI Vision
          </p>
        </div>

        <button
          onClick={() => {
            const inc = incidentService.simulateFireEvent();
            navigate(`/incidents/${inc.id}`);
          }}
          className="flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 active:scale-98 text-white px-4 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <Zap className="h-3.5 w-3.5 text-yellow-300 fill-yellow-300" />
          <span>KÍCH HOẠT SỰ CỐ MỚI (DEMO)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã sự cố (#FG-2026-001), camera, vị trí..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(['ALL', 'ACTIVE', 'RESPONDING', 'RESOLVED', 'FALSE_ALARM'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    statusFilter === st
                      ? st === 'ACTIVE'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL'
                    ? 'Tất cả'
                    : st === 'ACTIVE'
                    ? 'Khẩn cấp'
                    : st === 'RESPONDING'
                    ? 'Đang xử lý'
                    : st === 'RESOLVED'
                    ? 'Đã xử lý'
                    : 'Báo động giả'}
                </button>
              ))}
            </div>

            {/* Severity Select */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as unknown as typeof severityFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-slate-800 focus:outline-hidden"
            >
              <option value="ALL">Mọi cấp độ (Severity)</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents Table / Cards */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h3 className="mt-3 text-sm font-bold text-slate-800">Không có sự cố nào phù hợp</h3>
          <p className="mt-1 text-xs text-slate-500">
            Hệ thống đang hoạt động an toàn hoặc không có mục nào theo bộ lọc của bạn
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inc) => (
            <div
              key={inc.id}
              onClick={() => navigate(`/incidents/${inc.id}`)}
              className={`group flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border bg-white shadow-2xs hover:shadow-md transition-all cursor-pointer gap-4 ${
                inc.status === 'ACTIVE'
                  ? 'border-red-400 bg-red-50/40 hover:bg-red-50/80 ring-1 ring-red-500/20'
                  : inc.status === 'RESPONDING'
                  ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/80'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              {/* Left Details */}
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-xs ${
                    inc.status === 'ACTIVE'
                      ? 'bg-red-600 animate-pulse'
                      : inc.status === 'RESPONDING'
                      ? 'bg-amber-600'
                      : inc.status === 'RESOLVED'
                      ? 'bg-emerald-600'
                      : 'bg-slate-600'
                  }`}
                >
                  {inc.status === 'RESOLVED' ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Flame className="h-6 w-6 fill-white" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      #{inc.code}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        inc.status === 'ACTIVE'
                          ? 'bg-red-600 text-white animate-pulse'
                          : inc.status === 'RESPONDING'
                          ? 'bg-amber-500 text-white'
                          : inc.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {inc.status}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        inc.severity === 'CRITICAL'
                          ? 'border-red-300 bg-red-100 text-red-700'
                          : 'border-slate-200 bg-slate-100 text-slate-700'
                      }`}
                    >
                      SEVERITY: {inc.severity}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                    {inc.location}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-mono">
                      <Cctv className="h-3.5 w-3.5 text-slate-400" />
                      {inc.cameraCode}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      Phát hiện: {inc.detectedAt}
                    </span>
                    <span>•</span>
                    <span className="text-red-700 font-semibold">
                      AI Confidence: {inc.fireConfidence}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Action Trigger */}
              <div className="flex items-center justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                {inc.status === 'RESOLVED' && inc.resolvedBy && (
                  <div className="text-right text-xs text-slate-500 hidden lg:block">
                    <div>Đã xử lý bởi: <span className="font-semibold text-slate-800">{inc.resolvedBy}</span></div>
                    <div className="text-[11px] font-mono text-slate-400">{inc.resolvedAt}</div>
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/incidents/${inc.id}`);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 group-hover:bg-red-600 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <span>Mở chi tiết</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
