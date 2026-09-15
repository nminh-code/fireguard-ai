import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../types';
import { notificationService } from '../services/notificationService';
import { realtimeService } from '../services/realtimeService';
import {
  Bell,
  Flame,
  CheckCircle2,
  VideoOff,
  Info,
  ArrowRight,
  CheckCheck,
  Clock,
  MapPin,
  Cctv,
} from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'UNREAD' | 'FIRE'>('ALL');

  const loadNotifications = async () => {
    const list = await notificationService.getNotifications();
    setNotifications(list);
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();

    const unsub = realtimeService.subscribeToNotifications(() => {
      loadNotifications();
    });

    const unsubGlobal = realtimeService.subscribeToGlobalState(() => {
      loadNotifications();
    });

    return () => {
      unsub();
      unsubGlobal();
    };
  }, []);

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    loadNotifications();
  };

  const handleNotificationClick = (notif: Notification) => {
    notificationService.markAsRead(notif.id);
    if (notif.incidentId) {
      navigate(`/incidents/${notif.incidentId}`);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filterType === 'UNREAD') return !n.read;
    if (filterType === 'FIRE') return n.type === 'FIRE_CONFIRMED';
    return true;
  });

  return (
    <div className="space-y-6" id="notifications-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
              Trung Tâm Thông Báo Khẩn Cấp
            </h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {notifications.filter((n) => !n.read).length} chưa đọc
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Các cảnh báo nhận diện thời gian thực từ mô hình AI FireGuard và trạng thái mạng CCTV
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <CheckCheck className="h-4 w-4 text-slate-500" />
          <span>Đánh dấu tất cả đã đọc</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {(['ALL', 'UNREAD', 'FIRE'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterType(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterType === tab
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab === 'ALL'
              ? 'Tất cả'
              : tab === 'UNREAD'
              ? 'Chưa đọc'
              : '🔥 Chỉ sự cố cháy (FIRE_CONFIRMED)'}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-800">Không có thông báo nào</h3>
          <p className="mt-1 text-xs text-slate-500">
            Tất cả thông báo đều đã được kiểm tra hoặc không phát hiện sự cố mới
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`group flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border transition-all cursor-pointer gap-3 ${
                notif.type === 'FIRE_CONFIRMED'
                  ? 'border-red-300 bg-red-50/50 hover:bg-red-50'
                  : !notif.read
                  ? 'border-slate-300 bg-slate-50/60 hover:bg-slate-100'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-xs ${
                    notif.type === 'FIRE_CONFIRMED'
                      ? 'bg-red-600 animate-pulse'
                      : notif.type === 'CAMERA_OFFLINE'
                      ? 'bg-amber-500'
                      : 'bg-slate-700'
                  }`}
                >
                  {notif.type === 'FIRE_CONFIRMED' ? (
                    <Flame className="h-5 w-5 fill-white" />
                  ) : notif.type === 'CAMERA_OFFLINE' ? (
                    <VideoOff className="h-5 w-5" />
                  ) : (
                    <Info className="h-5 w-5" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold ${
                        notif.type === 'FIRE_CONFIRMED' ? 'text-red-700' : 'text-slate-900'
                      }`}
                    >
                      {notif.title}
                    </span>
                    {!notif.read && (
                      <span className="h-2 w-2 rounded-full bg-red-600 shrink-0" />
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {notif.timestamp}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {notif.location}
                    </span>
                    {notif.cameraCode && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono font-semibold">
                          <Cctv className="h-3 w-3" />
                          {notif.cameraCode}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {notif.incidentId && (
                <div className="flex items-center justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <span className="flex items-center gap-1 text-xs font-bold text-red-600 group-hover:text-red-700 group-hover:translate-x-0.5 transition-transform">
                    <span>Mở sự cố</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
