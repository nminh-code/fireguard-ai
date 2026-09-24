# Kế hoạch sửa lỗi Video Player bị đứng im trong khi AI vẫn quét ra lửa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để hiện tượng trình duyệt hiển thị khung hình video bị đứng im (freeze/stalled) trong khi backend AI Pipeline vẫn chạy và quét ra lửa thời gian thực.

**Architecture:** Nâng cấp [`src/components/HlsVideoPlayer.tsx`](file:///d:/FireGuard%20AI/src/components/HlsVideoPlayer.tsx) bằng cách bổ sung theo dõi trạng thái kết nối WebRTC (`RTCPeerConnection`), nâng cấp Watchdog giám sát `video.currentTime` cho cả WebRTC/HLS để tự động reconnect/fallback khi bị đơ, và tự động Sync Live khi nhận tín hiệu cảnh báo mới.

**Tech Stack:** React (TypeScript), WebRTC API (`RTCPeerConnection`), Hls.js, HTML5 Video.

## Global Constraints

- Không làm ảnh hưởng đến độ trễ siêu thấp (Ultra-low latency) của WebRTC khi kết nối bình thường.
- Đảm bảo cơ chế tự động fallback sang HLS diễn ra mượt mà trong vòng 3-4s nếu WebRTC gặp lỗi.

---

### Task 1: Bổ sung lắng nghe sự kiện WebRTC Connection State & ICE State trong HlsVideoPlayer

**Files:**
- Modify: `src/components/HlsVideoPlayer.tsx:162-248`

**Interfaces:**
- Consumes: `pcRef.current` (`RTCPeerConnection`).
- Produces: Tự động phát hiện WebRTC bị rớt (`failed`, `disconnected`, `closed`) và gọi `startHls()` hoặc nạp lại stream.

- [ ] **Step 1: Bổ sung listener `connectionstatechange` và `iceconnectionstatechange`**
  Trong `HlsVideoPlayer.tsx`, lắng nghe khi trạng thái chuyển sang `disconnected` hoặc `failed`:
  ```typescript
  pc.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      console.warn('[HlsVideoPlayer] WebRTC connection lost:', pc.connectionState);
      if (!disposed && webRtcActive) {
        webRtcActive = false;
        setIsWebRtc(false);
        startHls();
      }
    }
  };
  ```

- [ ] **Step 2: Thêm dọn dẹp các listener khi unmount**
  Đảm bảo `pc.onconnectionstatechange = null;` và `pc.oniceconnectionstatechange = null;` trong cleanup function của `useEffect`.

---

### Task 2: Nâng cấp Watchdog giám sát đứng khung hình (Video Frame Stall Detection)

**Files:**
- Modify: `src/components/HlsVideoPlayer.tsx:249-276`

**Interfaces:**
- Consumes: `videoRef.current.currentTime`, `video.paused`, `document.hidden`.
- Produces: Phát hiện video đứng im > 4s dù đang ở trạng thái play, tự động tái kết nối WebRTC / HLS.

- [ ] **Step 1: Cập nhật logic Watchdog trong `useEffect`**
  Thêm biến đếm số lần video không tiến triển (`currentTime` giữ nguyên):
  ```typescript
  if (video.currentTime > lastTime + 0.05) {
    lastTime = video.currentTime;
    advancedAt = Date.now();
    recoveryAttempts = 0;
    return;
  }
  
  // Nếu video đang play mà currentTime đứng yên > 4 giây
  if (Date.now() - advancedAt > 4000) {
    console.warn('[HlsVideoPlayer] Video playback frozen detected. Reconnecting stream...');
    advancedAt = Date.now();
    if (isWebRtc) {
      // Re-negotiate WebRTC hoặc fallback sang HLS
      webRtcActive = false;
      setIsWebRtc(false);
      try { pcRef.current?.close(); } catch {}
      startHls();
    } else if (hls) {
      jumpToLive();
    }
  }
  ```

---

### Task 3: Thử nghiệm và xác minh

**Files:**
- Test: Build frontend (`npm run build` hoặc test trong môi trường dev).

- [ ] **Step 1: Kiểm tra build TypeScript**
  Command: `npx tsc --noEmit`
  Expected: Không phát sinh lỗi type trong `HlsVideoPlayer.tsx`.

- [ ] **Step 2: Xác minh hoạt động của player**
  Chạy ứng dụng và kiểm tra stream không còn bị đơ khi AI phát hiện lửa.
