// Nạp YouTube IFrame Player API một lần, dùng cho màn Xem trong app.
let apiPromise = null;

export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { apiPromise = null; reject(new Error('Không tải được YouTube')); };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

// Mã lỗi của player -> thông báo tiếng Việt
export function playerErrorText(code) {
  if (code === 101 || code === 150 || code === 153) return 'Chủ kênh không cho phát video này ngoài YouTube.';
  if (code === 100) return 'Video không tồn tại hoặc đã bị ẩn.';
  return 'Không phát được video này trong app.';
}
