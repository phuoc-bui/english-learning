# Office English v2 — Cá nhân hoá & mở rộng (Nhóm B)

**Ngày:** 2026-07-04
**Tiền đề:** v1 đang chạy (PWA tĩnh, GitHub Pages, Claude routine soạn 1 gói/ngày, xem `2026-07-02-office-english-design.md`)
**Phạm vi:** Nhóm B — mọi tính năng chạy trên kiến trúc tĩnh hiện tại, KHÔNG backend. Nhóm A (auth Google/Facebook, thanh toán, sync đa thiết bị, nội dung sinh động theo từng user) là dự án riêng, thiết kế sau khi v2 chạy ổn.

## 1. Tổng quan thay đổi

| # | Tính năng | Tóm tắt |
|---|---|---|
| 1 | Onboarding | Wizard 5 bước lần đầu mở app, lưu hồ sơ localStorage, sửa trong Cài đặt |
| 2 | 5 track nội dung | Routine soạn 5 gói/ngày theo lĩnh vực; bỏ tab Phỏng vấn (thành track) |
| 3 | Tab Luyện tập | Gộp shadowing + 3 hoạt động AI ngoài (hội thoại, nói tự do, viết) |
| 4 | Tab Ôn tập | Xem lại bài cũ + sổ tay từ vựng (thay vị trí tab Phỏng vấn) |
| 5 | Kiểm tra định kỳ | Quiz tự sinh tuần/tháng + tuỳ chọn kiểm tra nói/viết qua AI ngoài |
| 6 | Icon mới | Biểu tượng bong bóng hội thoại, nền gradient ấm |
| 7 | Cài đặt | View mới (bánh răng trên header): sửa hồ sơ, backup/restore |

**Bố cục tab mới:** Hôm nay · Từ vựng · Luyện tập · Ôn tập · Tiến độ (+ nút ⚙ Cài đặt trên header).

## 2. Onboarding & hồ sơ người dùng

**Kích hoạt:** mở app mà `store` chưa có `profile` → render wizard toàn màn hình thay cho app shell (ẩn thanh tab). Có nút quay lại giữa các bước, không cho bỏ qua (trừ bước mục tiêu có thể bỏ trống).

**5 bước:**
1. **Lĩnh vực (track)** — chọn 1: IT/Software (`it`) · Văn phòng chung (`office`) · Sales & Marketing (`sales`) · Tài chính/Kế toán (`finance`) · Phỏng vấn xin việc (`interview`). Mỗi lựa chọn có icon + mô tả 1 dòng.
2. **Trình độ** — `a2` (sơ cấp) / `b1` (trung cấp) / `b2` (khá trở lên). Ảnh hưởng: prompt AI ngoài + độ pha trộn độ khó quiz. KHÔNG ảnh hưởng gói bài (gói vẫn 1 mức ~B1 mỗi track).
3. **Mục tiêu** — chọn nhiều: giao tiếp trong công việc · chuẩn bị phỏng vấn · viết email chuyên nghiệp · thuyết trình · small talk. Dùng để cá nhân hoá prompt AI.
4. **Thời gian mỗi ngày** — `15` / `30` / `45` (phút) → kế hoạch ngày (mục 3.3).
5. **App AI ưa thích** — `chatgpt` / `claude` / `gemini` / `other`.

**Lưu trữ:** `profile = { track, level, goals[], minutes, aiApp, onboardedAt }` trong localStorage qua `store.js`.

**User cũ:** có tiến độ nhưng chưa có profile → vẫn qua wizard một lần, bước track gợi ý sẵn IT (nội dung v1 là IT). Tiến độ, streak, SRS cũ giữ nguyên.

**Cài đặt (view mới, mở từ ⚙ header):** sửa từng trường hồ sơ (đổi track có hiệu lực từ gói kế tiếp được tải), nút Xuất/Nhập backup (chuyển từ tab Tiến độ sang, tab Tiến độ bỏ 2 nút này).

