<div align="center">



\# 🔥 FireGuard AI

\### Hệ Thống Cảnh Báo \& Hỗ Trợ Ứng Phó Sự Cố Cháy Thông Minh



Dự án ứng dụng trí tuệ nhân tạo hỗ trợ giám sát, đánh giá nguy cơ hỏa hoạn và đưa ra hướng dẫn ứng phó khẩn cấp theo thời gian thực được hỗ trợ bởi \*\*Google Gemini API\*\*.



\---



<!-- Badges -->

<p>

&#x20; <a href="https://github.com/nminh-code/fireguard-ai/blob/main/LICENSE">

&#x20;   <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License">

&#x20; </a>

&#x20; <img src="https://img.shields.io/badge/Powered%20by-Google%20Gemini-blue?style=for-the-badge\&logo=google" alt="Google Gemini">

&#x20; <img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=for-the-badge\&logo=node.js" alt="Node.js">

&#x20; <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge" alt="PRs Welcome">

</p>



\[Xem Bản Trực Tiếp Trên Google AI Studio](https://ai.studio/apps/ec2d3540-a6e6-4a9f-85e9-90ce7f7e6f23) • \[Báo Lỗi / Góp Ý](https://github.com/nminh-code/fireguard-ai/issues)



</div>



\---



\## 📌 Giới Thiệu (Overview)



Hầu hết các hệ thống cảnh báo cháy truyền thống chỉ dừng lại ở việc phát còi báo động mà không cung cấp thông tin hướng dẫn theo tình huống. \*\*FireGuard AI\*\* được phát triển nhằm kết nối giữa dữ liệu cảm biến/báo cáo thực địa và khả năng suy luận đa thể thức của \*\*Google Gemini\*\*:



\- Tự động phân tích mức độ nghiêm trọng của đám cháy dựa trên dữ liệu báo cáo/hình ảnh.

\- Hỗ trợ trợ lý ảo phản hồi khẩn cấp 24/7 cho ban quản lý tòa nhà và người dân.

\- Đưa ra kịch bản thoát hiểm, vị trí bình chữa cháy phù hợp và số điện thoại hỗ trợ cứu hộ.



\---



\## ✨ Tính Năng Nổi Bật (Features)



\- 🚨 \*\*Cảnh Báo \& Đánh Giá Rủi Ro Tức Thì:\*\* Phân loại cấp độ nguy hiểm (Thấp, Trung bình, Nguy kịch) dựa trên mô tả hoặc hình ảnh hiện trường.

\- 🤖 \*\*Trợ Lý Khẩn Cấp AI (AI Assistant):\*\* Tích hợp Gemini xử lý ngôn ngữ tự nhiên để trả lời các câu hỏi: \*Cần làm gì ngay bây giờ?\*, \*Sử dụng bình cứu hỏa CO₂ hay bọt Foam?\*, \*Quy trình sơ tán an toàn\*.

\- 📋 \*\*Báo Cáo Tự Động Hóa:\*\* Tổng hợp và xuất báo cáo sự cố chi tiết (nguyên nhân dự đoán, mức độ ảnh hưởng, kiến nghị khắc phục) phục vụ cho công tác kiểm tra an toàn PCCC.

\- 🧭 \*\*Hướng Dẫn Thoát Hiểm Tùy Biến:\*\* Cung cấp hướng dẫn sơ tán theo từng khu vực/tầng lầu.



\---



\## 🛠️ Công Nghệ Sử Dụng (Tech Stack)



| Thành phần | Công nghệ / Thư viện |

| :--- | :--- |

| \*\*Môi trường chạy\*\* | Node.js (>= 18.x) |

| \*\*Giao diện \& Ứng dụng\*\* | React / Next.js / TypeScript |

| \*\*Mô hình Trí tuệ Nhân tạo\*\* | Google Gemini (thông qua `@google/genai` hoặc Google AI Studio) |

| \*\*Kiểu dáng \& Trực quan hóa\*\* | Tailwind CSS / Lucide Icons |



\---



\## 🚀 Hướng Dẫn Cài Đặt (Quick Start)



\### Yêu cầu trước khi cài đặt

\- Đã cài đặt \[Node.js](https://nodejs.org/) phiên bản `18.0.0` trở lên.

\- Đã có tài khoản và API Key tại \[Google AI Studio](https://aistudio.google.com/).



\### Các bước thực hiện



1\. \*\*Clone mã nguồn về máy:\*\*

&#x20;  ```bash

&#x20;  git clone \[https://github.com/nminh-code/fireguard-ai.git](https://github.com/nminh-code/fireguard-ai.git)

&#x20;  cd fireguard-ai

Cài đặt các gói phụ thuộc:



Bash

npm install

Cấu hình biến môi trường:

Tạo file .env.local ở thư mục gốc (hoặc đổi tên từ file .env.example nếu có):



Bash

cp .env.example .env.local

Sau đó mở .env.local và điền khóa API của bạn:



Đoạn mã

GEMINI\_API\_KEY=your\_google\_gemini\_api\_key\_here

Khởi chạy ứng dụng:



Bash

npm run dev

Truy cập trình duyệt tại: http://localhost:3000 (hoặc cổng hiển thị trong Terminal).



⚙️ Cấu Hình Môi Trường (Environment Variables)

Biến	Bắt buộc	Mô tả

GEMINI\_API\_KEY	Có	Khóa API lấy từ Google AI Studio dùng để kích hoạt các mô hình Gemini.

PORT	Không	Cổng chạy server cục bộ (mặc định: 3000 hoặc 5173 tùy bundler).

🧭 Lộ Trình Phát Triển (Roadmap)

\[x] Tích hợp Gemini API phân tích và tạo kịch bản ứng phó.



\[ ] Tích hợp mô hình thị giác máy tính (Computer Vision) nhận diện ngọn lửa trực tiếp từ luồng RTSP của camera an ninh.



\[ ] Gửi thông báo khẩn cấp tự động qua Telegram Bot / SMS Gateway.



\[ ] Bổ sung bảng điều khiển giám sát đa cảm biến IoT (khói, nhiệt độ, khí CO).



🤝 Đóng Góp (Contributing)

Mọi đóng góp nhằm nâng cao tính hiệu quả và sự ổn định của hệ thống đều rất được hoan nghênh:



Fork dự án



Tạo branch tính năng mới (git checkout -b feature/AmazingFeature)



Commit thay đổi (git commit -m 'Add some AmazingFeature')



Push lên branch (git push origin feature/AmazingFeature)



Mở một Pull Request



📄 Giấy Phép (License)

Dự án được phân phối dưới giấy phép MIT License. Chi tiết xem tại file LICENSE.





\### Điểm tối ưu trong bản README này:

1\. \*\*Header trực quan:\*\* Giữ tên dự án rõ ràng, bổ sung badge (Gemini, Node, License) tạo uy tín của một dự án tiêu chuẩn.

2\. \*\*Loại bỏ nội dung template:\*\* Bỏ ảnh banner AI Studio mặc định và thay vào đó là mô tả mục tiêu thực tế của hệ thống PCCC thông minh.

3\. \*\*Bảng cấu hình \& Công nghệ:\*\* Trình bày dạng bảng Markdown rõ ràng, dễ nhìn.

4\. \*\*Roadmap \& Contributing:\*\* Thể hiện dự án có tính mở và định hướng phát triển rõ ràng.

