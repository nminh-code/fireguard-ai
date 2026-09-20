# AI frame pipeline + YOLO fire/smoke

Camera `/onvif2` → một FFmpeg của AI → RGB24 → latest-frame queue → worker → một Python/Ultralytics → API status.

Video-bridge/HLS/Camera Test không thay đổi. YOLO chỉ nhận bytes qua stdin, không mở RTSP, không lưu ảnh. Nhánh AI dùng kết nối RTSP đã có của pipeline; HLS vẫn có kết nối riêng theo kiến trúc hiện tại. Không tự retry hoặc mở thêm kết nối để fallback transport.

## Chạy

Cấu hình backend trong `.env.ai.local` (không commit):

- `AI_RTSP_URL`: URL không chứa credential, đường dẫn `/onvif2`.
- `AI_CAMERA_USERNAME`, `AI_CAMERA_PASSWORD`: thông tin camera; không log hoặc gửi vào worker.
- `AI_FFMPEG_PATH`, `AI_PYTHON_PATH`: executable đã cài trên máy.
- `AI_MODEL_PATH=models/best.pt`: mặc định trỏ tới model trong project, độc lập working directory.
- `AI_CONFIDENCE=0.5`.
- `AI_MODEL_LOAD_TIMEOUT_MS=120000`: timeout tải model và warmup.
- `AI_PROCESS_TIMEOUT_MS`: timeout inference từng frame, mặc định 30000 ms.
- `AI_RTSP_TRANSPORT=udp`: giữ cấu hình transport hiện tại; hỗ trợ `tcp` nếu camera/mạng yêu cầu.

Sau khi đổi code, dừng và chạy lại terminal **AI frame service** để nạp code mới:

```powershell
npm run ai:frames
```

Terminal khác:

```powershell
npm run ai:frames:start
npm run ai:frames:status
npm run ai:frames:stop
```

Không cần restart video-bridge/HLS/React. Start là idempotent, không tạo thêm FFmpeg khi đang CONNECTING/RUNNING. Stop chỉ dừng FFmpeg/worker/Python thuộc pipeline AI.

## API và kết quả

API chỉ bind `127.0.0.1:8790`, không auto-start. POST cần JSON `{}`.

| Endpoint | Nội dung |
|---|---|
| `GET /health` | FFmpeg có sẵn, có inference thành công trong session hay chưa |
| `POST /v1/pipeline/start` | Bắt đầu lấy frame |
| `POST /v1/pipeline/stop` | Dừng pipeline AI |
| `GET /v1/pipeline/status` | Frame counters, processor, kết quả gần nhất |
| `GET /v1/frames/latest` | RGB24 mới nhất hoặc 503 nếu không còn frame live |

`processor.name` luôn là `yolo-fire-smoke`. State tải model là `LOADING`, sau warmup là `READY`; chỉ sau xử lý thành công frame nguồn mới có `inferencePerformed: true`. Một frame không có detection vẫn là inference thành công. Warmup không được tính vào số frame hoặc inferencePerformed.

Ví dụ cấu trúc `processor.lastResult` (minh hoạ, không phải detection camera đã xác minh):

```json
{
  "processor": "yolo-fire-smoke",
  "inferencePerformed": true,
  "sequence": 42,
  "timestamp": "2026-09-19T00:00:00.000Z",
  "boxFormat": "xyxy",
  "detections": [
    {
      "class": "fire",
      "confidence": 0.91,
      "box": [10, 20, 100, 200],
      "sequence": 42,
      "timestamp": "2026-09-19T00:00:00.000Z"
    }
  ]
}
```

Class chỉ gồm `fire`/`smoke`; model được kiểm tra tên class khi load. Box là `[x1,y1,x2,y2]` theo pixel trên frame RGB đã scale/pad (mặc định 640×720), không phải kích thước RTSP gốc. Timestamp là lúc backend nhận đủ frame, không phải giờ camera chụp. Kết quả còn có cameraId, width, height, sessionId và processedAt. Sequence bắt đầu lại cho mỗi session. `lastResult` là kết quả gần nhất của session, có thể cũ sau STOPPED/FAILED; luôn kiểm tra state/timestamp trước khi dùng như dữ liệu live.

Ultralytics nhận NumPy theo BGR; adapter chuyển RGB24 → BGR trước khi predict ([tài liệu](https://docs.ultralytics.com/modes/predict/)).

## Queue, vòng đời và chẩn đoán

- Chỉ một inference đang chạy, tối đa một frame pending. Frame mới thay frame pending cũ. Khi model đang load, chỉ giữ frame mới nhất, chưa gửi frame sang Python.
- Python tải model một lần mỗi session; worker không thừa hưởng toàn bộ env, chỉ các biến runtime cần thiết. Model options truyền qua workerData.
- Python exit, spawn/pipe/protocol/inference lỗi đều reject; không coi `{ok:false}` là inference thành công.
- Stop/timeout đóng Python trước khi terminate worker, có fallback dừng PID Python thuộc worker đó.
- Processor FAILED không dừng ingest; latest-frame API vẫn hoạt động, queue đóng để không tích backlog. Stop/start để khởi tạo lại.
- `receivedFrames=0` nghĩa là FFmpeg chưa cung cấp đủ một frame RGB, độc lập YOLO. `receivedBytes` cho biết có byte/partial frame hay không.
- `NO_FRAMES_TIMEOUT`: không nhận đủ frame trong connect timeout (mặc định 25 giây). `FRAME_STALLED`: ngừng nhận frame sau khi đã RUNNING.
- `diagnostic` chỉ trả mã cố định khi FFmpeg báo lỗi, như RTSP_AUTH_FAILED, RTSP_TIMEOUT, RTSP_CONNECTION_REFUSED, RTSP_TRANSPORT_UNSUPPORTED. Null nghĩa là chưa có thông báo khớp, không có nghĩa kết nối đã thành công.
- Không log stderr FFmpeg/Python, RTSP URL hoặc credential. Không thay đổi decoder và không tạo thư mục snapshot.

## Kiểm tra

```powershell
npm run test:ai
npm run lint
npm run build
```

Unit tests không cần Python/camera, kiểm tra framing, queue, lỗi IPC, lifecycle, status và credential isolation. Chạy thêm integration test với Python/FFmpeg thật và model local (nguồn ảnh kiểm thử FFmpeg, không kết nối camera):

```powershell
$env:AI_TEST_YOLO='1'
npm run test:ai
Remove-Item Env:AI_TEST_YOLO
```

Kiểm tra camera thật: start rồi xem status trong 30–60 giây. Cần `RUNNING`, receivedFrames/processedFrames tăng và inferencePerformed=true. Đồng thời kiểm tra HLS tiếp tục live. Nếu RTSP không reachable, unit/model tests thành công không chứng minh nguồn camera hoạt động.