## 3. Nội dung 5 track & kế hoạch ngày

### 3.1 Dữ liệu
- File gói: `data/packs/YYYY-MM-DD-<track>.json` (5 file/ngày).
- `data/index.json` đổi format: `[{ "date": "2026-07-05", "tracks": ["it","office","sales","finance","interview"] }, ...]` (mới nhất cuối mảng, như v1).
- **Migration:** entry dạng chuỗi `"YYYY-MM-DD"` (v1) được hiểu là `{ date, tracks: ["it"] }`, file tương ứng vẫn ở đường dẫn cũ `data/packs/YYYY-MM-DD.json`. `data.js` chịu trách nhiệm phân giải cả 2 dạng.
- **Schema gói:** như v1 nhưng **bỏ trường `interview`**; thêm trường `track`. Trường `interview` trong gói cũ bị bỏ qua. Track `interview` dùng chung schema: hội thoại nghe là buổi phỏng vấn mẫu, shadowing là các câu trả lời STAR, từ vựng là từ hay dùng khi phỏng vấn.
- **Gói mồi:** soạn sẵn tối thiểu 3 ngày × 5 track để mọi track dùng được ngay khi deploy.

### 3.2 Routine
`routine/PROMPT.md` cập nhật:
- Mỗi sáng soạn **5 gói** (mỗi track 1 gói), validate từng gói, cập nhật `index.json` theo format mới.
- Chống lặp từ vựng/chủ đề tính **trong phạm vi từng track** (nhìn 14 gói gần nhất của track đó).
- Mỗi track có danh sách chủ đề xoay vòng riêng (IT giữ 14 chủ đề v1 trừ phỏng vấn; các track mới có danh sách riêng ghi trong PROMPT.md).

### 3.3 Kế hoạch ngày & streak
Kế hoạch theo `profile.minutes`:
- **15'** → 3 hoạt động bắt buộc: Từ vựng, Nghe, Shadowing.
- **30'** → thêm 1 hoạt động AI (xoay vòng theo ngày: hội thoại → nói → viết → lặp lại).
- **45'** → thêm 2 hoạt động AI (xoay vòng, ngày nào cũng chừa 1 loại).

Ngày được tính streak khi xong đủ các hoạt động **bắt buộc theo kế hoạch**. Hoạt động AI ngoài kế hoạch vẫn làm được (tính là bonus, hiện ✓ nhưng không chặn streak). Màn Hôm nay hiển thị đúng các thẻ theo kế hoạch (thẻ Phỏng vấn v1 bị xoá).

## 4. Tab Luyện tập

Gộp 2 phần, thay tab Luyện nói cũ:

**A. Shadowing** — giữ nguyên toàn bộ tính năng v1 (TTS đọc mẫu 0.75x/1x, STT, chấm % khớp từ, lưu điểm cao nhất).

**B. Thực hành với AI** — 3 thẻ:
- 💬 **Hội thoại** — nhập vai đối thoại theo chủ đề hôm nay (AI đóng vai đồng nghiệp/khách/nhà tuyển dụng tuỳ track).
- 🎤 **Nói tự do** — user nói (dùng voice mode của app AI) về đề bài theo chủ đề.
- ✍️ **Viết** — viết đoạn văn/email theo đề bài, AI chữa.

Mỗi thẻ: tiêu đề + mô tả nhiệm vụ ngắn (sinh từ theme gói hôm nay) + nút **"Mở [tên app AI]"** + nút **"Đánh dấu xong"**.

**Dựng prompt** (`js/prompt.js`, module mới): template theo loại hoạt động, nội dung gồm — vai trò AI (coach tiếng Anh), kịch bản theo `theme` + track, yêu cầu lồng 8 từ vựng hôm nay, trình độ user (điều chỉnh độ phức tạp), mục tiêu user, luật chơi (sửa lỗi nhẹ nhàng trong lúc chat, cuối buổi tổng kết lỗi ngữ pháp/từ vựng + gợi ý cải thiện). Prompt viết bằng tiếng Anh, phần chỉ dẫn meta có thể kèm tiếng Việt.

