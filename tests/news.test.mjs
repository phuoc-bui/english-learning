import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchUrl, articleUrl, htmlToParagraphs, splitSentences, listNews, getArticle, stripTags } from '../js/news.js';

test('searchUrl: theo chủ đề hoặc từ khoá', () => {
  const u = new URL(searchUrl({ topic: 'technology' }, 'K'));
  assert.equal(u.searchParams.get('section'), 'technology');
  assert.equal(u.searchParams.get('api-key'), 'K');
  const q = new URL(searchUrl({ topic: 'technology', q: 'AI chips' }, 'K'));
  assert.equal(q.searchParams.get('q'), 'AI chips');
  assert.equal(q.searchParams.get('section'), null);
});

test('articleUrl giữ dấu / của id', () => {
  assert.match(articleUrl('technology/2026/sep/26/ai-news', 'K'), /^https:\/\/content\.guardianapis\.com\/technology\/2026\/sep\/26\/ai-news\?/);
});

test('htmlToParagraphs chỉ lấy chữ trong <p>, giải mã ký tự', () => {
  const html = '<figure><img src="x"></figure><p>Apple&#39;s new <a href="#">chip</a> is fast.</p><aside><p> </p></aside><p>Tom &amp; Jerry said &ldquo;hi&rdquo;.</p>';
  assert.deepEqual(htmlToParagraphs(html), ["Apple's new chip is fast.", 'Tom & Jerry said “hi”.']);
  assert.equal(stripTags('<script>x</script>'), 'x');
});

test('splitSentences giữ viết tắt', () => {
  assert.deepEqual(splitSentences('Mr. Smith went to the U.S. yesterday. He said "Wow!" Then he left'), [
    'Mr. Smith went to the U.S. yesterday.', 'He said "Wow!"', 'Then he left',
  ]);
});

test('listNews / getArticle map dữ liệu, lỗi key', async () => {
  const fake = (body, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });
  const list = await listNews({ topic: 'film' }, 'K', fake({ response: { pages: 3, results: [{ id: 'film/a', webTitle: 'T', webUrl: 'https://g/a', webPublicationDate: '2026-09-26T10:00:00Z', sectionName: 'Film', fields: { trailText: '<b>Hi</b>', wordcount: '800' } }] } }));
  assert.equal(list.pages, 3);
  assert.deepEqual(list.items[0], { id: 'film/a', title: 'T', url: 'https://g/a', date: '2026-09-26', section: 'Film', trail: 'Hi', thumb: '', words: 800 });
  const art = await getArticle('film/a', 'K', fake({ response: { content: { id: 'film/a', webTitle: 'T', webUrl: 'u', webPublicationDate: '2026-09-26', fields: { body: '<p>One.</p><p>Two.</p>', byline: 'B' } } } }));
  assert.deepEqual(art.paragraphs, ['One.', 'Two.']);
  await assert.rejects(listNews({}, 'bad', fake({}, 401)), (e) => e.code === 'key');
  await assert.rejects(listNews({}, 'K', async () => { throw new TypeError('Failed to fetch'); }), (e) => e.code === 'network');
});

test('DEV.to: danh sách + bài, bỏ khối code, lấy tiêu đề mục và gạch đầu dòng', async () => {
  const { listDev, getDevArticle, devListUrl } = await import('../js/news.js');
  assert.equal(new URL(devListUrl({ topic: 'ai' })).searchParams.get('tag'), 'ai');
  const fake = (body) => async () => ({ ok: true, status: 200, json: async () => body });
  const l = await listDev({ topic: 'ai' }, fake([{ id: 7, title: 'T', url: 'https://dev.to/x', published_at: '2026-09-25T01:00:00Z', user: { name: 'Ann' }, description: 'D', reading_time_minutes: 4 }]));
  assert.equal(l.items[0].id, '7');
  assert.equal(l.items[0].section, 'Ann');
  assert.equal(l.pages, 1);
  const a = await getDevArticle('7', fake({ id: 7, title: 'T', url: 'u', user: { name: 'Ann' }, body_html: '<h2>Why</h2><p>It is fast.</p><pre><code>let x = 1;</code></pre><ul><li>Easy to learn</li></ul>' }));
  assert.deepEqual(a.paragraphs, ['Why', 'It is fast.', 'Easy to learn']);
});
