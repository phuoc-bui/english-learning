const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

export function validatePack(pack) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return ['pack is not an object'];
  const errors = [];
  const err = (msg) => errors.push(msg);

  if (!isStr(pack.date) || !/^\d{4}-\d{2}-\d{2}$/.test(pack.date)) err('date must be YYYY-MM-DD');
  if (!isStr(pack.theme)) err('theme is required');

  if (!Array.isArray(pack.vocab) || pack.vocab.length < 1 || pack.vocab.length > 12) {
    err('vocab must be an array of 1-12 items');
  } else {
    pack.vocab.forEach((v, i) => {
      for (const f of ['word', 'ipa', 'meaning_vi', 'example', 'example_vi']) {
        if (!isStr(v?.[f])) err(`vocab[${i}].${f} missing`);
      }
    });
  }

  const L = pack.listening;
  if (!L || typeof L !== 'object') {
    err('listening missing');
  } else {
    if (!isStr(L.title)) err('listening.title missing');
    if (!Array.isArray(L.lines) || L.lines.length < 4) {
      err('listening.lines must have at least 4 lines');
    } else {
      L.lines.forEach((l, i) => {
        if (!isStr(l?.speaker) || !isStr(l?.text)) err(`listening.lines[${i}] invalid`);
        if (!['male', 'female'].includes(l?.voice)) err(`listening.lines[${i}].voice must be male|female`);
      });
    }
    if (!Array.isArray(L.questions) || L.questions.length < 1) {
      err('listening.questions missing');
    } else {
      L.questions.forEach((q, i) => {
        if (!isStr(q?.q)) err(`listening.questions[${i}].q missing`);
        if (!Array.isArray(q?.options) || q.options.length < 2 || !q.options.every(isStr)) {
          err(`listening.questions[${i}].options invalid`);
        } else if (!Number.isInteger(q?.answer) || q.answer < 0 || q.answer >= q.options.length) {
          err(`listening.questions[${i}].answer out of range`);
        }
      });
    }
  }

  if (!Array.isArray(pack.shadowing) || pack.shadowing.length < 1 || pack.shadowing.length > 10
      || !pack.shadowing.every(isStr)) {
    err('shadowing must be 1-10 non-empty strings');
  }

  if (!Array.isArray(pack.interview) || pack.interview.length < 1) {
    err('interview missing');
  } else {
    pack.interview.forEach((it, i) => {
      if (!isStr(it?.question)) err(`interview[${i}].question missing`);
      if (!['behavioral', 'technical', 'common'].includes(it?.type)) err(`interview[${i}].type invalid`);
      if (!Array.isArray(it?.tips_vi) || it.tips_vi.length < 1 || !it.tips_vi.every(isStr)) {
        err(`interview[${i}].tips_vi invalid`);
      }
      if (!isStr(it?.sample_answer)) err(`interview[${i}].sample_answer missing`);
    });
  }

  return errors;
}
