# Office English — PWA học tiếng Anh công sở

**Ngày:** 2026-07-02
**Người dùng:** Phước — trình độ B1, ngành IT/phần mềm, người đi làm bận rộn
**Mục tiêu:** Giao tiếp tự tin trong môi trường công ty nước ngoài; sẵn sàng phỏng vấn tiếng Anh

## 1. Tổng quan

Web app dạng PWA (Progressive Web App) chạy trên điện thoại Samsung S23 Ultra (Chrome Android), cài được lên màn hình chính như app native. Nội dung bài học do một **Claude routine (scheduled task)** soạn tự động mỗi ngày và commit vào GitHub repo. App host trên **GitHub Pages** — không server, không database, không phí API.

**Nguyên tắc thiết kế:**
- Mở app là học được ngay — mỗi hoạt động gói gọn ~5 phút
- Tiếng Việt làm ngôn ngữ giao diện phụ trợ (giải nghĩa, hướng dẫn); nội dung học bằng tiếng Anh
- Không phụ thuộc dịch vụ trả phí; mọi thứ chạy trên trình duyệt + GitHub miễn phí

## 2. Kiến trúc

```
Claude Routine (cron ~5:00 sáng VN mỗi ngày)
   └─> soạn gói bài học JSON theo schema
   └─> validate JSON, kiểm tra tránh lặp từ với các gói cũ
   └─> commit data/packs/YYYY-MM-DD.json + cập nhật data/index.json

GitHub repo (english-learning) ── GitHub Pages serve từ nhánh main
   │
PWA thuần HTML/CSS/JS (không build step)
   ├─ Service worker: cache app shell + 7 gói gần nhất (offline được)
   ├─ localStorage: tiến độ học, trạng thái spaced repetition, streak
   └─ Web Speech API:
        ├─ SpeechSynthesis (TTS): đọc từ vựng, hội thoại, câu hỏi — offline OK
        └─ SpeechRecognition (STT): nghe người dùng nói — cần mạng (Google server)
```

**Stack:** HTML + CSS + JavaScript thuần (ES modules), không framework, không bundler. GitHub Pages serve trực tiếp từ root repo.

## 3. Cấu trúc thư mục

```
/
├─ index.html            # App shell, 5 tab
├─ manifest.webmanifest  # PWA manifest (icon, tên, standalone)
├─ sw.js                 # Service worker
├─ css/app.css
├─ js/
│  ├─ app.js             # Router tab, khởi tạo
│  ├─ store.js           # localStorage wrapper, backup/restore
│  ├─ speech.js          # TTS/STT wrapper (Web Speech API)
│  ├─ srs.js             # Thuật toán spaced repetition (SM-2 rút gọn)
│  ├─ diff.js            # So khớp transcript với câu mẫu (word-level)
│  └─ views/             # Mỗi tab một module
│     ├─ today.js
│     ├─ vocab.js
│     ├─ speaking.js
│     ├─ interview.js
│     └─ progress.js
├─ data/
│  ├─ index.json         # ["2026-07-02", "2026-07-03", ...]
│  └─ packs/YYYY-MM-DD.json
├─ routine/
│  └─ PROMPT.md          # Prompt đầy đủ cho Claude routine + schema + quy tắc
└─ docs/superpowers/specs/  # Tài liệu thiết kế
```

## 4. Các màn hình (5 tab, thanh tab dưới đáy màn hình)

### 4.1 Hôm nay (màn hình mặc định)
- Header: streak 🔥 N ngày, ngày hôm nay
- 4 thẻ hoạt động, mỗi thẻ ghi thời lượng ước tính và trạng thái hoàn thành (✓):
  1. 📖 **Từ vựng mới** — 8 từ của hôm nay (~5 phút)
  2. 🎧 **Bài nghe** — 1 hội thoại + 3 câu hỏi (~5 phút)
  3. 🎤 **Luyện nói** — 5 câu shadowing (~5 phút)
  4. 💼 **Phỏng vấn** — 2 câu hỏi (~10 phút)
