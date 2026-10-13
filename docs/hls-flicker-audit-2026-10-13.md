# Kiểm tra HLS chớp trắng/mờ và gián đoạn — 13/10/2026

Yêu cầu: kiểm tra nguyên nhân; không tăng buffer. Không sửa code chạy thật, cấu hình camera, model AI hoặc các tham số buffer trong lần kiểm tra này.

## Kết quả có bằng chứng

1. **Trắng/mờ xuất hiện trước Frontend.** Tải các segment HLS từ Video Bridge và giải mã trực tiếp bằng FFmpeg: ảnh có vùng trắng/mờ/khối hình lỗi; giải mã file H.264 đầu ra hoàn thành không lỗi. Bridge đã mã hóa lại hình từ đầu vào HEVC, nên một segment hợp lệ vẫn có thể chứa hình lỗi. Ảnh lưu tại `.tmp/hls-flicker/contact-sheet.png` và `latest-sheet.png`.
2. **Đầu vào RTSP UDP có mất gói và lỗi HEVC.** Probe khoảng 11,4 giây trên nguồn camera hiện có ghi nhận 49 gói RTP bị thiếu (11 báo cáo), 56 thông báo `Could not find ref with POC`, 110 `Skipping invalid undecodable NALU`. Log đã loại thông tin đăng nhập, lưu tại `.tmp/hls-flicker/rtsp-udp-diagnostics.txt`. Các lỗi frame tham chiếu có thể bao gồm giai đoạn chờ keyframe khi mới kết nối; probe này không đo được tỷ lệ mất gói của riêng process Bridge cũ.
3. **Camera từ chối RTSP TCP.** Probe chỉ đọc, không đổi cấu hình, thất bại với `Nonmatching transport in server reply`. Không tự động đổi UDP sang TCP.
4. **Player thực sự bị thiếu dữ liệu phát liên tục.** Chrome headless dùng component `HlsVideoPlayer` hiện tại trên HLS thật: lần đo 45 giây thứ hai ghi nhận 2 `bufferStalledError` không fatal; một lần `waiting` khoảng 7,1 giây rồi seek từ 19,86 lên 27 giây. Lần đo đầu có 11 `waiting`, 6 seek (bao gồm seek lúc khởi động); phát tăng tốc tới 1,35×. Request HLS được quan sát không có 404/503; các response đều 200. Log tại `.tmp/hls-flicker/verified-browser.json` và `before-browser.json`.
5. **Không quan sát được chuyển HLS/WebRTC giữa chừng trong hai lần đo.** WebRTC signaling thất bại và player fallback HLS; nguồn MediaSource giữ nguyên trong lúc phát. Code còn có nguy cơ callback WebRTC đến muộn ghi `srcObject` sau khi HLS đã bắt đầu; đây là phát hiện code, chưa tái hiện và không coi là nguyên nhân được xác minh cho lần lỗi này.

## Code liên quan

- `video-bridge/server.mjs`: dòng 74–77 chọn transport; dòng 269–285 đọc UDP, giải mã đầu vào và mã hóa lại libx264 thành HLS; dòng 303 chỉ giữ lỗi handshake từ stderr, chưa có thống kê mất gói RTP/HEVC của process đang chạy.
- `src/components/HlsVideoPlayer.tsx`: dòng 114–116 đặt liveSync 1 segment, max latency 3 segment và catch-up tối đa 1,5×; dòng 249 trở đi watchdog/seek về live; dòng 172 `ontrack` và dòng 236 timeout fallback.
- Playlist hiện tại có segment 1 giây, cửa sổ 5 segment; các file được publish atomically. HTTP 200, playlist tăng sequence và dup/drop=0 không chứng minh pixel đầu vào nguyên vẹn hoặc player không bị stall.

## Phân loại

| Hạng mục | Kết quả |
|---|---|
| Hình trắng/mờ có trong file HLS trước UI | XÁC MINH |
| Probe RTSP UDP mất gói và lỗi HEVC | XÁC MINH |
| TCP không được camera chấp nhận trong probe | XÁC MINH |
| Player bufferStalled và tự seek khi đang phát | XÁC MINH |
| White flash do CSS overlay hoặc reset MediaSource | CHƯA TÁI HIỆN |
| Tăng tốc 1,5× là nguyên nhân duy nhất của stall | CHƯA XÁC MINH |
| Lý do vật lý gây mất gói: Wi-Fi, tải CPU, firmware, nhiều client | CHƯA XÁC MINH |

## Hướng xử lý giữ nguyên buffer

- Ưu tiên kiểm tra ổn định đường camera → máy chạy Bridge và tải giải mã HEVC; mất dữ liệu đầu vào không được chữa bằng tăng buffer HLS.
- Bổ sung metric RTP/decoder trong Bridge trước khi quyết định chỉnh pipeline. Có thể thử bỏ frame lỗi ở decoder và đánh giá bằng frame thật; không hứa hết trắng chỉ từ một cờ FFmpeg.
- Kiểm thử riêng việc giảm tăng tốc catch-up và khóa WebRTC sau fallback; chỉ sửa khi có phép đo so sánh. Không đổi camera/FPS/model để che hiện tượng.

Các probe mở thêm session RTSP tạm thời; đã kết thúc sau phép đo. Ảnh trắng trong HLS đã được thu trước probe RTSP, nên không chỉ dựa vào lỗi phát sinh khi mở client kiểm tra. Không tạo cháy/thông báo giả. Các JSON nghiệp vụ đang thay đổi do dịch vụ chạy thật.

Ở cuối kiểm tra, Bridge API còn hoạt động nhưng status `cam-test` trả `NOT_CONNECTED`; trước probe, AI cũng đã chuyển `FAILED/RTSP_ENDED`. Đây là trạng thái mới nhất, không coi lần phát có hình trước đó là bằng chứng phiên đang ổn định. Không tự tạo lại phiên HLS vì thao tác đó đổi streamId/URL mà browser người dùng đang giữ.
