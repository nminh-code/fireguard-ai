import Hls from 'hls.js';
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

    setError(null);
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.play().catch(() => undefined);
      return () => {
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    }

    if (!Hls.isSupported()) {
      setError('Trình duyệt này không hỗ trợ phát HLS.');
      return;
    }

    const hls = new Hls({
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 5,
      enableWorker: true,
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => undefined);
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setError(`Không thể phát video live (${data.type}).`);
    });

    return () => hls.destroy();
  }, [src]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-black">
      <video ref={videoRef} controls muted autoPlay playsInline className="aspect-video w-full bg-black object-contain" />
      {error && <div className="border-t border-red-900 bg-red-950 p-3 text-xs text-red-200">{error}</div>}
    </div>
  );
};
