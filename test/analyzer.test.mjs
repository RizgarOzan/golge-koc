// Synthetic skeletons in MediaPipe world-landmark style (metres, hip centre origin, y down).
// Run: node --test test/analyzer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetector, scoreCombo, summarize, moveName } from '../analyzer.js';
import { GUARD, PEAK } from './poses.mjs';

let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.01;

function pose(peak, k) {
  const out = [];
  for (let i = 0; i < 33; i++) {
    const g = GUARD[i] || [0, 0, 0];
    const p = peak?.[i] || g;
    out.push({ x: g[0] + (p[0] - g[0]) * k + noise(), y: g[1] + (p[1] - g[1]) * k + noise(), z: g[2] + (p[2] - g[2]) * k + noise(), visibility: 1 });
  }
  return out;
}

// Timeline of frames at 30 fps: rest, then strikes one after another.
function run(strikes, { rest = 1.0, gap = 0.15, stayDown = false } = {}) {
  const det = createDetector();
  const events = [];
  const frames = [];
  let t = 0;
  const push = (lms) => { const r = det.update(t, lms); events.push(...r.events); frames.push(r.frame); t += 1 / 30; };
  for (; t < rest;) push(pose(null, 0));
  for (const s of strikes) {
    const peak = PEAK[s];
    const n = (d) => Math.round(d * 30);
    for (let i = 1; i <= n(0.15); i++) push(pose(peak, i / n(0.15)));
    for (let i = 0; i < n(0.06); i++) push(pose(peak, 1));
    for (let i = n(0.2) - 1; i >= 0; i--) push(pose(peak, stayDown ? 1 : i / n(0.2)));
    for (let i = 0; i < n(gap); i++) push(pose(stayDown ? peak : null, stayDown ? 1 : 0));
  }
  const tail = [];
  for (let i = 0; i < 30; i++) { push(pose(stayDown ? PEAK[strikes.at(-1)] : null, stayDown ? 1 : 0)); tail.push(frames.at(-1)); }
  return { events, tail };
}

const label = (e) => `${e.kind}:${e.limb}:${e.type}`;

test('single strikes are classified', () => {
  const cases = {
    jabL: 'arm:L:straight', crossR: 'arm:R:straight', hookL: 'arm:L:hook', upperR: 'arm:R:upper',
    midR: 'leg:R:mid', lowR: 'leg:R:low', highR: 'leg:R:high', kneeR: 'leg:R:knee',
  };
  for (const [s, want] of Object.entries(cases)) {
    const { events } = run([s]);
    assert.deepEqual(events.map(label), [want], s);
  }
});

test('footwork step is not a kick', () => {
  assert.equal(run(['step']).events.length, 0);
});

test('combo jab-cross-low kick is read in order and scored ok', () => {
  const { events, tail } = run(['jabL', 'crossR', 'lowR']);
  assert.deepEqual(events.map(label), ['arm:L:straight', 'arm:R:straight', 'leg:R:low']);
  const r = scoreCombo(['jab', 'cross', 'rlow'], events, 'orthodox', 0.8, tail);
  assert.deepEqual(r.moves.map((m) => m.verdict), ['ok', 'ok', 'ok']);
  assert.ok(r.reaction > 0.15 && r.reaction < 0.4, `reaction ${r.reaction}`);
  assert.equal(r.returnedGuard, true);
});

test('arm swing during a middle kick does not count as a punch', () => {
  const { events } = run(['midR']);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'leg');
});

test('southpaw: right straight is the jab', () => {
  const { events, tail } = run(['crossR']);
  const r = scoreCombo(['jab'], events, 'southpaw', 0.8, tail);
  assert.equal(r.moves[0].verdict, 'ok');
});

test('dropping the other hand and wrong side are reported', () => {
  const { events, tail } = run(['dropHandsJab', 'hookL']);
  const r = scoreCombo(['jab', 'rhook'], events, 'orthodox', 0.8, tail);
  assert.equal(r.moves[0].guardDrop, true);
  assert.equal(r.moves[1].verdict, 'wrongSide');
  const s = summarize([r, r, r], 0.5);
  assert.ok(s.tips.some((t) => t.includes('boştaki elin')), s.tips.join('\n'));
  assert.ok(s.tips.some((t) => t.includes('Sağ ve solu')), s.tips.join('\n'));
  assert.ok(s.tips.some((t) => t.includes('Komut beklerken')), s.tips.join('\n'));
});

test('missed moves and no return to guard', () => {
  const { events, tail } = run(['jabL'], { stayDown: true });
  const r = scoreCombo(['jab', 'cross', 'lhook'], events, 'orthodox', 0.8, tail);
  assert.deepEqual(r.moves.map((m) => m.verdict), ['ok', 'missed', 'missed']);
});

test('spoken names', () => {
  assert.equal(moveName('jab', 'orthodox').say, 'cab');
  assert.equal(moveName('lhook', 'orthodox').show, 'Sol kroşe');
  assert.equal(moveName('lhook', 'southpaw').show, 'Sağ kroşe');
  assert.equal(moveName('rlow', 'orthodox').show, 'Sağ low kick');
});
