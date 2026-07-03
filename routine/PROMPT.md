# Nhiệm vụ hàng ngày: Soạn gói bài học Office English

Bạn là routine tự động soạn bài học tiếng Anh hàng ngày cho repo này (PWA Office English).

## Các bước

1. Xác định ngày hôm nay theo múi giờ Asia/Ho_Chi_Minh, dạng `YYYY-MM-DD`.
2. Nếu `data/packs/<hôm nay>.json` đã tồn tại → dừng, không làm gì.
3. Đọc `data/index.json` và 14 gói gần nhất trong `data/packs/` để biết:
   - Chủ đề của 14 ngày trước → chọn chủ đề TIẾP THEO trong vòng xoay 14 chủ đề (danh sách bên dưới).
   - Từ vựng đã dùng → KHÔNG lặp lại bất kỳ `word` nào đã có trong mọi gói cũ.
4. Soạn gói mới `data/packs/<hôm nay>.json` đúng schema (bên dưới).
5. Chạy `npm run validate-data` — nếu lỗi, sửa cho đến khi `OK`.
6. Thêm ngày mới vào `data/index.json` (giữ thứ tự tăng dần).
7. Commit với message `content: lesson pack <ngày>` và push lên nhánh main.

## Vòng xoay 14 chủ đề

1. Daily standup meeting
2. Code review & pull requests
3. Báo cáo tiến độ với sếp
4. Small talk đầu giờ & pantry chat
5. Họp với khách hàng
6. Deal lương & phúc lợi
7. Xin nghỉ phép & thông báo vắng mặt
8. Giải thích bug & sự cố production
9. Thuyết trình demo sản phẩm
10. Onboarding người mới
11. Nói về email & follow-up
12. Họp retrospective
13. Phỏng vấn kỹ thuật
14. Remote meeting etiquette

## Yêu cầu nội dung (trình độ B1, ngành IT/văn phòng)

- Đúng **8 từ vựng**: `word`, `ipa`, `meaning_vi`, `example` (câu ngữ cảnh công sở), `example_vi`.
- **1 hội thoại** 8–12 lượt thoại (`speaker` là tên + vai, `voice` là `male`/`female` xen kẽ, `text` tiếng Anh B1), có `title`, kèm đúng **3 câu hỏi trắc nghiệm** (`q`, `options` 3 lựa chọn, `answer` là index đáp án đúng).
- Đúng **5 câu shadowing**: 10–16 từ, câu thực dụng người đi làm nói hàng ngày, theo chủ đề.
- Đúng **2 câu hỏi phỏng vấn**: `type` ∈ behavioral|technical|common, `tips_vi` 2–3 gạch đầu dòng tiếng Việt, `sample_answer` 100–200 từ tiếng Anh B1 (câu ngắn, thì đơn giản, tự nhiên khi nói).
- Nhân vật trong hội thoại là người Việt làm công ty phần mềm (Nam, Linh, Minh, Hoa...).

## Schema (xem `js/pack.js` là nguồn chân lý)

```json
{
  "date": "YYYY-MM-DD",
  "theme": "...",
  "vocab": [{ "word": "", "ipa": "", "meaning_vi": "", "example": "", "example_vi": "" }],
  "listening": {
    "title": "",
    "lines": [{ "speaker": "", "voice": "male|female", "text": "" }],
    "questions": [{ "q": "", "options": ["", "", ""], "answer": 0 }]
  },
  "shadowing": [""],
  "interview": [{ "question": "", "type": "behavioral|technical|common", "tips_vi": [""], "sample_answer": "" }]
}
```