- Hoàn thành cả 4 thẻ → ngày được tính vào streak
- Nếu chưa có gói của hôm nay: dùng gói mới nhất có sẵn, hiển thị "Bài của ngày X"

### 4.2 Từ vựng
- Flashcard: mặt trước từ tiếng Anh + IPA + nút loa (TTS); mặt sau nghĩa tiếng Việt + câu ví dụ ngữ cảnh công sở + nút loa đọc ví dụ
- Sau khi lật, người dùng chấm: **Quên / Khó / Nhớ** → thuật toán SRS xếp lịch ôn lại
- Phiên ôn: trộn từ mới hôm nay + từ đến hạn ôn (tối đa 20 thẻ/phiên)
- Đếm số từ đến hạn trên tab badge

### 4.3 Luyện nói (shadowing)
- Danh sách 5 câu của hôm nay, mỗi câu:
  1. Nhấn ▶ nghe TTS đọc câu mẫu (chọn được tốc độ 0.75x / 1x)
  2. Nhấn 🎤 nói lại → STT chuyển thành text
  3. App so khớp từng từ: xanh = đúng, đỏ = sai/thiếu; hiện điểm % khớp
  4. Cho nói lại không giới hạn; lưu điểm cao nhất
- Câu shadowing lấy từ ngữ cảnh công sở IT (standup, review, chat với đồng nghiệp)

### 4.4 Phỏng vấn
- 2 câu hỏi/ngày, trộn behavioral (STAR) và câu hỏi thường gặp cho dân IT
- Mỗi câu: nghe/đọc câu hỏi → tips trả lời (bullet, tiếng Việt) → nhấn 🎤 trả lời tự do (STT ghi transcript) → xem transcript của mình cạnh **câu trả lời mẫu B1-friendly**
- Nút **"Copy để hỏi Claude"**: copy vào clipboard một prompt soạn sẵn gồm câu hỏi + transcript của người dùng + yêu cầu Claude nhận xét ngữ pháp, từ vựng, cấu trúc — người dùng dán vào app Claude để được chấm sâu
- Transcript các lần trả lời được lưu lại để xem tiến bộ

### 4.5 Tiến độ
- Streak hiện tại + dài nhất, tổng từ đã học, tổng phút luyện nói, số câu phỏng vấn đã trả lời
- Lưới 30 ngày gần nhất (kiểu GitHub contribution): ngày nào học đủ 4 hoạt động tô đậm
- Nút **Xuất backup** (tải file JSON chứa toàn bộ localStorage) và **Nhập backup**

## 5. Schema gói bài học (`data/packs/YYYY-MM-DD.json`)

```json
{
  "date": "2026-07-02",
  "theme": "Daily standup meeting",
  "vocab": [
    {
      "word": "blocker",
      "ipa": "/ˈblɒkə/",
      "meaning_vi": "vấn đề cản trở công việc",
      "example": "I have a blocker with the payment API — can someone help me after standup?",
      "example_vi": "Tôi đang bị vướng ở API thanh toán — ai giúp tôi sau standup được không?"
    }
    // ... 8 từ
  ],
  "listening": {
    "title": "Morning standup",
    "lines": [
      { "speaker": "A", "voice": "male", "text": "Alright team, let's start with yesterday's progress." },
      { "speaker": "B", "voice": "female", "text": "I finished the login page, but I found a bug in the session handling." }
      // ... 8-12 lượt thoại
    ],
    "questions": [
      { "q": "What did speaker B finish?", "options": ["The login page", "The payment API", "The session handling"], "answer": 0 }
      // ... 3 câu
    ]
  },
  "shadowing": [
    "Yesterday I worked on the user authentication feature.",
    "I'm blocked on the database migration — I need help from the backend team."
    // ... 5 câu
  ],
  "interview": [
    {
      "question": "Tell me about a challenging project you worked on.",
      "type": "behavioral",
      "tips_vi": ["Dùng cấu trúc STAR: Situation, Task, Action, Result", "Chọn dự án có con số cụ thể"],
      "sample_answer": "In my last project, we had to migrate a legacy system... (150-200 từ, trình độ B1)"
    }
    // ... 2 câu
  ]
}
```