**Mở app AI:**
- `chatgpt` → `https://chatgpt.com/?q=<encodeURIComponent(prompt)>`
- `claude` → `https://claude.ai/new?q=<...>`
- `gemini` → copy clipboard + mở `https://gemini.google.com/app`
- `other` → chỉ copy clipboard
- Mọi trường hợp đều copy prompt vào clipboard trước khi mở, kèm toast "Đã copy prompt — nếu ô chat trống, dán vào để bắt đầu" (phòng khi tham số `?q=` không được app/web nhận).

**Trạng thái:** `aiDone[date] = { conversation, speaking, writing }` (boolean). Nút "Đánh dấu xong" bật/tắt được (phòng bấm nhầm).

## 5. Tab Ôn tập

Thay vị trí tab Phỏng vấn. Hai phân đoạn (segmented control):

**A. Bài cũ**
- Danh sách gói đã phát hành (đọc từ `index.json`), mới nhất trước, mỗi dòng: ngày + theme + track badge; bộ lọc theo track.
- Mở gói → chế độ ôn đọc-lại: nghe lại hội thoại (player như tab Nghe), danh sách từ vựng (bấm nghe TTS), shadowing lại từng câu (có chấm điểm nhưng không ghi đè trạng thái hoàn thành/streak của ngày cũ).
- Gói chưa cache + đang offline → dòng mờ đi kèm nhãn "cần mạng".

**B. Sổ tay từ vựng**
- Gom từ của mọi gói user đã học (từ đã xem qua flashcard ít nhất 1 lần — dữ liệu SRS làm nguồn), kèm từ của gói đang tải nếu cần.
- Ô tìm kiếm (khớp từ EN hoặc nghĩa VI), lọc theo track và theo độ nhớ SRS (mới/đang học/thuộc).
- Bấm từ → nghe TTS, xem IPA + nghĩa + câu ví dụ (+ nút nghe ví dụ).

## 6. Kiểm tra tiến bộ định kỳ

**Vị trí:** tab Tiến độ. Điều kiện mở khoá: học đủ ≥7 ngày kể từ lần kiểm tra tuần trước → banner "Đến hạn kiểm tra tuần"; ≥30 ngày kể từ kiểm tra tháng trước → "kiểm tra tháng" (ưu tiên hiện banner tháng nếu cả hai đến hạn).

**Quiz tự sinh** (`js/quiz.js`, module mới):
- Nguồn: nội dung các gói user đã học trong kỳ (từ vựng đã gặp, câu ví dụ, hội thoại nghe).
- Dạng câu: trắc nghiệm nghĩa EN→VI · trắc nghiệm ngược VI→EN · điền từ vào chỗ trống trong câu ví dụ (chọn trong 4 từ) · nghe hiểu (TTS đọc 1-2 lượt thoại cũ + 1 câu hỏi trắc nghiệm).
- Tuần 10 câu, tháng 20 câu; trộn dạng; distractor lấy từ các từ đã học khác cùng kỳ. Trình độ `b2` tăng tỉ lệ câu VI→EN và điền từ (khó hơn); `a2` thiên về EN→VI.
- Chấm ngay từng câu (hiện đúng/sai + đáp án), kết thúc hiện tổng điểm %.
- Lưu: `tests[] = { date, kind: "week"|"month", score, total }` → biểu đồ cột điểm các kỳ trong tab Tiến độ.

**Tuỳ chọn AI:** cạnh kết quả có nút "Kiểm tra nói/viết với AI" — prompt yêu cầu AI phỏng vấn/ra đề dựa trên danh sách từ + chủ đề của kỳ, chấm và nhận xét; mở app AI như mục 4; user tự đánh dấu đã làm (lưu boolean kèm bản ghi test, không có điểm).

