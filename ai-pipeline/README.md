# Backend lấy frame cho AI

HLS hiện tại giữ nguyên. Backend này độc lập, không đọc playlist/segment HLS,
không chụp trình duyệt, không ghi ảnh ra đĩa và chưa chạy model khói/lửa.

```text
Camera /onvif2 ── RTSP ── FFmpeg bridge hiện tại ── HLS ── React
       │
       └──────── RTSP ── FFmpeg riêng (1 decoder thread)
                         │ chọn tối đa 1 frame/s, RGB24 640×720
                         ▼
                    RawFrameDecoder (ghép chunk stdout)
                         ├── latest frame trong RAM ── GET /v1/frames/latest
                         └── LatestFrameQueue ── worker thread ── frame-probe
                             1 đang xử lý + 1 chờ               metadata/checksum
```

## Chạy trên Windows

Từ thư mục gốc, tạo `.env.ai.local` bằng cách copy `.env.ai.example` nếu chưa có.
Điền `AI_CAMERA_USERNAME` và `AI_CAMERA_PASSWORD` bằng editor cục bộ; không đưa
credential vào source code, terminal command, chat hoặc RTSP URL trong React.
Giá trị chứa `#`/khoảng trắng cần đặt trong dấu nháy theo cú pháp dotenv.

```dotenv
AI_RTSP_URL=rtsp://192.168.1.5:554/onvif2
```

Giữ URL ONVIF2 hiện tại. Nếu FFmpeg không nằm trong PATH, đặt `AI_FFMPEG_PATH`
trỏ tới executable thực tế, ví dụ `D:/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe`.
Biến môi trường đã có trong shell được ưu tiên hơn `.env.ai.local`.

Terminal riêng, không cần dừng HLS/React:

```powershell
npm run ai:frames
```

Service khởi động ở trạng thái `IDLE`, chưa kết nối camera. Từ terminal khác:

```powershell
npm run ai:frames:start
npm run ai:frames:status
npm run ai:frames:stop
```

`start` trả `202 CONNECTING`; chỉ khi nhận đủ một frame thật mới chuyển `RUNNING`.
`processedFrames` chỉ tăng khi worker thực sự xử lý xong. `start` khi đang chạy
là idempotent, không mở thêm kết nối. Sau khi stop hoặc fail, start tạo session
mới, không trả frame cũ. Không tự reconnect để tránh vòng lặp làm quá tải camera.

## HTTP API local — cổng 8790

| Method/path | Nội dung |
|---|---|
| `GET /health` | Backend/FFmpeg sẵn sàng; không có nghĩa camera đã kết nối |
| `POST /v1/pipeline/start` | Body `{}`, cấu hình/credential đọc từ backend |
| `POST /v1/pipeline/stop` | Dừng duy nhất FFmpeg và worker thuộc backend này |
| `GET /v1/pipeline/status` | Trạng thái, session, số frame, tuổi frame, worker/checksum |
| `GET /v1/frames/latest` | Buffer RGB24 mới nhất hoặc `503 NO_FRESH_FRAME` |

POST cần `Content-Type: application/json`. Service chỉ bind `127.0.0.1`, không
bật CORS cho web khác và không cần proxy Vite. Đây là API phát triển local; chưa
có xác thực để triển khai public/LAN. Mọi response dùng `Cache-Control: no-store`.

Frame API trả `application/octet-stream`, **không phải JPEG**. Header gồm
`X-Frame-Format`, `X-Frame-Width`, `X-Frame-Height`, `X-Frame-Sequence`,
`X-Frame-Received-At`, `X-Frame-Session-Id`. Mỗi frame mặc định có
`640 * 720 * 3 = 1,382,400 bytes`, layout `[height, width, 3]`, thứ tự **RGB**,
row-major. Nếu nguồn có kích thước khác, scale giữ tỷ lệ và pad vào kích thước
cấu hình. Timestamp là lúc backend nhận đủ frame, không phải giờ chụp của camera.
Sequence thuộc từng session; nhiều GET trong một giây có thể nhận cùng sequence.

## Điểm thay module khi tích hợp model sau này

`processor-worker.mjs` hiện import `processFrame` từ `processors/frame-probe.mjs`.
Thay import đó bằng adapter model; tải model một lần ở mức module. Contract:

```js
export async function processFrame(frame) {
  // frame.data: Uint8Array RGB24
  // frame.width, height, pixelFormat, sequence, receivedAt, cameraId, sessionId
  // Return a small structured-clone-compatible object. No frame buffer in result.
}
```