**Bài nghe không cần file audio:** app dùng SpeechSynthesis đọc từng lượt thoại với 2 giọng khác nhau (nam/nữ), xen kẽ giọng Anh-Anh và Anh-Mỹ theo ngày để quen nhiều accent.

## 6. Claude Routine

- **Lịch chạy:** hàng ngày ~5:00 sáng giờ VN (22:00 UTC)
- **Nhiệm vụ:** đọc `routine/PROMPT.md` trong repo (chứa schema + quy tắc), xem 14 gói gần nhất để tránh lặp từ vựng và chủ đề, soạn gói mới cho hôm nay, validate JSON đúng schema, commit `data/packs/` + cập nhật `data/index.json`
- **Chủ đề xoay vòng (14 chủ đề):** daily standup, code review, báo cáo tiến độ với sếp, small talk đầu giờ, họp khách hàng, deal lương & phúc lợi, xin nghỉ phép, giải thích bug/sự cố, thuyết trình demo, onboarding người mới, viết & nói về email, họp retro, phỏng vấn kỹ thuật, remote meeting etiquette
- **Trình độ nội dung:** B1 — câu ngắn gọn, từ vựng thực dụng, câu trả lời mẫu không dùng cấu trúc quá phức tạp
- **Nội dung mồi:** repo có sẵn **30 gói đầu tiên** soạn trước khi launch, app dùng được ngay dù routine chưa chạy

## 7. Xử lý lỗi

| Tình huống | Xử lý |
|---|---|
| Chưa có gói hôm nay (routine không chạy) | Dùng gói mới nhất trong `index.json`, hiện nhãn "Bài của ngày X" |
| Mất mạng | Service worker serve app + gói đã cache; STT hiện thông báo "cần mạng để nhận giọng nói", các phần khác hoạt động bình thường |
| Quyền micro bị từ chối | Hiện hướng dẫn bật quyền trong cài đặt Chrome; shadowing vẫn cho nghe câu mẫu, phỏng vấn vẫn xem được câu mẫu |
| Trình duyệt không có SpeechRecognition | Ẩn nút mic, thay bằng ô nhập text (gõ câu trả lời) |
| localStorage đầy/hỏng | Backup/restore thủ công qua file JSON; dữ liệu ghi có try/catch, lỗi thì báo nhẹ không crash |
| JSON gói bài lỗi schema | App bỏ qua gói lỗi, dùng gói gần nhất hợp lệ |

## 8. Kiểm thử

- **Unit test** (chạy bằng Node, không cần framework nặng): `srs.js` (lịch ôn tập), `diff.js` (so khớp transcript), validator schema gói bài
- **Verify thủ công:** chạy local server, kiểm tra bằng Chrome DevTools giả lập viewport S23 Ultra (~412×915 CSS px); người dùng test thật trên điện thoại sau khi deploy GitHub Pages
- Routine có bước tự validate JSON trước khi commit

## 9. Ngoài phạm vi (YAGNI)

- Không tài khoản người dùng, không sync đa thiết bị (backup file là đủ)
- Không AI chấm điểm thời gian thực trong app (dùng nút "Copy để hỏi Claude")
- Không file audio thu sẵn (TTS là đủ)
- Không dark mode ở v1 (có thể thêm sau)
- Không hỗ trợ iOS Safari (chỉ tối ưu Chrome Android)

## 10. Thứ tự triển khai (cấp cao)

1. App shell PWA: 5 tab, manifest, service worker, CSS mobile-first
2. Module dữ liệu + 30 gói mồi đầu tiên
3. Tab Từ vựng (flashcard + SRS)
4. Tab Luyện nói (TTS + STT + diff)
5. Tab Nghe + Phỏng vấn
6. Tab Hôm nay + Tiến độ (streak, backup)
7. Deploy GitHub Pages, test trên điện thoại thật
8. Soạn `routine/PROMPT.md` + tạo scheduled task Claude
