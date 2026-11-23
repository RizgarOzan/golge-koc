// Per-segment event mix for a video whose coach repeats one labelled combo per round.
import fs from 'node:fs';
const [, , evFile, segFile] = process.argv;
const { events } = JSON.parse(fs.readFileSync(evFile, 'utf8'));
const segs = JSON.parse(fs.readFileSync(segFile, 'utf8'));
const lab = (e) => `${e.kind === 'arm' ? 'a' : 'l'}${e.limb}${e.type.slice(0, 4)}`;
for (const [a, b, name] of segs) {
  const xs = events.filter((e) => e.start >= a && e.start < b);
  const c = {};
  for (const e of xs) c[lab(e)] = (c[lab(e)] || 0) + 1;
  console.log(`${String(a).padStart(3)}-${String(b).padEnd(3)} ${name.padEnd(26)} n=${String(xs.length).padEnd(3)}`, Object.entries(c).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}:${v}`).join(' '));
}
