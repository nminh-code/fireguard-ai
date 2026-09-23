<div align="center">

# 🔥 FireGuard AI
### Hệ Thống Trợ Lý Ứng Phó Sự Cố & Cảnh Báo Cháy Thông Minh

Dự án ứng dụng trí tuệ nhân tạo hỗ trợ đánh giá rủi ro hỏa hoạn, phân loại mức độ khẩn cấp và cung cấp kịch bản ứng cứu sinh tồn thời gian thực được hỗ trợ bởi **Google Gemini API**.

---

<!-- Shields / Badges -->
<p>
  <a href="https://github.com/nminh-code/fireguard-ai/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License">
  </a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/AI%20Engine-Google%20Gemini-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini AI">
  <img src="https://img.shields.io/badge/Stack-React%20%7C%20TypeScript%20%7C%20Tailwind-blue?style=flat-square" alt="Stack">
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square" alt="PRs Welcome">
</p>

[🌐 Trải Nghiệm Trên Google AI Studio](https://ai.studio/apps/ec2d3540-a6e6-4a9f-85e9-90ce7f7e6f23) • [📖 Xem Demo Code](https://github.com/nminh-code/fireguard-ai) • [🐛 Báo Cáo Sự Cố](https://github.com/nminh-code/fireguard-ai/issues)

</div>

---

## 📑 Mục Lục
- [Tổng Quan](#-tổng-quan)
- [Tính Năng Chính](#-tính-năng-chính)
- [Công Nghệ Sử Dụng](#-công-nghệ-sử-dụng)
- [Cấu Trúc Thư Mục](#-cấu-trúc-thư-mục)
- [Bắt Đầu & Cài Đặt](#-bắt-đầu--cài-đặt)
- [Cấu Hình Môi Trường](#-cấu-hình-môi-trường)
- [Kịch Bản Ứng Dụng](#-kịch-bản-ứng-dụng)
- [Lộ Trình Phát Triển](#-lộ-trình-phát-triển)
- [Đóng Góp](#-đóng-góp)
- [Giấy Phép](#-giấy-phép)

---

## 📌 Tổng Quan

Hầu hết các trường hợp thương vong trong hỏa hoạn bắt nguồn từ việc thiếu thông tin xử lý nhanh trong 3–5 phút đầu tiên hoặc sử dụng sai phương tiện dập lửa (ví dụ: dùng nước dập cháy chập điện hoặc dầu mỡ).

**FireGuard AI** được phát triển nhằm giải quyết bài toán ứng biến tình huống:
- Tiếp nhận mô tả hiện trường, hình ảnh hoặc các chỉ số cảnh báo môi trường.
- Tận dụng năng lực hiểu ngữ cảnh đa phương thức của **Google Gemini** để đưa ra chỉ dẫn hành động theo thời gian thực.
- Hỗ trợ cư dân, quản lý tòa nhà và tình nguyện viên ứng cứu đưa ra quyết định chính xác và an toàn nhất.

---

## ✨ Tính Năng Chính

- ⚡ **Đánh Giá Cấp Độ Rủi Ro Tức Thì:** Phân tích tình hình thành 3 cấp độ (*An toàn / Cảnh báo / Nguy kịch*) kèm chỉ dẫn ưu tiên.
- 🤖 **Trợ Lý Khẩn Cấp AI 24/7:** Trả lời trực tiếp các câu hỏi sinh tồn: cách vượt qua vùng ngạt khói, xử lý bỏng ban đầu, hướng dẫn kiểm tra nhiệt độ cửa trước khi mở.
- 🧯 **Khuyến Nghị Thiết Bị Chữa Cháy Phù Hợp:** Xác định nguồn cháy (chất rắn thông thường, chất lỏng dễ cháy, khí gas hay điện tử) để gợi ý dùng bình bọt Foam, bột khô ABC hay bình khí $CO_2$.
- 📄 **Tự Động Xuất Báo Cáo Sự Cố:** Tóm lược thời gian, diễn biến, nguy cơ tiềm ẩn và khuyến nghị khắc phục để phục vụ công tác thanh tra PCCC.

---

## 🛠️ Công Nghệ Sử Dụng

| Tầng công nghệ | Danh mục | Chi tiết |
| :--- | :--- | :--- |
| **Frontend** | Giao diện người dùng | React, Next.js / Vite, TypeScript |
| **Styling** | Giao diện & Icons | Tailwind CSS, Lucide React |
| **AI Backend** | Mô hình ngôn ngữ | Google Gemini API (thông qua `@google/genai` SDK) |
| **Platform** | Môi trường phát triển | Google AI Studio, Node.js (>= 18.0.0) |

---

## 📂 Cấu Trúc Thư Mục

```plaintext
fireguard-ai/
├── public/              # Tài nguyên tĩnh (ảnh, icons)
├── src/
│   ├── components/      # UI components (ChatBox, RiskIndicator, ActionGuide)
│   ├── services/        # Tích hợp Google Gemini API client
│   ├── types/           # Định nghĩa TypeScript interfaces
│   ├── App.tsx          # Component trung tâm
│   └── main.tsx         # Điểm khởi tạo ứng dụng
├── .env.example         # Template cấu hình biến môi trường
├── package.json         # Danh sách thư viện phụ thuộc & scripts
└── README.md            # Tài liệu dự án
```

---

## 🚀 Bắt Đầu & Cài Đặt

### 1. Yêu cầu hệ thống
- [Node.js](https://nodejs.org/) (phiên bản `18.0.0` trở lên)
- Trình quản lý gói `npm` (hoặc `yarn` / `pnpm`)
- Khóa API hợp lệ từ [Google AI Studio](https://aistudio.google.com/)

### 2. Các bước triển khai cục bộ

1. **Clone repository:**
   ```bash
   git clone https://github.com/nminh-code/fireguard-ai.git
   cd fireguard-ai
   ```

2. **Cài đặt các gói phụ thuộc:**
   ```bash
   npm install
   ```

3. **Thiết lập biến môi trường:**
   Tạo file `.env.local` ở thư mục gốc:
   ```bash
   cp .env.example .env.local
   ```
   Cập nhật `GEMINI_API_KEY` trong file `.env.local`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Khởi chạy máy chủ phát triển:**
   ```bash
   npm run dev
   ```
   Mở trình duyệt tại địa chỉ được cấp (thông thường là `http://localhost:3000` hoặc `http://localhost:5173`).

---

## ⚙️ Cấu Hình Môi Trường

| Tên biến | Bắt buộc | Mặc định | Mô tả |
| :--- | :---: | :---: | :--- |
| `GEMINI_API_KEY` | **Có** | - | Khóa bí mật kết nối với Google Gemini API. |
| `PORT` | Không | `3000` | Cổng dịch vụ lắng nghe trên máy chủ cục bộ. |

---

## 🧪 Kịch Bản Ứng Dụng (Use Cases)

```
[Báo Cáo Sự Cố] ──> [Phân Tích Cấp Độ (Gemini)] ──┬──> Cấp độ Thấp: Hướng dẫn tự xử lý
                                                  ├──> Cấp độ Trung: Chỉ định bình dập lửa
                                                  └──> Cấp độ Nguy cấp: Kích hoạt sơ tán & gọi 114
```

---

## 🗺️ Lộ Trình Phát Triển (Roadmap)

- [x] Khởi tạo giao diện ứng dụng và tích hợp kết nối Google Gemini API.
- [x] Module hỏi đáp kịch bản khẩn cấp đa ngôn ngữ (Tiếng Việt / English).
- [ ] Tích hợp camera stream qua giao thức WebRTC/RTSP để nhận diện khói & lửa bằng Computer Vision.
- [ ] Kết nối bộ điều khiển cảm biến ESP32 (nhiệt độ, nồng độ khí CO/LPG) qua MQTT.
- [ ] Tích hợp hệ thống cảnh báo tin nhắn tự động (Telegram Bot / Zalo ZNS / SMS).

---

## 🤝 Đóng Góp

Mọi đóng góp từ cộng đồng đều được hoan nghênh. Quy trình tham gia:

1. Fork dự án về tài khoản cá nhân.
2. Tạo nhánh tính năng (`git checkout -b feat/tinh-nang-moi`).
3. Commit mã nguồn (`git commit -m 'feat: them tinh nang canh bao khan cap'`).
4. Đẩy nhánh lên GitHub (`git push origin feat/tinh-nang-moi`).
5. Tạo một **Pull Request** mới kèm mô tả chi tiết.

---

## 📄 Giấy Phép

Dự án được phân phối dưới giấy phép [MIT License](LICENSE).