## 7. Icon mới

- Motif: bong bóng hội thoại (gợi giao tiếp tiếng Anh) — ví dụ 2 bong bóng chồng lệch, bong bóng trước chứa "En" hoặc dấu ✓, trên nền gradient ấm đúng token màu design system Notion-warm hiện có trong `css/app.css`.
- Cập nhật `icons/icon.svg` + `icons/icon-maskable.svg` (safe zone 80% cho maskable), giữ nguyên đường dẫn để manifest/sw không đổi cấu trúc; bump cache version trong `sw.js` để icon mới được nhận.

## 8. Thay đổi kỹ thuật

- **Không đổi stack:** HTML/CSS/JS thuần, ES modules, không build step, GitHub Pages.
- **File mới:** `js/views/practice.js` (thay `speaking.js` — giữ code shadowing), `js/views/review.js`, `js/views/settings.js`, `js/views/onboarding.js`, `js/prompt.js`, `js/quiz.js`. Xoá `js/views/interview.js`.
- **store.js** thêm khoá: `profile`, `aiDone`, `tests`; giữ tương thích backup cũ (nhập backup v1 không có các khoá mới → dùng mặc định, buộc qua onboarding).
- **Streak:** sửa logic "ngày hoàn thành" theo kế hoạch ngày (mục 3.3); ngày cũ đã tính theo luật v1 giữ nguyên, không tính lại.
- **sw.js:** cache 7 gói gần nhất **của track user chọn** (không cache cả 5 track); bump version.
- **Xử lý lỗi bổ sung:** thiếu gói hôm nay của track → dùng gói mới nhất của track đó; track chưa có gói nào (index hỏng) → fallback track `it`/gói v1 mới nhất + thông báo nhẹ; clipboard API bị chặn → hiện prompt trong textarea để copy tay.

## 9. Kiểm thử

- Unit test mới (Node, cùng cơ chế test hiện có): `quiz.js` (sinh câu, distractor không trùng đáp án, phân bố theo trình độ), `prompt.js` (đủ thành phần, encode URL đúng), logic kế hoạch ngày + streak mới, parse `index.json` 2 format + fallback track.
- Cập nhật `scripts/validate-data.mjs` theo schema mới (có `track`, không `interview`).
- Verify thủ công: viewport S23 Ultra, flow onboarding → hôm nay → luyện tập (mở thử ChatGPT/Claude bằng link thật) → ôn tập → làm quiz tuần giả lập.

## 10. Ngoài phạm vi (v2)

- Tài khoản, đăng nhập Google/Facebook, thanh toán/gói trả phí, sync đa thiết bị — Nhóm A, spec riêng.
- Không sinh nội dung động theo từng user (chỉ 5 track tĩnh).
- Không tự động đọc kết quả từ app AI ngoài (user tự đánh dấu xong).
- Không đổi tên app / rebrand (chỉ đổi icon).

## 11. Thứ tự triển khai (cấp cao)

1. Store mở rộng (`profile`, `aiDone`, `tests`) + logic kế hoạch ngày/streak + test
2. Onboarding wizard + view Cài đặt (chuyển backup/restore)
3. Format dữ liệu mới: `data.js` đọc index 2 format, gói theo track, gói mồi 5 track, cập nhật validate-data + PROMPT.md
4. Tab Luyện tập: gộp shadowing + 3 thẻ AI (`prompt.js`), xoá tab/view Phỏng vấn
5. Tab Ôn tập: bài cũ + sổ tay từ vựng
6. Kiểm tra định kỳ: `quiz.js` + UI trong Tiến độ + biểu đồ điểm
7. Icon mới + bump sw + cập nhật màn Hôm nay theo kế hoạch ngày
8. Deploy, test trên điện thoại thật
