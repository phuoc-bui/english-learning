export function makePack(date) {
  return {
    date,
    theme: 'Daily standup meeting',
    vocab: [{
      word: `blocker-${date}`,
      ipa: '/ˈblɒkə/',
      meaning_vi: 'vấn đề cản trở công việc',
      example: 'I have a blocker with the payment API.',
      example_vi: 'Tôi đang bị vướng ở API thanh toán.',
    }],
    listening: {
      title: 'Morning standup',
      lines: [
        { speaker: 'A', voice: 'male', text: "Let's start with yesterday." },
        { speaker: 'B', voice: 'female', text: 'I finished the login page.' },
        { speaker: 'A', voice: 'male', text: 'Any blockers?' },
        { speaker: 'B', voice: 'female', text: 'No blockers today.' },
      ],
      questions: [
        { q: 'What did speaker B finish?', options: ['The login page', 'The API'], answer: 0 },
      ],
    },
    shadowing: ['Yesterday I worked on the login page.'],
    interview: [{
      question: 'Tell me about yourself.',
      type: 'common',
      tips_vi: ['Nói 60-90 giây', 'Nêu kinh nghiệm liên quan nhất'],
      sample_answer: 'I am a software developer with five years of experience...',
    }],
  };
}
