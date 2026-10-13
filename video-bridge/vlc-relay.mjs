import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';

export function findVlc(env = process.env) {
  const custom = String(env.VLC_PATH || '').trim().replace(/^"+|"+$/g, '');
  if (custom) return existsSync(custom) ? custom : null;
  for (const file of ['D:/VLC/vlc.exe', 'C:/Program Files/VideoLAN/VLC/vlc.exe',
    'C:/Program Files (x86)/VideoLAN/VLC/vlc.exe']) {
    if (existsSync(file)) return file;
  }
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['vlc'],
    { windowsHide: true, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : null;
}

export function vlcArgs(source, port, { transport = 'udp', cachingMs = 1000, fps = 15 } = {}) {
  if (!['udp', 'tcp'].includes(transport) || !Number.isInteger(port) || port < 1024 || port > 65535 ||
    !Number.isInteger(cachingMs) || cachingMs < 0 || cachingMs > 10000 ||
    !Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('Cấu hình VLC không hợp lệ.');
  return ['--intf=dummy', '--ignore-config', '--no-one-instance', '--no-media-library',
    '--no-video-title-show', '--no-audio', '--no-sout-audio', '--quiet',
    transport === 'tcp' ? '--rtsp-tcp' : '--no-rtsp-tcp',
    `--network-caching=${cachingMs}`, '--avcodec-hw=none', '--avcodec-threads=2', '--http-host=127.0.0.1',
    '--clock-jitter=0', '--clock-synchro=0', '--sout-mux-caching=0',
    '--sout', `#transcode{vcodec=h264,venc=x264{preset=veryfast,tune=zerolatency,keyint=${fps},min-keyint=${fps},scenecut=0},vb=2000,fps=${fps}}:standard{access=http,mux=ts,dst=127.0.0.1:${port}/live.ts}`,
    '--sout-keep', source];
}

async function localPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

export class VlcRelay {
  constructor({ executable, source, transport, cachingMs, fps, spawnProcess = spawn,
    allocatePort = localPort, fetchStream = fetch, killMs = 3000 }) {
    Object.assign(this, { executable, source, transport, cachingMs, fps, spawnProcess,
      allocatePort, fetchStream, killMs });
    this.stopped = false;
    this.closed = true;
    this.ready = false;
  }

  async start(timeoutMs = 45000) {
    if (this.stopped) throw new Error('Phiên VLC đã dừng.');
    const port = await this.allocatePort();
    if (this.stopped) throw new Error('Phiên VLC đã dừng.');
    this.url = `http://127.0.0.1:${port}/live.ts`;
    this.child = this.spawnProcess(this.executable,
      vlcArgs(this.source, port, this), { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    this.closed = false;
    this.closePromise = new Promise(resolve => this.child.once('close', () => {
      this.closed = true;
      this.ready = false;
      this.abort?.abort();
      resolve();
    }));
    this.child.once('error', () => { this.spawnFailed = true; this.abort?.abort(); });
    // VLC/FFmpeg diagnostics can include the credentialed source. Never retain them.
    this.child.stderr.on('data', () => {});
    const deadline = Date.now() + timeoutMs;
    while (!this.stopped && !this.closed && !this.spawnFailed && Date.now() < deadline) {
      this.abort = new AbortController();
      const timer = setTimeout(() => this.abort.abort(), Math.min(3000, deadline - Date.now()));
      try {
        const response = await this.fetchStream(this.url, { signal: this.abort.signal });
        if (response.ok && response.body) {
          const reader = response.body.getReader();
          try {
            const { value, done } = await reader.read();
            // A listening HTTP port alone does not prove VLC has received video.
            if (!done && value?.length >= 188 && value[0] === 0x47 && !this.closed && !this.stopped) {
              this.ready = true;
              return this.url;
            }
          } finally { await reader.cancel().catch(() => {}); }
        } else { await response.body?.cancel(); }
      } catch { /* VLC may still be waiting for the camera's HEVC parameter sets. */ }
      finally { clearTimeout(timer); }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error(this.spawnFailed ? 'Không khởi chạy được VLC.' :
      'VLC chưa nhận được video hợp lệ từ camera. Kiểm tra RTSP và kết nối mạng.');
  }

  async stop() {
    this.stopped = true;
    this.ready = false;
    this.abort?.abort();
    this.source = '';
    if (!this.child || this.closed) return;
    const wait = async () => {
      let timer;
      const closed = await Promise.race([this.closePromise.then(() => true),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), this.killMs); })]);
      clearTimeout(timer);
      return closed;
    };
    this.child.kill('SIGTERM');
    if (await wait()) return;
    this.child.kill('SIGKILL');
    if (!await wait()) throw new Error('VLC cũ chưa dừng; không thể thay thế phiên.');
  }
}
