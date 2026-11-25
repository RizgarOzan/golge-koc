// Run: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeek, programStatus, weakSpots, pickFocus, levelAdvice, judgeRound, judgeFight } from '../coach.js';
import { comboText, attackText } from '../analyzer.js';

test('week plan grows a round every two weeks, capped', () => {
  const w0 = buildWeek('1', 3, 0);
  assert.deepEqual(w0.map((s) => s.mode), ['session', 'bag', 'shadow']);
  assert.deepEqual(w0.map((s) => s.rounds), [1, 2, 2]);
  assert.equal(w0[0].minutes, 2);
  assert.equal(buildWeek('2', 4, 4)[1].rounds, 5);
  assert.equal(buildWeek('2', 4, 40)[1].rounds, 6);
});

test('program status counts only this week\'s program sessions', () => {
  const start = new Date(2026, 10, 23, 9).getTime(); // Monday
  const now = new Date(2026, 10, 26, 18).getTime();
  const hist = [{ program: true, at: start + 3600e3 }, { program: false, at: start + 7200e3 }];
  const st = programStatus({ start, level: '1', days: 3 }, hist, now);
  assert.equal(st.week, 0);
  assert.equal(st.done, 1);
  assert.equal(st.next.mode, 'bag');
});

test('weak spots and focus picking', () => {
  const hist = [{ byMove: { lhook: { tries: 4, ok: 1 }, jab: { tries: 5, ok: 5 } }, byAttack: { low: { tries: 3, ok: 0 } } }];
  assert.deepEqual(weakSpots(hist), { moves: ['lhook'], attacks: ['low'] });
  const pool = [['jab'], ['jab', 'lhook']];
  let hits = 0;
  for (let i = 0; i < 400; i++) if (pickFocus(pool, ['lhook'], () => i / 400) === pool[1]) hits++;
  assert.equal(hits, 300);
});

test('level advice needs three sessions', () => {
  const good = { mode: 'session', level: '1', accuracy: 0.9 };
  assert.equal(levelAdvice([good, good], '1'), null);
  assert.equal(levelAdvice([good, good, good], '1'), 'up');
  assert.equal(levelAdvice([good, good, good], '3'), null);
});

test('round judging on the 10-point must system', () => {
  assert.deepEqual(judgeRound({ landed: 3, defended: 2, hit: 1 }).score, [10, 9]);
  assert.deepEqual(judgeRound({ landed: 5, defended: 3, hit: 1 }).score, [10, 8]);
  assert.equal(judgeRound({ landed: 1, hit: 4 }).result, 'loss');
  assert.deepEqual(judgeRound({ landed: 1, hit: 4 }).score, [8, 10]);
  assert.equal(judgeRound({}).result, 'draw');
  assert.equal(judgeFight([{ score: [10, 9] }, { score: [9, 10] }, { score: [10, 9] }]).result, 'win');
});

test('left/right calling', () => {
  assert.deepEqual(comboText(['jab', 'cross', 'lhook'], 'orthodox', 'lr'), { show: 'Sol sağ düz · Sol kroşe', say: 'sol sağ düz, sol kroşe' });
  assert.equal(comboText(['cross', 'cross', 'llow'], 'orthodox', 'lr').show, 'Sağ sağ düz · Sol low kick');
  assert.equal(comboText(['jab', 'cross'], 'orthodox').show, 'Jab · Kros');
  assert.equal(attackText(['llow', 'high'], 'lr').show, 'Sol low sağ high kick!');
  assert.equal(attackText(['cross'], 'lr').show, 'Sağ düz!');
  assert.equal(attackText(['llow', 'high'], 'lr').say, 'sol lov sağ hay kik geldi');
  assert.equal(attackText(['jab', 'hook']).show, 'Jab · Kroşe!');
});
