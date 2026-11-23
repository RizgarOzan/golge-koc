// Prints leg features over a time window so missed kicks/knees can be inspected.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [, , appDir, poseFile, a, b, side = 'L'] = process.argv;
const A = await import(pathToFileURL(appDir + '/analyzer.js'));
const { frames } = JSON.parse(fs.readFileSync(poseFile, 'utf8'));
const det = A.createDetector();
const sub = (x, y) => x.map((v, i) => v - y[i]);
const dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
const len = (x) => Math.hypot(...x);
for (const fr of frames) {
  if (!fr.w) continue;
  const world = fr.w.map(([x, y, z], i) => ({ x, y, z, visibility: fr.v[i] }));
  const r = det.update(fr.t, world);
  if (fr.t < +a || fr.t > +b || Math.round(fr.t * 30) % 3) continue;
  const f = r.frame, rest = det.rest;
  const ks = [side + 'A', side + 'K'];
  const d = Math.max(...ks.map((k) => len(sub(f.pos[k], rest[k]))));
  const rise = Math.max(...ks.map((k) => dot(sub(f.pos[k], rest[k]), f.up)));
  const s = side === 'L' ? 'l' : 'r';
  console.log(fr.t.toFixed(1), r.still ? 'S' : ' ', 'd', d.toFixed(2), 'rise', rise.toFixed(2), 'knH', f.h[s + 'Kn'].toFixed(2), 'anH', f.h[s + 'An'].toFixed(2), 'legS', f.legS[side].toFixed(2), 'restKnH', dot(rest[side + 'K'], f.up).toFixed(2), r.events.map((e) => e.kind + e.limb + e.type).join(','));
}
