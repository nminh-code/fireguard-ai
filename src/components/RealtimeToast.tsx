import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../types';
import { realtimeService } from '../services/realtimeService';
import { Flame, X, ArrowRight, ShieldAlert } from 'lucide-react';

export const RealtimeToast: React.FC = () => {
  const navigate = useNavigate();
  const [activeAlert, setActiveAlert] = useState<Notification | null>(null);

  useEffect(() => {
    const unsub = realtimeService.subscribeToNotifications((notification) => {
      if (notification.type === 'FIRE_CONFIRMED') {
        setActiveAlert(notification);
      }
    });

    return () => unsub();
  }, []);

  if (!activeAlert) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-bounce-short"
      id="realtime-fire-toast"
    >
      <div className="relative overflow-hidden rounded-xl border-2 border-red-600 bg-red-600 text-white shadow-2xl p-4">
        {/* Pulsing indicator background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-red-600 shadow-md">
              <Flame className="h-6 w-6 fill-red-600 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded">
                  CẢNH BÁO KHẨN CẤP
                </span>
                <span className="text-xs text-red-100 font-mono">{activeAlert.timestamp}</span>
              </div>
              <h4 className="text-base font-bold leading-tight mt-0.5">{activeAlert.title}</h4>
            </div>
          </div>

          <button
            onClick={() => setActiveAlert(null)}
            className="rounded p-1 text-red-100 hover:bg-white/20 hover:text-white transition-colors"
            title="Đóng thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2.5 text-xs text-red-50 bg-black/20 rounded-lg p-2.5">
          <div className="font-semibold text-white">Vị trí: {activeAlert.location}</div>
          <div className="text-red-100 mt-0.5">{activeAlert.message}</div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={() => setActiveAlert(null)}
            className="px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
          >
            Bỏ qua
          </button>
          <button
            onClick={() => {
              const id = activeAlert.incidentId;
              setActiveAlert(null);
              if (id) {
                navigate(`/incidents/${id}`);
              } else {
                navigate('/incidents');
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-white text-red-700 hover:bg-red-50 rounded-md shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            <span>MỞ CHI TIẾT SỰ CỐ NGAY</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
