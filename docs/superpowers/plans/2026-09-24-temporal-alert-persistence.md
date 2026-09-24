# Implementation Plan: Lọc Báo Động Giả Lửa & Khói Theo Thời Gian (Temporal Persistence Filter)

Mục tiêu: Triệt tiêu các báo động giả (bật/tắt đèn, bóng phản chiếu, nhấp nháy camera, nhiễu 1-2 frame) bằng cách tăng tốc độ quét lên **5 FPS** và chỉ xác nhận Cảnh báo khi Lửa/Khói duy trì xuất hiện ở ít nhất **10 / 15 khung hình liên tiếp** (~3 giây).

---

## 🏗️ Kiến Trúc Tổng Quan

```
[ Camera IP (RTSP) ]
         │
         ▼ (5 FPS Frame Extractor)
┌─────────────────────────────────────────────────────────────────┐
│                     AI Pipeline (YOLO PyTorch)                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼ (Frame Inference Results: Fire / Smoke / None)
┌─────────────────────────────────────────────────────────────────┐
│     TemporalAlertFilter (Sliding Window Buffer: Size = 15)      │
│     - Giữ kết quả của 15 khung hình gần nhất                     │
│     - Kiểm tra: hitCount (Fire/Smoke) >= 10                       │
└─────────────────────────────────────────────────────────────────┘
         │
         ├──(Đủ >= 10/15 frames)───> [ Phát Cảnh Báo (Alert API / Audio) ]
         │
         └──(Dưới < 10/15 frames)───> [ Gạt Bỏ Báo Động Giả (Noise Filtered) ]
```

---

## 📋 Các Bước Thực Thi Chi Tiết

### Bước 1: Cấu Hình Tốc Độ Quét Khung Hình (5 FPS)
* Chỉnh sửa file [`.env.ai.local`](file:///d:/FireGuard%20AI/.env.ai.local):
  - Đặt `AI_FRAME_FPS=5`
  - Đặt `AI_TARGET_FPS=5`
* Đồng bộ ghi chú trong file [`.env.ai.example`](file:///d:/FireGuard%20AI/.env.ai.example).

### Bước 2: Triển Khai Module `TemporalAlertFilter`
* Trong file [`ai-pipeline/alert-store.mjs`](file:///d:/FireGuard%20AI/ai-pipeline/alert-store.mjs):
  - Xây dựng lớp `TemporalAlertFilter` với bộ đệm `history` theo dõi từng loại cảnh báo (`fire`, `smoke`).
  - Lưu giữ lịch sử 15 khung hình gần nhất (`windowSize = 15`).
  - Hàm `pushAndCheck(classType, detected)` đếm tổng số frame phát hiện và trả về `true` khi `hitCount >= 10`.

### Bước 3: Tích Hợp Vào `AlertStore` Xuất Bản Sự Kiện Cảnh Báo
* Trong constructor của `AlertStore`:
  - Khởi tạo bộ lọc `this.temporalFilter = new TemporalAlertFilter(15, 10)`.
* Trong phương thức `record(result, frame)`:
  - Khi YOLO phân tích được phát hiện (`fire` hoặc `smoke`), truyền kết quả qua `this.temporalFilter.pushAndCheck(detection.class, true)`.
  - Chỉ khi hàm trả về `true` (đã duy trì đủ 10/15 frames), sự kiện mới được nạp vào `this.events` và tiến hành thông báo.

### Bước 4: Viết Unit Test Kiểm Thử Tự Động
* Cập nhật file [`ai-pipeline/tests/pipeline.test.mjs`](file:///d:/FireGuard%20AI/ai-pipeline/tests/pipeline.test.mjs):
  - Test case 1: Gửi 1-5 frames phát hiện lửa (nhiễu ngắn) $\rightarrow$ Xác minh **KHÔNG** phát alert.
  - Test case 2: Gửi đủ 10-15 frames phát hiện lửa duy trì $\rightarrow$ Xác minh **CÓ** phát alert chính xác.

---

## 🧪 Quy Trình Kiểm Thử (Verification Plan)
1. **Kiểm tra Unit Tests:** Chạy `node --test ai-pipeline/tests/pipeline.test.mjs` đảm bảo tất cả 30+ bài test đều PASS.
2. **Kiểm tra Khả Năng Lọc Nhiễu:** Giả lập tín hiệu chớp sáng/nhiễu đơ 1–2 giây $\rightarrow$ Xác minh hệ thống im lặng (không báo động giả).
3. **Kiểm tra Xác Nhận Lửa Thật:** Rọi lửa/khói liên tục trong 3 giây $\rightarrow$ Hệ thống phát cảnh báo chuẩn xác.
