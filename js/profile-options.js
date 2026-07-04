// Lựa chọn hồ sơ dùng chung cho onboarding + cài đặt.
export const TRACK_OPTIONS = [
  { value: 'it', label: 'IT / Phần mềm', desc: 'Standup, code review, bug, demo sản phẩm' },
  { value: 'office', label: 'Văn phòng chung', desc: 'Họp hành, email, small talk, báo cáo' },
  { value: 'sales', label: 'Sales & Marketing', desc: 'Gặp khách, pitch, đàm phán, follow-up' },
  { value: 'finance', label: 'Tài chính / Kế toán', desc: 'Báo cáo số liệu, ngân sách, kiểm toán' },
  { value: 'interview', label: 'Phỏng vấn xin việc', desc: 'Trả lời phỏng vấn, deal lương' },
];
export const TRACK_LABEL = Object.fromEntries(TRACK_OPTIONS.map((o) => [o.value, o.label]));

export const LEVEL_OPTIONS = [
  { value: 'a2', label: 'Sơ cấp (A2)', desc: 'Nghe nói cơ bản, vốn từ còn ít' },
  { value: 'b1', label: 'Trung cấp (B1)', desc: 'Giao tiếp được nhưng chưa tự tin' },
  { value: 'b2', label: 'Khá (B2+)', desc: 'Khá tự tin, muốn trau chuốt hơn' },
];

export const GOAL_OPTIONS = [
  { value: 'work', label: 'Giao tiếp trong công việc' },
  { value: 'interview', label: 'Chuẩn bị phỏng vấn' },
  { value: 'email', label: 'Viết email chuyên nghiệp' },
  { value: 'presentation', label: 'Thuyết trình' },
  { value: 'smalltalk', label: 'Small talk với đồng nghiệp' },
];

export const MINUTE_OPTIONS = [
  { value: 15, label: '15 phút / ngày', desc: 'Từ vựng + Nghe + Shadowing' },
  { value: 30, label: '30 phút / ngày', desc: 'Cốt lõi + 1 hoạt động với AI' },
  { value: 45, label: '45+ phút / ngày', desc: 'Cốt lõi + 2 hoạt động với AI' },
];

export const AI_APP_OPTIONS = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'other', label: 'App khác (chỉ copy prompt)' },
];
