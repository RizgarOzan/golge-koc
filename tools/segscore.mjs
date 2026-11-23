// Per labelled segment: how many detected events fall in the allowed set, plus an overall precision.
import fs from 'node:fs';
const [, , evF, segF, mirror] = process.argv;
const { events } = JSON.parse(fs.readFileSync(evF));
const segs = JSON.parse(fs.readFileSync(segF));
const flip = { L: 'R', R: 'L' };
const lab = (e) => e.kind[0] + (mirror ? flip[e.limb] : e.limb) + e.type.slice(0, 4);
let ok = 0, all = 0;
for (const [a, b, name, allowed] of segs) {
  const a2 = a + (process.env.TRIM ? +process.env.TRIM : 0); const evs = events.filter((e) => e.start >= a2 && e.start < b);
  const set = new Set(allowed.split(' ').filter(Boolean));
  const good = evs.filter((e) => set.has(lab(e))).length;
  if (set.size) { ok += good; all += evs.length; }
  const c = {}; for (const e of evs) c[lab(e)] = (c[lab(e)] || 0) + 1;
  const top = Object.entries(c).sort((x, y) => y[1] - x[1]).map(([k, v]) => k + ':' + v).join(' ');
  console.log(`${String(a).padStart(3)} ${name.padEnd(20)} n=${String(evs.length).padEnd(3)} ok=${set.size ? Math.round(100 * good / (evs.length || 1)) + '%' : '-'}`.padEnd(42), top);
}
console.log('OVERALL precision', Math.round(100 * ok / all) + '%', `(${ok}/${all})`);
