export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const sttSupported = !!SR;

let voices = [];
if (ttsSupported) {
  const load = () => { voices = speechSynthesis.getVoices(); };
  load();
  speechSynthesis.onvoiceschanged = load;
}

function pickVoice(lang, gender) {
  const english = voices.filter((v) => v.lang.startsWith('en'));
  const inLang = english.filter((v) => v.lang.replace('_', '-') === lang);
  const pool = inLang.length ? inLang : english;
  const female = pool.find((v) => /female|woman|samantha|zira|libby|aria|sonia|jenny/i.test(v.name));
  const male = pool.find((v) => /(^|[^fe])male|daniel|david|guy|ryan|george/i.test(v.name));
  return (gender === 'male' ? male || female : female || male) || pool[0] || null;
}

export function speak(text, { lang = 'en-US', gender = 'female', rate = 1 } = {}) {
  return new Promise((resolve) => {
    if (!ttsSupported) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const v = pickVoice(lang, gender);
    if (v) u.voice = v;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (ttsSupported) speechSynthesis.cancel();
}

export function listenOnce({ lang = 'en-US', onResult, onError, onEnd } = {}) {
  if (!sttSupported) {
    onError?.('unsupported');
    return null;
  }
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => onResult?.(e.results[0][0].transcript);
  rec.onerror = (e) => onError?.(e.error);
  rec.onend = () => onEnd?.();
  rec.start();
  return rec;
}
