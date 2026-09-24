import Hls, { FetchLoader } from 'hls.js';
import React, { useEffect, useRef, useState } from 'react';

interface HlsVideoPlayerProps {
  src: string;
}

export const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

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
    // A new src always starts with a fresh MediaSource and empty buffers.
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.muted = true;
    const play = () => video.play().catch(() => {
      if (!disposed) setError('Trình duyệt chưa cho tự phát. Bấm Play để xem camera.');
    });
    const onPlaying = () => {
      advancedAt = Date.now();
      setError(null);
    };
    const onVideoError = () => setError('Trình duyệt không giải mã được luồng video.');
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onVideoError);

    if (Hls.isSupported()) {
      hls = new Hls({
        loader: FetchLoader,
        fetchSetup: (context, init) => new Request(context.url, { ...init, cache: 'no-store' }),
        startPosition: -1,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        maxLiveSyncPlaybackRate: 1.2,
        backBufferLength: 12,
        enableWorker: true,
      });
      const instance = hls;
      instance.on(Hls.Events.MEDIA_ATTACHED, () => instance.loadSource(src));
      instance.on(Hls.Events.MANIFEST_PARSED, play);
      instance.on(Hls.Events.LEVEL_UPDATED, (_event, { details }) => {
        // endSN advances even before a short live playlist starts sliding.
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
      // Recover a stalled playhead at the current live edge, not segment zero.
      const target = hls?.liveSyncPosition ??
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

    return () => {
      disposed = true;
      clearInterval(watchdog);
      clearTimeout(retryTimer);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onVideoError);
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-black">
      <video ref={videoRef} controls muted autoPlay playsInline className="aspect-video w-full bg-black object-contain" />
      {error && <div className="border-t border-red-900 bg-red-950 p-3 text-xs text-red-200">{error}</div>}
    </div>
  );
};
