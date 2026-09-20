import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, Flame, Radio, RefreshCw, ShieldAlert, Wind } from 'lucide-react';
import { HlsVideoPlayer } from '../components/HlsVideoPlayer';
import { cameraSessionStore } from '../services/cameraSessionStore';
import {
  AlertHistoryResponse,
  LatestAlertResponse,
  MonitoringAlert,
  formatMonitoringTime,
  getAlertHistory,
  getLatestAlert,
} from '../services/monitoringAlertService';

const POLL_INTERVAL_MS = 2500;
const REQUEST_TIMEOUT_MS = 5000;

function AlertTypeIcon({ type }: { type: MonitoringAlert['class'] }) {
  return type === 'fire' ? <Flame className="h-6 w-6" /> : <Wind className="h-6 w-6" />;
}

export const MonitoringView: React.FC = () => {
  const cameraSession = useSyncExternalStore(
    cameraSessionStore.subscribe,
    cameraSessionStore.getSnapshot
  );
  const [history, setHistory] = useState<AlertHistoryResponse | null>(null);
  const [latest, setLatest] = useState<MonitoringAlert | null>(null);
  const [newAlertId, setNewAlertId] = useState<string | null>(null);
  const [connection, setConnection] = useState<'loading' | 'connected' | 'error'>('loading');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const latestId = useRef<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activeController: AbortController | undefined;

    const request = async <T,>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      const controller = new AbortController();
      activeController = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try { return await operation(controller.signal); }
      finally {
        clearTimeout(timeout);
        if (activeController === controller) activeController = undefined;
      }
    };

    const refreshHistory = async () => {
      const data = await request(getAlertHistory);
      if (!disposed) setHistory(data);
      return data;
    };

    const poll = async () => {
      if (disposed) return;
      if (document.hidden) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }
      try {
        const current: LatestAlertResponse = await request(getLatestAlert);
        if (disposed) return;
        const currentId = current.alert?.id ?? null;
        setLatest(current.alert);
        setHistory(previous => previous ? {
          ...previous,
          cameraId: current.cameraId,
          sessionId: current.sessionId,
          pipelineState: current.pipelineState,
        } : previous);
        if (initialized.current && currentId && currentId !== latestId.current) setNewAlertId(currentId);
        if (!initialized.current || currentId !== latestId.current) await refreshHistory();
        latestId.current = currentId;
        initialized.current = true;
        setConnection('connected');
        setLastUpdated(new Date().toISOString());
      } catch {
        if (!disposed) setConnection('error');
      } finally {
        if (!disposed) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    timer = setTimeout(poll, 0);
    return () => {
      disposed = true;
      clearTimeout(timer);
      activeController?.abort();
    };
  }, []);

  const pipelineState = history?.pipelineState ?? 'IDLE';
  const alerts = history?.alerts ?? [];

  return (
    <div className="space-y-6" id="monitoring-view">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-red-600" />
              <h1 className="text-xl font-black text-slate-900 md:text-2xl">Màn hình giám sát</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">Cảnh báo FIRE/SMOKE từ YOLO camera thật</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <Radio className={`h-4 w-4 ${connection === 'connected' ? 'text-emerald-600' : connection === 'error' ? 'text-red-600' : 'text-amber-600'}`} />
            <span className="font-semibold text-slate-700">
              {connection === 'loading' ? 'Đang kết nối Alert API' : connection === 'error' ? 'Mất kết nối Alert API' : `Pipeline: ${pipelineState}`}
            </span>
          </div>
        </div>
        {connection === 'error' && (
          <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Không đọc được backend tại 127.0.0.1:8790. Màn hình sẽ tự thử lại; lịch sử đang hiển thị có thể đã cũ.
          </div>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900">Camera Live</h2>
          {cameraSession.activeStream?.connected && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              ONLINE
            </span>
          )}
        </div>

        {cameraSession.activeStream ? (
          <>
            <HlsVideoPlayer src={cameraSession.activeStream.playbackUrl} />
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              <span>Camera: <strong className="text-slate-900">{cameraSession.activeStream.cameraName}</strong></span>
              <span>ID: <strong className="text-slate-900">{cameraSession.activeStream.cameraId}</strong></span>
              <span>Status: <strong className="text-emerald-600">{cameraSession.activeStream.status}</strong></span>
            </div>
          </>
        ) : (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            Chưa có camera được kết nối. Hãy TEST CONNECTION trong Camera Test.
          </p>
        )}
      </section>

      {latest ? (
        <section className={`rounded-xl border-2 p-5 shadow-md ${latest.class === 'fire' ? 'border-red-600 bg-red-50' : 'border-amber-500 bg-amber-50'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${latest.class === 'fire' ? 'bg-red-600' : 'bg-amber-600'}`}>
                <AlertTypeIcon type={latest.class} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-black tracking-wider text-white">{latest.class.toUpperCase()}</span>
                  {newAlertId === latest.id && <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">CẢNH BÁO MỚI</span>}
                </div>
                <p className="mt-3 font-bold text-slate-900">Camera: {latest.cameraId}</p>
                <p className="mt-1 text-sm text-slate-700">Confidence: <strong>{(latest.confidence * 100).toFixed(1)}%</strong></p>
                <time className="mt-1 block text-sm text-slate-600" dateTime={latest.timestamp}>{formatMonitoringTime(latest.timestamp)}</time>
              </div>
            </div>
            <div className="rounded-lg border border-black/10 bg-white/70 p-3 text-xs text-slate-600">
              <div>Sequence: {latest.sequence}</div>
              <div className="mt-1">Bounding box (xyxy): [{latest.box.map(value => value.toFixed(1)).join(', ')}]</div>
              <div className="mt-1">Frame: {latest.width} × {latest.height}</div>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-slate-400" />
          <div>
            <h2 className="font-bold text-slate-900">Chưa có cảnh báo từ backend</h2>
            <p className="mt-1 text-sm text-slate-500">Trạng thái này chỉ cho biết danh sách alert đang trống; không thay thế việc kiểm tra camera và pipeline.</p>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-900">Lịch sử cảnh báo</h2>
            <p className="mt-1 text-xs text-slate-500">Tối đa 20 alert gần nhất, mới nhất ở trên</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className={`h-3.5 w-3.5 ${connection === 'loading' ? 'animate-spin' : ''}`} />
            {lastUpdated ? `Cập nhật: ${formatMonitoringTime(lastUpdated)}` : 'Chưa cập nhật'}
          </div>
        </div>

        {alerts.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2">Loại</th><th className="px-3 py-2">Camera</th><th className="px-3 py-2">Confidence</th><th className="px-3 py-2">Thời gian</th><th className="px-3 py-2">Sequence</th><th className="px-3 py-2">Bounding box</th></tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3"><span className={`rounded px-2 py-1 text-xs font-black text-white ${alert.class === 'fire' ? 'bg-red-600' : 'bg-amber-600'}`}>{alert.class.toUpperCase()}</span></td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{alert.cameraId}</td>
                    <td className="px-3 py-3 tabular-nums">{(alert.confidence * 100).toFixed(1)}%</td>
                    <td className="px-3 py-3 whitespace-nowrap"><time dateTime={alert.timestamp}>{formatMonitoringTime(alert.timestamp)}</time></td>
                    <td className="px-3 py-3 tabular-nums">{alert.sequence}</td>
                    <td className="px-3 py-3 font-mono text-xs">[{alert.box.map(value => value.toFixed(1)).join(', ')}]</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Không có alert trong lịch sử backend.</p>
        )}
        {history && history.totalCreated > history.retained && (
          <p className="mt-3 text-xs text-amber-700">Backend đã tạo {history.totalCreated} alert và đang giữ {history.retained}/{history.capacity} alert trong RAM.</p>
        )}
      </section>
    </div>
  );
};
