// Strike detection and scoring from MediaPipe pose world landmarks.
// Pure module: no DOM, so it runs in the browser and in Node tests.
//
// All distances are divided by torso length (shoulder midpoint to hip midpoint),
// and heights are measured along the hip-to-shoulder axis:
// hip = 0, shoulder = 1, knee is roughly -1, ankle at rest roughly -1.9.

export const LM = {
  nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16,
  lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28,
};

// Tuning knobs. Change these first when detection feels off on a real phone.
export const CFG = {
  smooth: 0.5,          // EMA factor for positions (higher = less smoothing)
  stillSpeed: 1.2,      // torso/s: below this everything counts as "standing still"
  armStart: 0.32,       // wrist must leave its rest spot by this much to start a punch
  armEnd: 0.22,         // and come back under this to end it
  legStart: 0.5,        // ankle or knee lifted this far above the other leg's one starts a kick/knee
  legEnd: 0.3,          // (relative to the standing leg, so bouncing and stance drift don't matter)
  restFollow: 0.02,     // per frame: how fast the arm rest spot follows a limb that is not striking
  maxEvent: 1.3,        // seconds; an event is force-closed after this
  straight: 0.72,       // arm straightness at peak: above = jab/cross
  hookElbow: -0.3,      // elbow height minus shoulder height: above = hook, below = uppercut
  kneeBend: 0.72,       // leg straightness at peak: below (with knee high) = knee strike
  highKick: 0.55,       // ankle height at peak: above = high kick
  midKick: -0.35,       // above = middle kick, below = low kick
  guardH: 0.75,         // wrist height at or above this = hand is up
  punchMinH: 0.6,       // a punch peaks near shoulder height; a wrist that ends lower is just a dropped hand
  overlapKeep: 0.6,     // overlapping weaker events below this share of the winner are dropped
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dist = (a, b) => len(sub(a, b));
const mid = (a, b) => mul(add(a, b), 0.5);
const P = (lm) => [lm.x, lm.y, lm.z];

// One frame of world landmarks -> body-relative features.
export function frameFeatures(world) {
  const p = (i) => P(world[i]);
  const hip = mid(p(LM.lHip), p(LM.rHip));
  const sh = mid(p(LM.lSh), p(LM.rSh));
  const T = dist(sh, hip) || 1;
  const up = mul(sub(sh, hip), 1 / T);
  const rel = (i) => mul(sub(p(i), hip), 1 / T);
  const h = (i) => dot(rel(i), up);
  const straight = (a, b, c) => dist(p(a), p(c)) / (dist(p(a), p(b)) + dist(p(b), p(c)) || 1);
  return {
    up,
    // Wrists are taken from the shoulder line so bobbing and leaning at the waist don't look like punches.
    pos: {
      L: mul(sub(p(LM.lWr), sh), 1 / T), R: mul(sub(p(LM.rWr), sh), 1 / T),
      LA: rel(LM.lAn), RA: rel(LM.rAn), LK: rel(LM.lKn), RK: rel(LM.rKn),
    },
    h: {
      lWr: h(LM.lWr), rWr: h(LM.rWr), lEl: h(LM.lEl), rEl: h(LM.rEl),
      lSh: h(LM.lSh), rSh: h(LM.rSh), lKn: h(LM.lKn), rKn: h(LM.rKn), lAn: h(LM.lAn), rAn: h(LM.rAn),
    },
    armS: { L: straight(LM.lSh, LM.lEl, LM.lWr), R: straight(LM.rSh, LM.rEl, LM.rWr) },
    legS: { L: straight(LM.lHip, LM.lKn, LM.lAn), R: straight(LM.rHip, LM.rKn, LM.rAn) },
  };
}

export const guardUp = (f, side) => (side === 'L' ? f.h.lWr : f.h.rWr) >= CFG.guardH;

function classifyArm(side, f) {
  const s = f.armS[side];
  const elbowRel = side === 'L' ? f.h.lEl - f.h.lSh : f.h.rEl - f.h.rSh;
  let type;
  if (s >= CFG.straight) type = 'straight';
  else if (elbowRel >= CFG.hookElbow) type = 'hook';
  else type = 'upper';
  return { type, straightness: s, elbowRel };
}

function classifyLeg(side, f) {
  const kneeH = side === 'L' ? f.h.lKn : f.h.rKn;
  const ankleH = side === 'L' ? f.h.lAn : f.h.rAn;
  const s = f.legS[side];
  let type;
  if (s < CFG.kneeBend && kneeH > -0.35 && ankleH < kneeH) type = 'knee';
  else if (ankleH >= CFG.highKick) type = 'high';
  else if (ankleH >= CFG.midKick) type = 'mid';
  else type = 'low';
  return { type, ankleH, kneeH, legStraightness: s };
}

// Streaming detector. Feed it frames; it returns finished strike events.
export function createDetector() {
  let smooth = null;       // smoothed positions
  let rest = null;         // resting positions (guard stance)
  let lastT = null;
  const open = {};         // limb -> event in progress
  const pending = [];      // closed events waiting for overlap resolution
  let restFrames = 0;

  const limbs = [
    { id: 'L', kind: 'arm', keys: ['L'] },
    { id: 'R', kind: 'arm', keys: ['R'] },
    { id: 'L', kind: 'leg', keys: ['LA', 'LK'] },
    { id: 'R', kind: 'leg', keys: ['RA', 'RK'] },
  ];
  const limbKey = (l) => l.kind + l.id;

  function update(t, world) {
    const f = frameFeatures(world);
    const out = [];
    if (!smooth) {
      smooth = structuredClone(f.pos);
      rest = structuredClone(f.pos);
      lastT = t;
      return { frame: f, events: out, still: true };
    }
    const dt = Math.max(1e-3, t - lastT);
    lastT = t;
    let maxSpeed = 0;
    for (const k in f.pos) {
      const next = add(mul(smooth[k], 1 - CFG.smooth), mul(f.pos[k], CFG.smooth));
      maxSpeed = Math.max(maxSpeed, dist(next, smooth[k]) / dt);
      smooth[k] = next;
    }
    const anyOpen = Object.keys(open).length > 0;
    const still = maxSpeed < CFG.stillSpeed && !anyOpen;
    // Follow the guard. Fighters bounce and never stand fully still, so idle limbs follow slowly too.
    const busy = (k) => (k === 'L' || k === 'R' ? open['arm' + k] : open['leg' + k[0]]);
    for (const k in smooth) {
      const a = still ? (restFrames < 15 ? 0.3 : 0.05) : busy(k) ? 0 : CFG.restFollow;
      rest[k] = add(mul(rest[k], 1 - a), mul(smooth[k], a));
    }
    if (still) restFrames++;

    for (const limb of limbs) {
      const key = limbKey(limb);
      // Arms: distance from the guard spot. Legs: height above the other (standing) leg.
      const o = limb.id === 'L' ? 'R' : 'L';
      const d = limb.kind === 'arm'
        ? dist(smooth[limb.id], rest[limb.id])
        : Math.max(dot(sub(smooth[limb.id + 'A'], smooth[o + 'A']), f.up), dot(sub(smooth[limb.id + 'K'], smooth[o + 'K']), f.up));
      const ev = open[key];
      if (!ev) {
        const start = d > (limb.kind === 'arm' ? CFG.armStart : CFG.legStart);
        if (start) open[key] = { limb: limb.id, kind: limb.kind, start: t, peak: d, peakFrame: f, frames: [f] };
        continue;
      }
      ev.frames.push(f);
      if (d > ev.peak) { ev.peak = d; ev.peakFrame = f; }
      const end = limb.kind === 'arm' ? CFG.armEnd : CFG.legEnd;
      if (d < end || t - ev.start > CFG.maxEvent) {
        ev.end = t;
        delete open[key];
        const done = finish(ev);
        if (done) pending.push(done);
      }
    }

    // Resolve overlaps once nothing that overlaps the oldest pending event is still open.
    while (pending.length && Object.values(open).every((o) => o.start > pending[0].end)) {
      const group = [pending.shift()];
      for (let i = 0; i < pending.length; i++) {
        if (pending[i].start <= group[0].end && pending[i].end >= group[0].start) group.push(...pending.splice(i--, 1));
      }
      out.push(...resolve(group));
    }
    return { frame: f, events: out, still };
  }

  return { update, get rest() { return rest; } };
}

function finish(ev) {
  const f = ev.peakFrame;
  if (ev.kind === 'arm' && (ev.limb === 'L' ? f.h.lWr : f.h.rWr) < CFG.punchMinH) return null;
  const c =ev.kind === 'arm' ? classifyArm(ev.limb, f) : classifyLeg(ev.limb, f);
  // Guard during the strike: the other hand for punches, the hand opposite the kicking leg for kicks.
  const watch = ev.limb === 'L' ? 'R' : 'L';
  const upShare = ev.frames.filter((fr) => guardUp(fr, watch)).length / ev.frames.length;
  const typical = ev.kind === 'arm' ? 0.8 : 1.0;
  return {
    limb: ev.limb, kind: ev.kind, type: c.type, start: ev.start, end: ev.end,
    strength: ev.peak / typical, otherHandUp: upShare, detail: c,
  };
}

function resolve(group) {
  if (group.length === 1) return group;
  // Legs beat arms when both fire: a kick swings the arms, a punch rarely lifts a leg past the rise check.
  // Compare legs with legs only: a swinging arm can look "stronger" than the kick that caused it.
  const hasLeg = group.some((e) => e.kind === 'leg');
  const pool = hasLeg ? group.filter((e) => e.kind === 'leg') : group;
  const top = Math.max(...pool.map((e) => e.strength));
  return pool
    .filter((e) => e.strength >= top * CFG.overlapKeep)
    .sort((a, b) => a.start - b.start);
}

// ---------- moves, combos, scoring ----------

export const MOVES = {
  jab:    { side: 'lead', kind: 'arm', type: 'straight' },
  cross:  { side: 'rear', kind: 'arm', type: 'straight' },
  lhook:  { side: 'lead', kind: 'arm', type: 'hook' },
  rhook:  { side: 'rear', kind: 'arm', type: 'hook' },
  lupper: { side: 'lead', kind: 'arm', type: 'upper' },
  rupper: { side: 'rear', kind: 'arm', type: 'upper' },
  rlow:   { side: 'rear', kind: 'leg', type: 'low' },
  llow:   { side: 'lead', kind: 'leg', type: 'low' },
  rmid:   { side: 'rear', kind: 'leg', type: 'mid' },
  lmid:   { side: 'lead', kind: 'leg', type: 'mid' },
  rhigh:  { side: 'rear', kind: 'leg', type: 'high' },
  lhigh:  { side: 'lead', kind: 'leg', type: 'high' },
  rknee:  { side: 'rear', kind: 'leg', type: 'knee' },
  lknee:  { side: 'lead', kind: 'leg', type: 'knee' },
};

export const COMBOS = {
  1: [['jab'], ['cross'], ['jab', 'cross'], ['lhook'], ['rupper'], ['rlow'], ['jab', 'jab'], ['rmid'], ['rknee']],
  2: [['jab', 'cross'], ['jab', 'cross', 'lhook'], ['jab', 'rlow'], ['cross', 'lhook'], ['jab', 'cross', 'rlow'],
      ['lhook', 'cross'], ['jab', 'rmid'], ['cross', 'llow'], ['jab', 'rupper', 'lhook'], ['jab', 'rknee'], ['lmid']],
  3: [['jab', 'cross', 'lhook', 'rlow'], ['jab', 'cross', 'lmid'], ['lhook', 'cross', 'lhook', 'rlow'],
      ['jab', 'rupper', 'lhook', 'cross'], ['cross', 'lhook', 'rhigh'], ['jab', 'cross', 'rknee'],
      ['rlow', 'cross', 'lhook'], ['jab', 'lhigh'], ['lupper', 'rupper', 'lhook', 'rmid'], ['jab', 'cross', 'rhook', 'llow']],
};

const SIDE_WORD = { L: 'sol', R: 'sağ' };
export function sideOf(stance, s) { return (s === 'lead') === (stance === 'orthodox') ? 'L' : 'R'; }

// Display text and a phonetic spelling the Turkish voice reads naturally.
export function moveName(id, stance) {
  const m = MOVES[id];
  const w = SIDE_WORD[sideOf(stance, m.side)];
  const map = {
    straight: m.side === 'lead' ? ['Jab', 'cab'] : ['Kros', 'kros'],
    hook: [`${w} kroşe`, `${w} kroşe`],
    upper: [`${w} aparkat`, `${w} aparkat`],
    low: [`${w} low kick`, `${w} lov kik`],
    mid: [`${w} middle kick`, `${w} midıl kik`],
    high: [`${w} high kick`, `${w} hay kik`],
    knee: [`${w} diz`, `${w} diz`],
  };
  const [show, say] = map[m.type];
  return { show: show[0].toUpperCase() + show.slice(1), say };
}

export function eventName(ev) {
  const w = SIDE_WORD[ev.limb];
  const n = { straight: 'düz yumruk', hook: 'kroşe', upper: 'aparkat', low: 'low kick', mid: 'middle kick', high: 'high kick', knee: 'diz' };
  return `${w} ${n[ev.type]}`;
}

// Compare what was asked with what was seen. Positional: the n-th detected strike
// is judged against the n-th move of the combo; extras are counted separately.
export function scoreCombo(combo, events, stance, cmdStart, afterFrames) {
  const res = { moves: [], reaction: null, extra: Math.max(0, events.length - combo.length), returnedGuard: true };
  if (events.length) res.reaction = events[0].start - cmdStart;
  combo.forEach((id, i) => {
    const m = MOVES[id];
    const want = { limb: sideOf(stance, m.side), kind: m.kind, type: m.type };
    const got = events[i];
    let verdict;
    if (!got) verdict = 'missed';
    else if (got.kind !== want.kind) verdict = 'wrongKind';
    else if (got.limb !== want.limb && got.type !== want.type) verdict = 'wrong';
    else if (got.limb !== want.limb) verdict = 'wrongSide';
    else if (got.type !== want.type) verdict = 'wrongType';
    else verdict = 'ok';
    res.moves.push({ id, want, got: got || null, verdict, guardDrop: got ? got.otherHandUp < (m.kind === 'arm' ? 0.7 : 0.6) : false });
  });
  // Hands back up shortly after the last strike?
  if (events.length && afterFrames.length) {
    res.returnedGuard = afterFrames.some((f) => guardUp(f, 'L') && guardUp(f, 'R'));
  }
  return res;
}

// Turn a whole session into stats and plain-language advice.
export function summarize(results, idleGuardShare) {
  const all = results.flatMap((r) => r.moves);
  const n = all.length || 1;
  const count = (fn) => all.filter(fn).length;
  const reactions = results.map((r) => r.reaction).filter((x) => x != null && x > 0);
  const avgReaction = reactions.length ? reactions.reduce((a, b) => a + b, 0) / reactions.length : null;
  const thrown = all.filter((m) => m.got);
  const stats = {
    combos: results.length,
    moves: all.length,
    accuracy: count((m) => m.verdict === 'ok') / n,
    missed: count((m) => m.verdict === 'missed') / n,
    avgReaction,
    guardDrop: thrown.length ? thrown.filter((m) => m.guardDrop).length / thrown.length : 0,
    noReturn: results.filter((r) => r.moves.some((m) => m.got)).length
      ? results.filter((r) => r.moves.some((m) => m.got) && !r.returnedGuard).length / results.filter((r) => r.moves.some((m) => m.got)).length
      : 0,
    idleGuard: idleGuardShare,
    byMove: {},
  };
  for (const m of all) {
    const b = (stats.byMove[m.id] ??= { tries: 0, ok: 0 });
    b.tries++;
    if (m.verdict === 'ok') b.ok++;
  }

  const tips = [];
  const pct = (x) => `%${Math.round(x * 100)}`;
  if (avgReaction != null && avgReaction > 0.95)
    tips.push({ w: avgReaction, text: `Tepkin yavaş, ortalama ${avgReaction.toFixed(2)} sn. Komutu beklerken ayak parmak uçlarında hafif zıpla, omuzlarını gevşet. Kasılı beklemek ilk hareketi geciktirir.` });
  if (stats.guardDrop > 0.25)
    tips.push({ w: 1 + stats.guardDrop, text: `Vururken boştaki elin düşüyor (${pct(stats.guardDrop)} vuruşta). Yumruk atmayan el yanağına yapışık kalsın, tekmede de karşı el yüzünü korusun.` });
  if (stats.noReturn > 0.3)
    tips.push({ w: 1 + stats.noReturn, text: `Kombinasyondan sonra gardına geç dönüyorsun (${pct(stats.noReturn)}). Her vuruşu attığın yoldan aynı hızla geri çek, son hareketten sonra ellerin hemen yüzüne gelsin.` });
  if (idleGuardShare != null && idleGuardShare < 0.7)
    tips.push({ w: 1.2 - idleGuardShare, text: `Komut beklerken ellerin aşağıda (zamanın sadece ${pct(idleGuardShare)} kadarında gard yukarıda). Dinlenirken de gard yüzünde dursun.` });

  const verdictShare = (v, filter = () => true) => {
    const pool = all.filter(filter);
    return pool.length ? pool.filter((m) => m.verdict === v).length / pool.length : 0;
  };
  if (verdictShare('wrongSide') > 0.15)
    tips.push({ w: 1.3, text: `Sağ ve solu karıştırıyorsun (${pct(verdictShare('wrongSide'))}). Komutu duyunca önce hangi elin/ayağın olduğunu düşün; yavaş tempoda tekrar et.` });
  const highs = all.filter((m) => m.want.type === 'high' && m.got);
  if (highs.length >= 2 && highs.filter((m) => m.got.type !== 'high').length / highs.length > 0.4)
    tips.push({ w: 1.4, text: 'High kick\'lerin baş seviyesine çıkmıyor. Destek ayağının topuğunu hedefe doğru çevir, kalçanı aç. Esneme çalışması ekle.' });
  const mids = all.filter((m) => m.want.type === 'mid' && m.got);
  if (mids.length >= 2 && mids.filter((m) => m.got.type === 'low').length / mids.length > 0.4)
    tips.push({ w: 1.2, text: 'Middle kick\'lerin aşağıda kalıyor. Dizini önce yukarı kaldır, kaburga seviyesine vur.' });
  const hooks = all.filter((m) => m.want.type === 'hook' && m.got && m.got.kind === 'arm');
  if (hooks.length >= 2 && hooks.filter((m) => m.got.type !== 'hook').length / hooks.length > 0.4)
    tips.push({ w: 1.1, text: 'Kroşelerde dirseğin yeterince kalkmıyor, yumruk düz ya da aşağıdan gidiyor. Dirsek omuz hizasında, kol 90 derece olsun.' });
  const longCombos = results.filter((r) => r.moves.length >= 3);
  if (longCombos.length >= 2) {
    const lastMissed = longCombos.filter((r) => r.moves[r.moves.length - 1].verdict === 'missed').length / longCombos.length;
    if (lastMissed > 0.4) tips.push({ w: 1.25, text: `Uzun kombinasyonlarda son hareketi atlıyorsun (${pct(lastMissed)}). Kombinasyonu bitirmeden gardına dönme.` });
  }
  if (stats.missed > 0.3 && !tips.some((t) => t.text.includes('son hareketi')))
    tips.push({ w: 1 + stats.missed, text: `Hareketlerin bir kısmını görmedim (${pct(stats.missed)}). Ya vuruş kısa kaldı ya da kadrajdan çıktın. Vuruşları tam uzat, tüm vücudun ekranda kalsın.` });

  tips.sort((a, b) => b.w - a.w);
  const strengths = [];
  if (avgReaction != null && avgReaction <= 0.75) strengths.push(`Tepki süren iyi (${avgReaction.toFixed(2)} sn).`);
  if (thrown.length >= 5 && stats.guardDrop <= 0.1) strengths.push('Vururken boştaki elin gardda kalıyor.');
  if (stats.accuracy >= 0.8 && all.length >= 6) strengths.push(`Komutlara doğru hareketle cevap veriyorsun (${pct(stats.accuracy)}).`);
  return { stats, tips: tips.slice(0, 4).map((t) => t.text), strengths };
}
