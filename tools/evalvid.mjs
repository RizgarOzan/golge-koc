// Runs the app's analyzer over extracted pose JSON and lines detections up against spoken callouts in the captions.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [, , appDir, poseFile, vttFile] = process.argv;
const A = await import(pathToFileURL(appDir + '/analyzer.js'));
const { frames } = JSON.parse(fs.readFileSync(poseFile, 'utf8'));

const det = A.createDetector();
const events = [];
for (const f of frames) {
  if (!f.w) continue;
  const world = f.w.map(([x, y, z], i) => ({ x, y, z, visibility: f.v[i] }));
  events.push(...det.update(f.t, world).events);
}

// Word-level times from YouTube auto captions.
const words = [];
const toS = (s) => { const [h, m, r] = s.split(':'); return +h * 3600 + +m * 60 + +r; };
const vtt = fs.readFileSync(vttFile, 'utf8').split(/\n\n+/);
for (const cue of vtt) {
  const m = cue.match(/^(\d\d:\d\d:\d\d\.\d+) -->/m);
  if (!m) continue;
  for (const line of cue.split('\n')) {
    if (!line.includes('<c>')) continue;
    let t = toS(m[1]);
    for (const part of line.split(/(<\d\d:\d\d:\d\d\.\d+>)/)) {
      const tm = part.match(/^<(.+)>$/);
      if (tm) { t = toS(tm[1]); continue; }
      for (const w of part.replace(/<\/?c>/g, ' ').toLowerCase().match(/[a-z]+/g) || []) words.push({ t, w });
    }
  }
}
const KIND = { jab: 'arm', cross: 'arm', hook: 'arm', uppercut: 'arm', kick: 'leg', roundhouse: 'leg', knee: 'leg', teep: 'leg' };
const calls = words.filter((x) => KIND[x.w]);

const lab = (e) => `${e.kind}:${e.limb}:${e.type}`;
const count = (xs, k) => xs.reduce((m, x) => ((m[k(x)] = (m[k(x)] || 0) + 1), m), {});
console.log('duration', frames.at(-1).t.toFixed(0), 's, events', events.length, 'callouts', calls.length);
console.log('events by type', count(events, lab));
console.log('callouts', count(calls, (c) => c.w));

// Recall: a callout counts as matched if an event of the same kind starts within 0..2.5 s after it.
const used = new Set();
const res = {};
for (const c of calls) {
  const e = events.find((e, i) => !used.has(i) && e.kind === KIND[c.w] && e.start >= c.t - 0.3 && e.start <= c.t + 2.5);
  const r = (res[c.w] ||= { n: 0, hit: 0, types: {} });
  r.n++;
  if (e) { used.add(events.indexOf(e)); r.hit++; r.types[e.type] = (r.types[e.type] || 0) + 1; }
}
for (const [w, r] of Object.entries(res)) console.log(w.padEnd(10), `${r.hit}/${r.n}`, JSON.stringify(r.types));
// Events per 10 s window vs callouts, to see if the detector fires when nobody is moving.
const quiet = events.filter((e) => !calls.some((c) => e.start >= c.t - 1 && e.start <= c.t + 4)).length;
console.log('events far from any callout', quiet);
if (process.argv[5]) fs.writeFileSync(process.argv[5], JSON.stringify({ events, calls }));
