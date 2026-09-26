# Ý tưởng: Học qua phim & nhạc — "Săn câu" (bản phác thảo)

**Ngày:** 2026-09-24
**Trạng thái:** MVP (giai đoạn 1) đã làm — xem mục 8
**Bối cảnh:** Gói bài công sở soạn sẵn mỗi ngày (v2) chạy ổn về kỹ thuật nhưng không đủ hấp dẫn để duy trì thói quen. Thứ người dùng *đã* xem mỗi ngày: hoạt hình 3D Trung Quốc (donghua), video YouTube, nhạc trên YouTube Music. Ý tưởng: đưa việc học vào chính những thứ đó thay vì bắt người dùng mở một bài học riêng.

## 1. Nguyên lý

- **Sentence mining (săn câu):** xem/nghe như bình thường, gặp câu hay hoặc từ lạ thì "bắt" lại cả câu kèm ngữ cảnh → biến thành thẻ ôn SRS. Nhớ lâu hơn học từ rời vì gắn với cảnh phim/giai điệu mình thích.
- **i+1:** câu đáng bắt nhất là câu mình hiểu gần hết, chỉ vướng 1 từ/1 cụm.
- **Nội dung do người dùng chọn, app chỉ lo phần "ghi – hiểu – ôn".** Không cố thay YouTube/YouTube Music; app là cuốn sổ bỏ túi bên cạnh.

## 2. Thực tế từng nguồn (cần biết trước)

| Nguồn | Tiếng Anh nằm ở đâu | Học được gì | Lưu ý |
|---|---|---|---|
| Donghua 3D (Đấu Phá, Đấu La, Phàm Nhân Tu Tiên…) | **Phụ đề tiếng Anh** trên kênh chính thức (Tencent, Bilibili, Youku); vài bộ có **lồng tiếng Anh** | Đọc, từ vựng cảm xúc/hành động ("How dare you", "hold back", "reckless") | Tiếng gốc là tiếng Trung → **không luyện nghe được** trừ bản lồng tiếng Anh. Bản dịch hay dùng từ tu tiên (cultivation, sect, realm) — vui nhưng ít dùng ngoài đời |
| Video YouTube tiếng Anh | Tiếng nói + CC/transcript | Nghe, nói, câu tự nhiên | Nguồn tốt nhất cho nghe & shadowing |
| Nhạc YouTube Music | Lời bài hát (tab Lyrics), có bài chạy theo thời gian | Phát âm, nối âm, cụm từ | Lời bài hát có bản quyền → chỉ lưu vài dòng người dùng chọn, **không lưu nguyên bài vào repo** |

→ Gợi ý phân vai: **donghua = đọc & vui**, **YouTube = nghe & nói**, **nhạc = phát âm & hát theo**.

## 3. Luồng chính

```
Đang xem/nghe  ──(Share)──►  App "Office English"  ──►  Kho câu (inbox)
                                                          │
                                  Làm rõ nghĩa (tự gõ / tra / nhờ AI)
                                                          │
                                                          ▼
                                 Thẻ SRS có ngữ cảnh + link về đúng giây
                                                          │
                                          Ôn hằng ngày · Shadowing · Quiz
```

### 3.1 Bắt câu (≤ 15 giây, không rời app đang xem quá lâu)
- **Web Share Target:** khai báo `share_target` trong `manifest.webmanifest`. Trong app YouTube / YouTube Music bấm **Chia sẻ → Office English** → app mở form "Bắt câu" đã điền sẵn link + tiêu đề video.
- Form gồm: câu tiếng Anh (dán hoặc gõ), bôi chọn từ/cụm muốn học, thời điểm (mm:ss, tuỳ chọn), loại nguồn (donghua / video / nhạc), ghi chú nhanh.
- Có cả nút **＋ Bắt câu** trong app cho lúc không chia sẻ được.

### 3.2 Làm rõ nghĩa (không cần backend)
- **Tự điền** nghĩa tiếng Việt (nhanh nhất, nhớ tốt nhất).
- **Tra tự động** IPA + phát âm + định nghĩa tiếng Anh qua API từ điển miễn phí (vd. dictionaryapi.dev — cần kiểm tra CORS khi làm).
- **Nhờ AI theo lô:** nút "Giải nghĩa N câu trong kho" → mở Claude/ChatGPT với prompt (tái dùng `js/prompt.js`) yêu cầu trả về JSON: nghĩa tiếng Việt theo ngữ cảnh, IPA, cách dùng, 1 câu ví dụ công sở. Người dùng dán JSON lại → app tạo thẻ. Cách này khớp kiến trúc hiện tại (không backend, AI ngoài).

