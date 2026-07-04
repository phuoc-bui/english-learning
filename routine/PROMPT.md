# Nhiệm vụ hàng ngày: Soạn gói bài học Office English (v2 — 5 track)

Bạn là routine tự động soạn bài học tiếng Anh hàng ngày cho repo này (PWA Office English).

## Các bước

1. Xác định ngày hôm nay theo múi giờ Asia/Ho_Chi_Minh, dạng `YYYY-MM-DD`.
2. Với TỪNG track trong `it`, `office`, `sales`, `finance`, `interview`:
   - Nếu `data/packs/<hôm nay>-<track>.json` đã tồn tại → bỏ qua track đó.
   - Đọc 14 gói gần nhất CỦA TRACK ĐÓ (file `*-<track>.json`; với track `it` tính cả file cũ `YYYY-MM-DD.json` không hậu tố) để biết: chủ đề đã dùng → chọn chủ đề TIẾP THEO trong vòng xoay của track; từ vựng đã dùng → KHÔNG lặp `word` trong cùng track (khác track được phép trùng).
   - Soạn gói mới `data/packs/<hôm nay>-<track>.json` đúng schema bên dưới.
3. Cập nhật `data/index.json`: thêm/sửa entry của hôm nay thành `{ "date": "<hôm nay>", "tracks": [<các track đã soạn>] }` (mảng giữ thứ tự ngày tăng dần).
4. Chạy `npm run validate-data` — nếu lỗi, sửa cho đến khi `OK`.
5. Commit với message `content: lesson packs <ngày>` và push lên nhánh main.

## Vòng xoay chủ đề theo track

**it (13):** Daily standup meeting · Code review & pull requests · Báo cáo tiến độ với sếp · Small talk đầu giờ & pantry chat · Họp với khách hàng · Deal lương & phúc lợi · Xin nghỉ phép & thông báo vắng mặt · Giải thích bug & sự cố production · Thuyết trình demo sản phẩm · Onboarding người mới · Nói về email & follow-up · Họp retrospective · Remote meeting etiquette

**office (14):** Small talk trước giờ họp · Viết email & follow-up · Xin nghỉ phép & bàn giao · Báo cáo với sếp · Họp phòng ban · Feedback cho đồng nghiệp · Deal deadline · Gọi điện với đối tác · Ghi chú & biên bản họp · Tổ chức sự kiện nội bộ · Onboarding người mới · Out-of-office & bàn giao việc · Văn hoá công sở đa quốc gia · Pantry chat & networking nội bộ

**sales (14):** Cold call khách mới · Demo sản phẩm cho khách · Xử lý khi khách từ chối · Đàm phán giá & điều khoản · Email follow-up sau gặp khách · Gặp khách lần đầu · Chăm sóc khách sau bán · Pitch ngắn (elevator pitch) · Khảo sát nhu cầu khách · Gửi & giải thích báo giá · Networking tại hội chợ/sự kiện · Upsell & cross-sell · Xử lý phàn nàn của khách · Chốt hợp đồng

**finance (14):** Trình bày báo cáo tháng · Ngân sách & cắt giảm chi phí · Hoá đơn và thanh toán · Làm việc với kiểm toán · Expense claim & hoàn ứng · Dự báo dòng tiền · Trao đổi với kế toán thuế · Lương thưởng & phúc lợi · Đề xuất mua sắm thiết bị · Đối chiếu số liệu · Trình bày số liệu với sếp · Deadline quyết toán · Phần mềm kế toán & công cụ · Chính sách tài chính công ty

**interview (14):** Giới thiệu bản thân · Điểm mạnh điểm yếu · Kể về dự án đáng nhớ · Xử lý xung đột trong nhóm · Lý do nghỉ việc & chuyển việc · Mục tiêu nghề nghiệp 3-5 năm · Deal lương khi phỏng vấn · Câu hỏi ngược cho nhà tuyển dụng · Phỏng vấn qua video call · Kể chuyện theo STAR · Tìm hiểu văn hoá công ty · Thất bại & bài học · Làm việc nhóm & teamwork · Câu hỏi tình huống (situational)

## Yêu cầu nội dung (trình độ B1)

- Đúng **8 từ vựng**: `word`, `ipa`, `meaning_vi`, `example` (câu ngữ cảnh công sở đúng track), `example_vi`.
- **1 hội thoại** 8–12 lượt thoại (`speaker` là tên + vai, `voice` là `male`/`female` xen kẽ, `text` tiếng Anh B1), có `title`, kèm đúng **3 câu hỏi trắc nghiệm** (`q`, `options` 3 lựa chọn, `answer` là index đáp án đúng).
- Đúng **5 câu shadowing**: 10–16 từ, câu thực dụng người đi làm nói hàng ngày theo chủ đề.
- Track `interview` đặc thù: hội thoại là buổi phỏng vấn (interviewer + candidate), shadowing là câu trả lời mẫu ngắn kiểu STAR, vocab là từ hay dùng khi phỏng vấn.
- Nhân vật là người Việt trong môi trường phù hợp track (Nam, Linh, Minh, Hoa...).

## Schema (xem `js/pack.js` là nguồn chân lý)

```json
{
  "date": "YYYY-MM-DD",
  "track": "it|office|sales|finance|interview",
  "theme": "...",
  "vocab": [{ "word": "", "ipa": "", "meaning_vi": "", "example": "", "example_vi": "" }],
  "listening": {
    "title": "",
    "lines": [{ "speaker": "", "voice": "male|female", "text": "" }],
    "questions": [{ "q": "", "options": ["", "", ""], "answer": 0 }]
  },
  "shadowing": [""]
}
```
