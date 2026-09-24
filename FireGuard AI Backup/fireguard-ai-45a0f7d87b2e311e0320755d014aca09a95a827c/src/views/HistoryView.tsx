import React, { useState, useEffect } from 'react';
import { FireEvent, IncidentSeverity } from '../types';
import { incidentService } from '../services/incidentService';
import { realtimeService } from '../services/realtimeService';
import {
  History,
  Search,
  Filter,
  Flame,
  Calendar,
  Download,
  AlertTriangle,
  CheckCircle2,
  Cctv,
} from 'lucide-react';

export const HistoryView: React.FC = () => {
  const [events, setEvents] = useState<FireEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'FIRE' | 'RESOLVED' | 'FALSE_ALARM'>('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');

  const loadHistory = async () => {
    const data = await incidentService.getHistory();
    setEvents(data);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();

    const unsub = realtimeService.subscribeToGlobalState(() => {
      loadHistory();
    });

    return () => unsub();
  }, []);

  const filteredEvents = events.filter((evt) => {
    const matchesSearch =
      evt.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.cameraCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.details.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      activeFilter === 'ALL'
        ? true
        : activeFilter === 'FIRE'
        ? evt.eventType === 'FIRE_CONFIRMED'
        : activeFilter === 'RESOLVED'
        ? evt.status === 'RESOLVED' || evt.eventType === 'INCIDENT_RESOLVED'
        : evt.status === 'FALSE_ALARM' || evt.eventType === 'FALSE_ALARM';

    const matchesDate =
      dateFilter === 'ALL'
        ? true
        : dateFilter === 'TODAY'
        ? evt.timestamp.includes('Hôm nay')
        : dateFilter === 'YESTERDAY'
        ? evt.timestamp.includes('Hôm qua')
        : true;

    return matchesSearch && matchesType && matchesDate;
  });

  const handleExportCSV = () => {
    const headers = 'Time,Event,Camera,Location,Severity,Status,Details\n';
    const rows = filteredEvents
      .map(
        (e) =>
          `"${e.timestamp}","${e.eventType}","${e.cameraCode}","${e.location}","${e.severity}","${e.status}","${e.details.replace(/"/g, '""')}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Favis_Log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="history-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
              Nhật Ký Lịch Sử Sự Kiện
            </h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {filteredEvents.length} bản ghi
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Lưu vết toàn bộ cảnh báo phát hiện cháy, mất kết nối camera và nhật ký xử lý hiện trường
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Xuất Báo Cáo (CSV)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo camera, vị trí hoặc chi tiết sự kiện..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Type filters */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(['ALL', 'FIRE', 'RESOLVED', 'FALSE_ALARM'] as const).map((ft) => (
                <button
                  key={ft}
                  onClick={() => setActiveFilter(ft)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeFilter === ft
                      ? ft === 'FIRE'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {ft === 'ALL'
                    ? 'Tất cả'
                    : ft === 'FIRE'
                    ? '🔥 Cháy'
                    : ft === 'RESOLVED'
                    ? 'Đã xử lý'
                    : 'Báo động giả'}
                </button>
              ))}
            </div>

            {/* Date filter select */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-slate-800 focus:outline-hidden"
            >
              <option value="ALL">Tất cả thời gian</option>
              <option value="TODAY">Hôm nay</option>
              <option value="YESTERDAY">Hôm qua</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Events Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Thời Gian</th>
                <th className="px-4 py-3">Loại Sự Kiện</th>
                <th className="px-4 py-3">Camera</th>
                <th className="px-4 py-3">Khu Vực</th>
                <th className="px-4 py-3">Cấp Độ (Severity)</th>
                <th className="px-4 py-3">Trạng Thái</th>
                <th className="px-4 py-3">Chi Tiết Sự Kiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Không có bản ghi nhật ký phù hợp
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                      {evt.timestamp}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] ${
                          evt.eventType === 'FIRE_CONFIRMED'
                            ? 'bg-red-100 text-red-700'
                            : evt.eventType === 'CAMERA_OFFLINE'
                            ? 'bg-amber-100 text-amber-800'
                            : evt.eventType === 'INCIDENT_RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {evt.eventType === 'FIRE_CONFIRMED' && (
                          <Flame className="h-3 w-3 fill-red-600" />
                        )}
                        {evt.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {evt.cameraCode}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {evt.location}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`font-semibold text-[11px] ${
                          evt.severity === 'CRITICAL'
                            ? 'text-red-600 font-bold'
                            : evt.severity === 'HIGH'
                            ? 'text-orange-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {evt.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          evt.status === 'ACTIVE'
                            ? 'text-red-600 font-bold'
                            : evt.status === 'RESOLVED'
                            ? 'text-emerald-700'
                            : evt.status === 'FALSE_ALARM'
                            ? 'text-slate-500'
                            : 'text-slate-700'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            evt.status === 'ACTIVE'
                              ? 'bg-red-600 animate-ping'
                              : evt.status === 'RESOLVED'
                              ? 'bg-emerald-500'
                              : 'bg-slate-400'
                          }`}
                        />
                        {evt.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs">{evt.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
