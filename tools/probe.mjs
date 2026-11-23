// Feature distributions of arm events: likely-true vs likely-false groups.
import fs from 'node:fs';
const [, , evF, poseF, groupsJson] = process.argv;
const { events } = JSON.parse(fs.readFileSync(evF));
const { frames } = JSON.parse(fs.readFileSync(poseF));
const groups = JSON.parse(groupsJson); // [[from,to,limb,label]]
const fr = frames.filter((f) => f.w);
const S = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], L = (a) => Math.hypot(...a);
const M = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
function feat(f, side) {
  const w = f.w, sh = M(w[11], w[12]), hip = M(w[23], w[24]), T = L(S(sh, hip));
  const [s, e, r] = side === 'L' ? [11, 13, 15] : [12, 14, 16];
  return { v: S(w[r], sh).map((x) => x / T), st: L(S(w[r], w[s])) / (L(S(w[e], w[s])) + L(S(w[r], w[e]))), reach: L(S(w[r], w[s])) / T };
}
const arm = events.filter((e) => e.kind === 'arm');
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]?.toFixed(2); };
for (const [a, b, limb, name] of groups) {
  const evs = arm.filter((e) => e.start >= a && e.start < b && e.limb === limb);
  const rows = evs.map((e) => {
    const win = fr.filter((f) => f.t >= e.start - 0.2 && f.t <= e.end);
    let vmax = 0, stmax = 0, reach = 0;
    for (let i = 1; i < win.length; i++) {
      const p = feat(win[i - 1], limb), q = feat(win[i], limb);
      vmax = Math.max(vmax, L(S(q.v, p.v)) / (win[i].t - win[i - 1].t));
      stmax = Math.max(stmax, q.st); reach = Math.max(reach, q.reach);
    }
    const other = arm.filter((o) => o.limb !== limb).map((o) => Math.abs(o.start - e.start));
    return { vmax, stmax, reach, dur: e.end - e.start, sync: Math.min(9, ...other) };
  });
  const k = (f) => rows.map(f);
  console.log(name.padEnd(22), 'n', String(rows.length).padStart(3),
    '| vmax p25/50/75', pct(k((r) => r.vmax), .25), pct(k((r) => r.vmax), .5), pct(k((r) => r.vmax), .75),
    '| reach', pct(k((r) => r.reach), .25), pct(k((r) => r.reach), .5), pct(k((r) => r.reach), .75),
    '| dur', pct(k((r) => r.dur), .5), '| sync<0.15', rows.filter((r) => r.sync < 0.15).length);
}
