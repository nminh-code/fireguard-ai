import React, { useState, useEffect } from 'react';
import { Camera } from '../types';
import { ShieldAlert, RefreshCw, Radio, Flame, Eye, VideoOff, Maximize2 } from 'lucide-react';

interface CctvPlayerProps {
  camera: Camera;
  showAiOverlay?: boolean;
  aspectRatio?: 'video' | 'wide' | 'square';
  className?: string;
  isLive?: boolean;
}

export const CctvPlayer: React.FC<CctvPlayerProps> = ({
  camera,
  showAiOverlay = true,
  className = '',
  isLive = true,
}) => {
  const [timestamp, setTimestamp] = useState<string>('');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimestamp(
        `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now
          .getDate()
          .toString()
          .padStart(2, '0')} ${now.toLocaleTimeString('vi-VN', { hour12: false })}`
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isOffline = camera.status === 'OFFLINE';
  const isFire = camera.status === 'FIRE' || camera.aiStatus === 'FIRE_DETECTED';

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-slate-950 text-slate-100 select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id={`cctv-player-${camera.id}`}
    >
      {/* Background feed or offline placeholder */}
      {isOffline ? (
        <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mb-3 border border-slate-700 text-slate-500">
            <VideoOff className="w-7 h-7" />
          </div>
          <span className="text-base font-semibold text-slate-300">TÍN HIỆU CAMERA BỊ MẤT (OFFLINE)</span>
          <p className="text-xs text-slate-400 mt-1">Mất kết nối luồng RTSP từ {camera.lastSeen}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-950/60 border border-amber-800/60 px-3 py-1.5 rounded">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            Đang thử kết nối lại luồng: {camera.streamUrl}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full min-h-[220px]">
          <img
            src={
              camera.previewSnapshotUrl ||
              'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80'
            }
            alt={camera.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />

          {/* CCTV Scanlines & vignette simulation */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-black/60" />
          <div
            className="absolute inset-0 pointer-events-none opacity-10 mix-blend-overlay"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, #fff, #fff 1px, transparent 1px, transparent 3px)',
            }}
          />

          {/* AI Bounding Box overlay if Fire detected */}
          {showAiOverlay && isFire && (
            <div className="absolute top-[28%] left-[32%] w-[42%] h-[46%] border-2 border-red-500 bg-red-500/15 rounded animate-pulse pointer-events-none">
              <div className="absolute -top-7 left-0 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 shadow-lg">
                <Flame className="w-3.5 h-3.5 text-yellow-300" />
                <span>FIRE: {camera.fireConfidence || 96}%</span>
                <span className="text-slate-200">|</span>
                <span>SMOKE: {camera.smokeConfidence || 94}%</span>
              </div>
              {/* Corner crosshairs */}
              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-red-400" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-red-400" />
              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-red-400" />
              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-red-400" />
            </div>
          )}
        </div>
      )}

      {/* CCTV Top Info Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-mono pointer-events-none z-10">
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-xs px-2 py-1 rounded border border-white/10">
          <span className="font-bold text-slate-100">{camera.code}</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300 truncate max-w-[150px]">{camera.location}</span>
        </div>

        <div className="flex items-center gap-2">
          {isFire ? (
            <div className="flex items-center gap-1.5 bg-red-600 text-white font-bold px-2 py-1 rounded shadow animate-pulse">
              <Flame className="w-3.5 h-3.5 text-yellow-300" />
              <span>AI FIRE ALERT</span>
            </div>
          ) : isOffline ? (
            <div className="flex items-center gap-1.5 bg-zinc-800 text-red-400 px-2 py-1 rounded border border-red-800/40">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>OFFLINE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-xs text-emerald-400 px-2 py-1 rounded border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE</span>
              <span className="text-slate-400 text-[10px]">{camera.fps} FPS</span>
            </div>
          )}
        </div>
      </div>

      {/* CCTV Bottom Info Bar */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-mono pointer-events-none z-10">
        <div className="bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded border border-white/10 text-slate-300">
          {timestamp || camera.lastUpdate}
        </div>

        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded border border-white/10 text-slate-300">
          {showAiOverlay && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Eye className="w-3 h-3" />
              <span>AI ENGINE ACTIVE</span>
            </span>
          )}
          <span className="text-slate-500">•</span>
          <span>{camera.resolution.split(' ')[0]}</span>
        </div>
      </div>

      {/* Hover action bar */}
      {isHovered && !isOffline && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center gap-2 transition-opacity z-20">
          <div className="bg-slate-900/90 text-white text-xs px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-2 shadow-xl backdrop-blur-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>RTSP 1080p Stream OK</span>
          </div>
        </div>
      )}
    </div>
  );
};
