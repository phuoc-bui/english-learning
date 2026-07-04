// Chạy 1 lần: chuyển dữ liệu v1 -> v2 (thêm track "it", bỏ interview, đổi tên file, index mới).
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';

const files = readdirSync('data/packs').filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
const dates = [];
for (const f of files) {
  const date = f.replace('.json', '');
  const pack = JSON.parse(readFileSync(`data/packs/${f}`, 'utf8'));
  pack.track = 'it';
  delete pack.interview;
  writeFileSync(`data/packs/${date}-it.json`, `${JSON.stringify(pack, null, 2)}\n`);
  rmSync(`data/packs/${f}`);
  dates.push(date);
}
dates.sort();
writeFileSync('data/index.json', `${JSON.stringify(dates.map((date) => ({ date, tracks: ['it'] })))}\n`);
console.log(`Migrated ${dates.length} packs`);