### 3.3 Ôn
- Thẻ mới đi chung SRS hiện có (`js/srs.js`), mặt trước là **câu gốc có chỗ trống**, mặt sau là nghĩa + nút **▶ Xem lại cảnh** (mở `youtube.com/watch?v=…&t=123s`, hoặc nhúng iframe tự dừng sau vài giây).
- **Shadowing câu đã bắt:** tái dùng chấm điểm STT của tab Luyện tập — ưu tiên câu từ video/nhạc.
- **Chế độ nhạc:** dán đoạn điệp khúc → điền từ còn thiếu khi nghe (kiểu LyricsTraining), hát theo từng dòng.
- Quiz tuần/tháng (`js/quiz.js`) lấy thêm nguồn từ thẻ tự bắt.

## 4. Giữ động lực

- Mục tiêu ngày đổi sang **"bắt 3 câu"** (hoặc ôn hết thẻ đến hạn) — làm được ngay lúc đang xem, tính streak.
- Gói bài công sở hằng ngày giữ lại nhưng thành **tuỳ chọn**.
- Tab mới **"Sưu tập"**: câu đã bắt nhóm theo bộ phim/bài hát — nhìn thấy mình "sưu tầm" được bao nhiêu câu của *Đấu Phá Thương Khung* tạo cảm giác tiến bộ.
- Tuỳ chọn về sau: routine Claude mỗi tuần gợi ý 3–5 video/bài hát tiếng Anh phù hợp B1 theo sở thích (chỉ gửi link, không chép lời/phụ đề).

## 5. Dữ liệu (nháp)

Lưu localStorage qua `store.js`, có trong backup:

```json
{
  "mined": [{
    "id": "m_1727160000",
    "text": "You're courting death!",
    "focus": "courting death",
    "meaning_vi": "muốn chết à / tự tìm đường chết",
    "ipa": "", "note": "",
    "source": { "kind": "donghua|video|music", "title": "", "url": "", "t": 123 },
    "createdAt": "2026-09-24",
    "status": "inbox|card"
  }]
}
```

Không ghi câu/lời bài hát vào repo công khai (bản quyền + riêng tư).

## 6. Lộ trình gợi ý

1. **MVP (1–2 buổi):** `share_target` + form Bắt câu + kho câu + tự điền nghĩa + đưa vào SRS + nút "Xem lại cảnh". Dùng thử 1 tuần.
2. Nhờ AI giải nghĩa theo lô (dán JSON) + tra từ điển tự động.
3. Shadowing câu đã bắt + chế độ nhạc điền từ.
4. Tab Sưu tập, mục tiêu "bắt 3 câu/ngày", gợi ý nội dung hằng tuần.

## 7. Câu hỏi cần chốt

- Có muốn xem donghua **bản lồng tiếng Anh** để luyện nghe, hay chấp nhận donghua chỉ để đọc phụ đề?
- Gói bài công sở: giữ song song, hạ thành tuỳ chọn, hay tạm dừng routine?
- Nghĩa tiếng Việt: thích tự gõ, hay luôn để AI giải nghĩa?
- Có dùng máy tính khi xem không? (Trên desktop có thể dùng thêm extension phụ đề song ngữ như Language Reactor; Chrome Android không chạy extension.)

## 8. Đã chốt & MVP (2026-09-26)

- Donghua: **chỉ đọc phụ đề tiếng Anh**; gặp bản lồng tiếng Anh thì dùng cùng luồng. Web donghua có thể cần VPN — app không tải trang đó, chỉ lưu link; ưu tiên kênh chính thức trên YouTube để "Xem lại cảnh" mở đúng giây.
- Nguồn tự do: chia sẻ link từ **bất kỳ** app/web nào (YouTube, YouTube Music, Chrome…), thêm được nhiều phim khác nhau.
- Không xem phim trong app: web phim thường chặn nhúng; trên Android dùng chia đôi màn hình. Nhúng trình phát YouTube để giai đoạn sau.

**Đã làm:**
- `manifest.webmanifest` khai báo `share_target` (GET `./?title&text&url`); `js/app.js` nhận dữ liệu chia sẻ → mở `#clips`; `sw.js` phục vụ index đã cache cho URL có query khi offline.
- `js/clip.js`: tách link/tiêu đề/giây từ dữ liệu chia sẻ, chuẩn hoá link YouTube (bỏ `si=`, thêm `&t=`), tách từ để chạm chọn.
- `js/views/clips.js`: form **Bắt câu** (câu, chạm chọn từ/cụm, nghĩa, ghi chú, loại nguồn, tên phim/tập, link, phút:giây) + danh sách **Chờ giải nghĩa** / **Bộ sưu tập**.
- `store.js`: `mined[]`; câu có nghĩa thành thẻ trong `srs`/`wordMeta` với `track: 'clip'` (không đè từ của gói bài), có trong backup.
- Thẻ Từ vựng hiện câu gốc + nguồn, mặt sau có **Xem lại cảnh**; Sổ tay có bộ lọc "Phim & nhạc"; màn Hôm nay có thẻ **Săn câu**.
- Chưa tính vào streak (giai đoạn 4).
