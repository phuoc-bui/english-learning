// Dựng prompt mở ChatGPT/Claude/Gemini cho 3 hoạt động thực hành + kiểm tra định kỳ.
export const AI_APPS = {
  chatgpt: { name: 'ChatGPT', url: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
  claude: { name: 'Claude', url: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
  gemini: { name: 'Gemini', url: () => 'https://gemini.google.com/app' },
  other: { name: 'app AI', url: () => null },
};

const LEVEL_EN = {
  a2: 'beginner (CEFR A2)',
  b1: 'intermediate (CEFR B1)',
  b2: 'upper-intermediate (CEFR B2+)',
};

const GOAL_EN = {
  work: 'communicating at work',
  interview: 'preparing for job interviews',
  email: 'writing professional emails',
  presentation: 'giving presentations',
  smalltalk: 'making small talk with colleagues',
};

const SCENARIO = {
  conversation: (theme) => `Let's do a roleplay conversation about "${theme}". You play the other person (a colleague, customer, or interviewer — whichever fits the topic). Keep each of your turns short (1-3 sentences) and wait for my reply. Gently correct my mistakes as we go.`,
  speaking: (theme) => `I want to practice speaking. Give me one short speaking task at a time about "${theme}" (describe, explain, or give my opinion). After each answer, point out my grammar and word-choice mistakes and show a better way to say it. Give me 3 tasks in total.`,
  writing: (theme) => `I want to practice writing. Give me one realistic workplace writing task about "${theme}" (a short email or message, 80-120 words). After I submit my text, correct it line by line, explain the mistakes simply, then show an improved version.`,
};

export function buildPrompt(kind, pack, profile) {
  const words = (pack.vocab || []).map((v) => v.word).join(', ');
  const goals = (profile.goals || []).map((g) => GOAL_EN[g]).filter(Boolean).join('; ');
  return [
    `You are my English coach. My level is ${LEVEL_EN[profile.level] || LEVEL_EN.b1}. Please use simple English that matches my level.`,
    goals ? `My learning goals: ${goals}.` : '',
    SCENARIO[kind](pack.theme),
    words ? `Today I learned these words — use them naturally and encourage me to use them too: ${words}.` : '',
    'At the end of the session, give me a summary in Vietnamese: my main grammar mistakes, word-choice issues, and 3 concrete tips to improve.',
  ].filter(Boolean).join('\n\n');
}

export function taskDesc(kind, pack) {
  return {
    conversation: `Nhập vai hội thoại chủ đề "${pack.theme}" — AI sửa lỗi trong lúc chat`,
    speaking: `3 đề nói ngắn về "${pack.theme}" — dùng voice mode của app AI`,
    writing: `Viết email/tin nhắn ~100 từ chủ đề "${pack.theme}" — AI chữa từng câu`,
  }[kind];
}

export function buildAiTestPrompt(words, themes, profile) {
  return [
    `You are my English examiner. My level is ${LEVEL_EN[profile.level] || LEVEL_EN.b1}.`,
    `Test my English on these workplace topics I studied recently: ${themes.join('; ')}.`,
    `Focus on this vocabulary: ${words.join(', ')}.`,
    'Ask me 5 questions one by one (mix short speaking-style answers and one short writing task). After all 5, give me a score out of 10 and a summary in Vietnamese: strengths, mistakes, and what to review.',
  ].join('\n\n');
}
