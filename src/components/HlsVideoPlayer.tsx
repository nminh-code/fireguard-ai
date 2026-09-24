import Hls, { FetchLoader } from 'hls.js';
import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Radio,
  Camera as CameraIcon,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface HlsVideoPlayerProps {
  src: string;
  webrtcUrl?: string;
}

export const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({ src, webrtcUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isWebRtc, setIsWebRtc] = useState<boolean>(false);

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  };

  const handleMouseLeave = () => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    setShowControls(false);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    let hls: Hls | null = null;
    let lastTime = -1;
    let advancedAt = Date.now();
    let lastSequence = -1;
    let playlistAdvancedAt = Date.now();
    let recoveryAttempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    setError(null);
    setIsWebRtc(false);
    video.pause();
    video.removeAttribute('src');
    video.srcObject = null;
    video.load();
    video.muted = true;
    setIsMuted(true);
    setIsPlaying(false);

    const play = () =>
      video.play().catch(() => {
        if (!disposed) setError('Trình duyệt chưa cho tự phát. Bấm Play để xem camera.');
      });

    const onPlaying = () => {
      advancedAt = Date.now();
      setIsPlaying(true);
      setError(null);
    };

    const onPause = () => {
      if (!disposed) setIsPlaying(false);
      setShowControls(true);
    };

    const onVolumeChange = () => {
      if (!disposed) setIsMuted(video.muted);
    };

    const onVideoError = () => setError('Trình duyệt không giải mã được luồng video.');

    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('error', onVideoError);

    let webRtcActive = false;

    const startHls = () => {
      if (disposed || webRtcActive || hlsRef.current) return;
      if (Hls.isSupported()) {
        hls = new Hls({
          loader: FetchLoader,
          fetchSetup: (context, init) => new Request(context.url, { ...init, cache: 'no-store' }),
          startPosition: -1,
          liveSyncDurationCount: 1,
          liveMaxLatencyDurationCount: 3,
          maxLiveSyncPlaybackRate: 1.5,
          liveDurationInfinity: true,
          backBufferLength: 6,
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;

        const instance = hls;
        instance.on(Hls.Events.MEDIA_ATTACHED, () => instance.loadSource(src));
        instance.on(Hls.Events.MANIFEST_PARSED, play);
        instance.on(Hls.Events.LEVEL_UPDATED, (_event, { details }) => {
          if (details.endSN !== lastSequence) {
            lastSequence = details.endSN;
            playlistAdvancedAt = Date.now();
          }
        });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || disposed) return;
          setError(`Luồng live bị gián đoạn (${data.type}); đang thử phục hồi.`);
          if (recoveryAttempts >= 3 || retryTimer) return;
          recoveryAttempts++;
          retryTimer = setTimeout(() => {
            retryTimer = undefined;
            if (disposed) return;
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) instance.recoverMediaError();
            else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) instance.startLoad(-1);
          }, 2000);
        });
        instance.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        void play();
      } else {
        setError('Trình duyệt này không hỗ trợ phát HLS.');
      }
    };

    let targetWebrtc = webrtcUrl;
    if (!targetWebrtc && src.includes('/streams/')) {
      const match = src.match(/\/streams\/([^/]+)/);
      if (match) {
        targetWebrtc = `ws://127.0.0.1:1984/api/ws?src=${encodeURIComponent(match[1])}`;
      }
    }

    if (targetWebrtc && typeof RTCPeerConnection !== 'undefined') {
      let webrtcTimeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19028' }],
        });
        pcRef.current = pc;
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        pc.ontrack = (event) => {
          if (webrtcTimeout) clearTimeout(webrtcTimeout);
          if (!disposed && videoRef.current) {
            webRtcActive = true;
            setIsWebRtc(true);
            
            if (event.streams && event.streams.length > 0) {
              videoRef.current.srcObject = event.streams[0];
            } else {
              const stream = (videoRef.current.srcObject as MediaStream) || new MediaStream();
              stream.addTrack(event.track);
              if (videoRef.current.srcObject !== stream) {
                videoRef.current.srcObject = stream;
              }
            }
            void play();
          }
        };

        const negotiateWebrtc = async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            await new Promise<void>((resolve) => {
              if (pc.iceGatheringState === 'complete') resolve();
              else {
                const checkState = () => {
                  if (pc.iceGatheringState === 'complete') {
                    pc.removeEventListener('icegatheringstatechange', checkState);
                    resolve();
                  }
                };
                pc.addEventListener('icegatheringstatechange', checkState);
                setTimeout(() => {
                  pc.removeEventListener('icegatheringstatechange', checkState);
                  resolve();
                }, 1000);
              }
            });

            let postUrl = targetWebrtc!.replace('ws://', 'http://').replace('wss://', 'https://');
            if (postUrl.includes('/api/ws')) {
              postUrl = postUrl.replace('/api/ws', '/api/webrtc');
            }

            const res = await fetch(postUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/sdp' },
              body: pc.localDescription!.sdp,
            });

            if (!res.ok) throw new Error(`SDP Exchange failed: ${res.status}`);
            
            const answerSdp = await res.text();
            await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
          } catch (e) {
            console.error('[HlsVideoPlayer] WebRTC signaling error:', e);
            if (!webRtcActive) startHls();
          }
        };

        void negotiateWebrtc();

        webrtcTimeout = setTimeout(() => {
          if (!webRtcActive) {
            console.warn('[HlsVideoPlayer] WebRTC connection timeout, falling back to HLS');
            startHls();
          }
        }, 4000);
      } catch {
        startHls();
      }
    } else {
      startHls();
    }

    const watchdog = setInterval(() => {
      if (disposed || video.paused || document.hidden) {
        advancedAt = Date.now();
        return;
      }
      if (hls && Date.now() - playlistAdvancedAt > 20000) {
        setError('Camera không cập nhật segment mới. Hãy TEST CONNECTION lại.');
        return;
      }
      if (video.currentTime > lastTime + 0.05) {
        lastTime = video.currentTime;
        advancedAt = Date.now();
        recoveryAttempts = 0;
        return;
      }
      if (Date.now() - advancedAt < 8000) return;
      const target =
        hls?.liveSyncPosition ??
        (video.seekable.length ? video.seekable.end(video.seekable.length - 1) - 3 : null);
      if (target !== null && Number.isFinite(target) && target > video.currentTime + 0.5) {
        video.currentTime = target;
        hls?.startLoad(target);
        void play();
      } else {
        setError('Video đang chờ dữ liệu mới từ camera.');
      }
      advancedAt = Date.now();
    }, 2000);

    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      disposed = true;
      clearInterval(watchdog);
      clearTimeout(retryTimer);
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('error', onVideoError);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      try { pcRef.current?.close(); } catch {}
      try { wsRef.current?.close(); } catch {}
      pcRef.current = null;
      wsRef.current = null;
      hls?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const jumpToLive = () => {
    const video = videoRef.current;
    if (!video) return;
    const target =
      hlsRef.current?.liveSyncPosition ??
      (video.seekable.length ? video.seekable.end(video.seekable.length - 1) - 1 : null);
    if (target !== null && Number.isFinite(target)) {
      video.currentTime = target;
      hlsRef.current?.startLoad(target);
      void video.play();
    }
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = dataUrl;
    a.download = `FAVIS_Snapshot_${timestamp}.png`;
    a.click();

    setSnapshotMsg('Đã lưu ảnh chụp khung hình!');
    setTimeout(() => setSnapshotMsg(null), 3000);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      void container.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  const isOverlayVisible = showControls || !isPlaying;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative overflow-hidden rounded-xl border border-slate-800 bg-black shadow-2xl select-none"
    >
      {/* HTML5 Video without native controls */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        // @ts-ignore controlsList attribute for IDM/browser download blocking
        controlsList="nodownload noremoteplayback nofootbar"
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        className="aspect-video w-full cursor-pointer bg-black object-contain"
      />

      {/* CCTV Scanlines & Vignette */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 transition-opacity duration-300 ${
          isOverlayVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-5 mix-blend-overlay"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #fff, #fff 1px, transparent 1px, transparent 4px)',
        }}
      />

      {/* CCTV Header Bar */}
      <div
        className={`pointer-events-none absolute top-3 left-3 right-3 z-10 flex items-center justify-between text-xs font-mono transition-opacity duration-300 ${
          isOverlayVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 rounded border border-white/10 bg-black/75 px-2.5 py-1 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="font-bold tracking-wider text-red-400">● LIVE</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-200">FAVIS REALTIME STREAM</span>
        </div>

        <div className="flex items-center gap-2 rounded border border-white/10 bg-black/75 px-2.5 py-1 text-[11px] backdrop-blur-md text-emerald-400">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          <span>{isWebRtc ? 'WEBRTC ULTRA LOW LATENCY' : 'HLS LOW LATENCY'}</span>
        </div>
      </div>

      {/* Play/Pause Overlay Indicator when Paused */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/40 backdrop-blur-xs transition-opacity"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-slate-900/80 text-white shadow-2xl backdrop-blur-md hover:scale-105 transition-transform">
            <Play className="ml-1 h-8 w-8 text-emerald-400" />
          </div>
        </div>
      )}

      {/* Snapshot Toast Feedback */}
      {snapshotMsg && (
        <div className="absolute top-14 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-emerald-500/40 bg-emerald-950/90 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 shadow-xl backdrop-blur-md flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {snapshotMsg}
        </div>
      )}

      {/* Error / Stalled Banner Overlay */}
      {error && (
        <div className="absolute bottom-16 left-3 right-3 z-30 flex items-center justify-between rounded-lg border border-red-800/80 bg-red-950/90 p-3 text-xs text-red-200 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={jumpToLive}
            className="flex items-center gap-1 rounded bg-red-800 px-2.5 py-1 font-semibold text-white hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Thử lại
          </button>
        </div>
      )}

      {/* CCTV Bottom Custom Control Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 py-3 transition-opacity duration-300 ${
          isOverlayVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Left Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            title={isPlaying ? 'Tạm dừng' : 'Phát'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900/80 text-white hover:bg-slate-800 hover:text-emerald-400 transition-colors"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900/80 text-white hover:bg-slate-800 transition-colors"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>

          <button
            type="button"
            onClick={jumpToLive}
            title="Đồng bộ lại sát điểm Live thực tế"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-900/80 transition-colors"
          >
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>Sync Live</span>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={takeSnapshot}
            title="Chụp ảnh khung hình (Snapshot)"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <CameraIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};