Worker không nhận URL/credential và không thừa hưởng env chứa password. Dữ liệu
frame được copy một lần rồi transfer cho worker, để API vẫn giữ buffer gốc.
Không tạo worker cho mỗi frame. Model CPU-bound không được chạy trong event loop
của API. Nếu sau này dùng Python/GPU service, thay `ProcessorClient` bằng adapter
IPC tương ứng, giữ contract frame và chính sách hàng đợi.

`frame-probe` chỉ xác nhận số byte và SHA-256 của frame thật; luôn trả
`inferencePerformed: false`, không sinh kết quả phát hiện khói/lửa. Checksum thay
đổi là dấu hiệu nội dung thay đổi, không phải thước đo nhận diện.

## Giới hạn tải và lỗi

- Mặc định tối đa 1 FPS, cấu hình 0.2–5 FPS; tối đa 640×720. Bộ chọn frame bỏ bớt
  frame camera, không thêm frame lặp để bù thời gian.
- Chỉ một FFmpeg ingest và một worker cho backend này. Decoder/encoder/filter
  giới hạn một thread. Queue giữ một frame chờ, luôn ưu tiên frame mới nhất.
- RAM không tăng theo thời gian: frame mới nhất, một frame đang ghép, một đang
  xử lý, một chờ và bản copy worker; không có thư mục snapshot hoặc lưu lịch sử.
- Worker quá thời gian (mặc định 5 giây) hoặc lỗi: processor `FAILED`; ingest và
  latest-frame API vẫn hoạt động. Stop/start để khởi tạo lại worker. Worker có
  giới hạn JS heap 128 MB; không phải giới hạn cứng tổng RAM/native allocation
  của model tương lai.
- Không nhận frame đầu trong 25 giây: `NO_FRAMES_TIMEOUT`. Sau khi đang chạy,
  15 giây không có frame mới: `FRAME_STALLED`. FFmpeg thoát: `RTSP_ENDED`.
  Thất bại không trả lại ảnh cũ như frame live.
- Không log stderr FFmpeg, URL, password, request body hoặc exception model.
  Không lưu credential vào localStorage/ảnh/log. Credential chỉ nằm trong env
  backend và tham số tiến trình FFmpeg; admin máy vẫn có thể đọc chúng qua OS.

## Kiểm chứng đồng thời với HLS thật

Một kết nối RTSP thứ hai vẫn tiêu thụ thêm băng thông và session của camera.
Lấy 1 FPS chỉ giảm tải bước xử lý phía sau, không giảm FPS RTSP truyền tới FFmpeg.
Không thể cam kết camera Yoosee hỗ trợ hai phiên chỉ bằng việc tách tiến trình.

1. Giữ HLS/React hiện tại đang chạy, ghi nhận playlist/session và video live.
2. Chạy service này, bấm lệnh start bằng cấu hình thật trong `.env.ai.local`.
3. Kiểm tra status nhiều lần trong 30–60 giây: `RUNNING`, `receivedFrames` và
   `processedFrames` tăng, `lastFrameAgeMs` thấp; đổi góc camera để checksum thay đổi.
4. Đồng thời xác nhận hình React vẫn chuyển động, HLS segment mới vẫn xuất hiện.
5. Chạy stop: frame API phải trả 503, còn HLS vẫn chạy cùng session.
6. Start lại: nhận session mới, sequence mới và frame thật mới.

Nếu HLS bị ảnh hưởng, **dừng nhánh frame** ngay bằng `npm run ai:frames:stop`.
Không tăng retry, không tự đổi camera URL hoặc sửa bridge đang ổn. Khi đó cần
thống nhất một RTSP relay chia một nguồn cho hai consumer; relay không nằm trong
thay đổi này vì yêu cầu giữ nguyên HLS hiện tại.

## Kiểm thử mã

```powershell
npm run test:ai
npm run lint
npm run build
```

Unit tests kiểm tra byte framing, queue, credential isolation và vòng đời process.
Các buffer kiểm thử giao thức không được dùng làm nguồn camera trong runtime.
Test chạy không tự kết nối RTSP và không dừng HLS. Kiểm thử unit/build thành công
không thay thế kiểm chứng hai luồng với camera thật theo các bước trên.

Tham khảo: [FFmpeg select](https://ffmpeg.org/ffmpeg-filters.html#select_002c-aselect),
[rawvideo](https://ffmpeg.org/ffmpeg-formats.html#rawvideo),
[Node worker threads](https://nodejs.org/api/worker_threads.html).
