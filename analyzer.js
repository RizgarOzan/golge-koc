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
  legStart: 0.7,        // ankle or knee lifted this far above the other leg's one starts a kick/knee
                        // (0.5 let hops and stance shifts in punch drills through as weak kicks)
  legEnd: 0.3,          // (relative to the standing leg, so bouncing and stance drift don't matter)
  restFollow: 0.02,     // per frame: how fast the arm rest spot follows a limb that is not striking
  maxEvent: 1.3,        // seconds; an event is force-closed after this
  straight: 0.72,       // arm straightness at peak: above = jab/cross
  hookElbow: -0.3,      // elbow height minus shoulder height: above = hook, below = uppercut
  hookRise: 1.25,       // a "hook" whose wrist travelled up/down more than this many times its sideways travel
                        // (from just before the punch to its end) is an uppercut. 1.15-1.4 hurt no labelled set.
  kneeBend: 0.72,       // leg straightness at peak: below (with knee high) = knee strike
  highKick: 0.55,       // ankle height at peak: above = high kick
  midKick: -0.35,       // above = middle kick, below = low kick
  guardH: 0.75,         // wrist height at or above this = hand is up
  punchMinH: 0.55,      // a punch peaks near shoulder height; a wrist that ends lower is just a dropped hand
  overlapKeep: 0.6,     // overlapping weaker events below this share of the winner are dropped
  // Defence. Head moves are measured against the resting stance, in units of the resting torso length.
  duck: 0.35,           // head drops this far (nose height above the ankles) = duck
  slip: 0.3,            // head moves this far sideways from above the hips = slip
                        // (0.25 fired on stance shifts: 18 of 81 slips in a slip drill fell outside any defence)
  defEnd: 0.6,          // a duck/slip ends when it is back under this share of its start threshold
  block: -0.05,         // both wrists at least this high relative to the nose (torso units) = cover/block
  waistBend: 0.8,       // radians of extra forward lean in a duck: bending at the waist instead of the knees.
                        // Correct knee ducks in a coaching video leaned 0.46-0.75, so the line sits above that.
                        // A real waist bend leaned only 0.61-0.65, inside that range: lean alone can't catch it.
  defKeepMag: 2,        // a defence that overlaps a strike survives only if the head went this many thresholds far
  defArmMax: 1.0,       // ...and no overlapping arm event was at least this strong (1 = a typical punch)
  telegraph: 0.15,      // the punching hand first went this far backward (torso units) before going out
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
      nose: h(LM.nose), lWr: h(LM.lWr), rWr: h(LM.rWr), lEl: h(LM.lEl), rEl: h(LM.rEl),
      lSh: h(LM.lSh), rSh: h(LM.rSh), lKn: h(LM.lKn), rKn: h(LM.rKn), lAn: h(LM.lAn), rAn: h(LM.rAn),
    },
    armS: { L: straight(LM.lSh, LM.lEl, LM.lWr), R: straight(LM.rSh, LM.rEl, LM.rWr) },
    legS: { L: straight(LM.lHip, LM.lKn, LM.lAn), R: straight(LM.rHip, LM.rKn, LM.rAn) },
    // Head in the camera's frame (y points down), in metres, for defence moves.
    // Heights along the torso axis don't work here: the torso itself tilts in a duck.
    T,
    head: {
      h: Math.max(p(LM.lAn)[1], p(LM.rAn)[1]) - p(LM.nose)[1], // from the standing (lower) foot: a kick lifts the other
      x: p(LM.nose)[0] - hip[0], z: p(LM.nose)[2] - hip[2],
      tilt: Math.acos(Math.max(-1, Math.min(1, -up[1]))),
    },
  };
}

export const guardUp = (f, side) => (side === 'L' ? f.h.lWr : f.h.rWr) >= CFG.guardH;
const covering = (f, side) => (side === 'L' ? f.h.lWr : f.h.rWr) - f.h.nose >= CFG.block;

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
  let strikes = [];        // recent finished strikes, to tell defence from head movement caused by a strike
  const hist = [];         // raw wrist positions of the last moments, to see what a hand did right before a punch

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
      return { frame: f, events: out, defs: [], still: true };
    }
    const dt = Math.max(1e-3, t - lastT);
    lastT = t;
    hist.push({ t, L: f.pos.L, R: f.pos.R });
    while (hist[0].t < t - 0.4) hist.shift();
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
    defence(t, f, still);

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
        if (start) open[key] = {
          limb: limb.id, kind: limb.kind, start: t, peak: d, peakFrame: f, frames: [f],
          rest: rest[limb.id], pre: limb.kind === 'arm' ? hist.filter((h) => h.t >= t - 0.35).map((h) => h[limb.id]) : [],
        };
        continue;
      }
      ev.frames.push(f);
      if (d > ev.peak) { ev.peak = d; ev.peakFrame = f; }
      const end = limb.kind === 'arm' ? CFG.armEnd : CFG.legEnd;
      if (d < end || t - ev.start > CFG.maxEvent) {
        ev.end = t;
        delete open[key];
        const done = finish(ev);
        if (done) { pending.push(done); strikes.push(done); }
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
    // Punching and kicking move the head too. A defence is only reported once no strike is open.
    // A slip or duck also shakes the arms and legs a little, so an overlapping strike only cancels
    // the defence when the head move was small, an arm went out hard, or a kick left the ground.
    const defs = [];
    if (!Object.keys(open).length) {
      for (const d of defPending.splice(0)) {
        const over = strikes.filter((e) => e.start < d.end + 0.15 && e.end > d.start - 0.15);
        const real = over.some((e) => (e.kind === 'arm' && e.strength >= CFG.defArmMax) || (e.kind === 'leg' && e.type !== 'low'));
        if (!over.length || (d.mag >= CFG.defKeepMag && !real)) defs.push(d);
      }
      strikes = strikes.filter((e) => e.end > t - 2);
    }
    return { frame: f, events: out, defs, still };
  }

  // Defence: duck (head drops), slip (head moves off the hips), block (both hands up to the forehead).
  // Head moves are compared with the resting stance, which follows the fighter like the arm rest spots do.
  let headRest = null;
  let def = null;
  const defPending = [];
  function defence(t, f, still) {
    const hd = f.head;
    if (!headRest) { headRest = { ...hd, T: f.T }; return; }
    const a = def ? 0 : still ? (restFrames < 15 ? 0.3 : 0.05) : CFG.restFollow;
    for (const k of ['h', 'x', 'z', 'tilt', 'T']) headRest[k] += ((k === 'T' ? f.T : hd[k]) - headRest[k]) * a;
    const drop = (headRest.h - hd.h) / headRest.T;
    const shift = Math.hypot(hd.x - headRest.x, hd.z - headRest.z) / headRest.T;
    const cover = covering(f, 'L') && covering(f, 'R');
    const type = drop > CFG.duck ? 'duck' : shift > CFG.slip ? 'slip' : cover ? 'block' : null;
    if (!def) {
      if (type) def = { kind: 'def', type, start: t, waistBend: false, mag: 0 };
      return;
    }
    // How far past its threshold the head went, so a big defence can win over a small arm twitch.
    def.mag = Math.max(def.mag, drop / CFG.duck, shift / CFG.slip);
    // Once a move started, the strongest one seen wins: a block that turns into a duck is a duck.
    const rank = { block: 1, slip: 2, duck: 3 };
    if (type && rank[type] > rank[def.type]) def.type = type;
    if (def.type === 'duck' && hd.tilt - headRest.tilt > CFG.waistBend) def.waistBend = true;
    const over = def.type === 'duck' ? drop > CFG.duck * CFG.defEnd
      : def.type === 'slip' ? shift > CFG.slip * CFG.defEnd : cover;
    if (over && t - def.start <= CFG.maxEvent) return;
    defPending.push({ ...def, end: t });
    def = null;
  }

  return { update, get rest() { return rest; } };
}

function finish(ev) {
  const f = ev.peakFrame;
  if (ev.kind === 'arm' && (ev.limb === 'L' ? f.h.lWr : f.h.rWr) < CFG.punchMinH) return null;
  // A bent arm whose hand ends at the forehead is covering up, not punching.
  if (ev.kind === 'arm' && covering(f, ev.limb) && f.armS[ev.limb] < CFG.straight) return null;
  const c =ev.kind === 'arm' ? classifyArm(ev.limb, f) : classifyLeg(ev.limb, f);
  if (c.type === 'hook') {
    // A hook swings sideways, an uppercut rises. Elbow height alone mixes them up.
    const span = (k) => { const v = [...ev.pre.map((p) => p[k]), ...ev.frames.map((fr) => fr.pos[ev.limb][k])]; return Math.max(...v) - Math.min(...v); };
    c.rise = span(1) / (span(0) || 1e-3);
    if (c.rise > CFG.hookRise) c.type = 'upper';
  }
  // Guard during the strike: the other hand for punches, the hand opposite the kicking leg for kicks.
  const watch = ev.limb === 'L' ? 'R' : 'L';
  const upShare = ev.frames.filter((fr) => guardUp(fr, watch)).length / ev.frames.length;
  const typical = ev.kind === 'arm' ? 0.8 : 1.0;
  // Telegraph: how far the hand went backward, against the punch's own direction, just before it went out.
  // On a few coaching videos, telegraphed punches went past the line about twice as often as clean ones (29-40% vs 11-17%).
  let telegraph = 0;
  if (ev.kind === 'arm') {
    const out = sub(f.pos[ev.limb], ev.rest);
    const u = mul(out, 1 / (len(out) || 1));
    for (const p of ev.pre) telegraph = Math.max(telegraph, -dot(sub(p, ev.rest), u));
  }
  return {
    limb: ev.limb, kind: ev.kind, type: c.type, start: ev.start, end: ev.end,
    strength: ev.peak / typical, otherHandUp: upShare, telegraph, detail: c,
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
// names 'lr' calls straights by hand ("sol düz", "sağ düz") the way gym coaches do; default says jab/kros.
export function moveName(id, stance, names) {
  const m = MOVES[id];
  const w = SIDE_WORD[sideOf(stance, m.side)];
  const map = {
    straight: names === 'lr' ? [`${w} düz`, `${w} düz`] : m.side === 'lead' ? ['Jab', 'cab'] : ['Kros', 'kros'],
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

// A whole combo as one call. With 'lr' names, back-to-back straights merge: "Sol sağ düz · Sol kroşe".
export function comboText(combo, stance, names) {
  const parts = [];
  for (const id of combo) {
    const lr = names === 'lr' && MOVES[id].type === 'straight';
    const side = SIDE_WORD[sideOf(stance, MOVES[id].side)];
    if (lr && parts.at(-1)?.sides) parts.at(-1).sides.push(side);
    else parts.push(lr ? { sides: [side] } : moveName(id, stance, names));
  }
  const cap = (t) => t[0].toUpperCase() + t.slice(1);
  return {
    show: parts.map((p) => (p.sides ? cap(`${p.sides.join(' ')} düz`) : p.show)).join(' · '),
    say: parts.map((p) => (p.sides ? `${p.sides.join(' ')} düz` : p.say)).join(', '),
  };
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

// ---------- fight mode: the coach attacks, you defend ----------

// What the imaginary opponent throws and which defences answer it. 'check' = lifting the leg against a low kick.
// lr is the opponent's own side, called the way a trainer shouts it ("Sağ düz geldi"). The opponent stands orthodox.
export const ATTACKS = {
  jab:   { show: 'Jab geliyor', say: 'cab', lr: ['Sol düz', 'sol düz'], ok: ['slip', 'block'] },
  cross: { show: 'Kros geliyor', say: 'kros', lr: ['Sağ düz', 'sağ düz'], ok: ['slip', 'block'] },
  hook:  { show: 'Kroşe geliyor', say: 'kroşe', lr: ['Sol kroşe', 'sol kroşe'], ok: ['duck', 'block'] },
  double:{ show: 'Jab kros geliyor', say: 'cab kros', lr: ['Sol sağ düz', 'sol sağ düz'], ok: ['slip', 'block', 'duck'] },
  low:   { show: 'Low kick geliyor', say: 'lov kik', lr: ['Sağ low kick', 'sağ lov kik'], ok: ['check'] },
  llow:  { show: 'Sol low geliyor', say: 'sol lov kik', lr: ['Sol low kick', 'sol lov kik'], ok: ['check'] },
  mid:   { show: 'Middle kick geliyor', say: 'midıl kik', lr: ['Sağ middle kick', 'sağ midıl kik'], ok: ['block', 'check'] },
  high:  { show: 'High kick geliyor', say: 'hay kik', lr: ['Sağ high kick', 'sağ hay kik'], ok: ['block', 'duck'] },
};
const KICKS = ['low', 'llow', 'mid', 'high'];
// How one or more attacks are called. Kicks in a row share the last "kick": "Sol low sağ high kick".
// Spoken lr calls end in "geldi" so an attack never sounds like a combo the user should throw.
export function attackText(ids, names) {
  if (names !== 'lr') return { show: ids.map((id) => ATTACKS[id].show.replace(' geliyor', '')).join(' · ') + '!', say: ids.map((id) => ATTACKS[id].say).join(', ') };
  const show = ids.map((id) => ATTACKS[id].lr[0]), say = ids.map((id) => ATTACKS[id].lr[1]);
  for (let i = 0; i < ids.length - 1; i++) {
    if (KICKS.includes(ids[i]) && KICKS.includes(ids[i + 1])) {
      show[i] = show[i].replace(/ kick$/, ''); say[i] = say[i].replace(/ kik$/, '');
    }
  }
  return { show: show.map((t, i) => (i ? t[0].toLowerCase() + t.slice(1) : t)).join(' ') + '!', say: say.join(' ') + ' geldi' };
}
export const DEF_NAME = { slip: 'kayma', duck: 'eğilme', block: 'kapanma', check: 'tekme kontrolü' };

// The first defence after the call is the answer. hitAt is when the punch would land.
export function scoreDefence(attack, defs, events, callStart, hitAt) {
  const legs = events.filter((e) => e.kind === 'leg').map((e) => ({ type: 'check', start: e.start, waistBend: false }));
  const got = [...defs, ...legs].filter((d) => d.start >= callStart).sort((a, b) => a.start - b.start)[0] || null;
  let verdict;
  if (!got || got.start > hitAt + 0.6) verdict = 'none';
  else if (!ATTACKS[attack].ok.includes(got.type)) verdict = 'wrongDef';
  else if (got.start > hitAt) verdict = 'late';
  else verdict = 'ok';
  return { attack, got: verdict === 'none' ? null : got, verdict, reaction: got && verdict !== 'none' ? got.start - callStart : null, waistBend: !!got?.waistBend };
}

export function summarizeFight(defResults) {
  const n = defResults.length || 1;
  const share = (fn) => defResults.filter(fn).length / n;
  const reactions = defResults.map((r) => r.reaction).filter((x) => x != null);
  const ducks = defResults.filter((r) => r.got?.type === 'duck');
  const stats = {
    attacks: defResults.length,
    defended: share((r) => r.verdict === 'ok'),
    late: share((r) => r.verdict === 'late'),
    none: share((r) => r.verdict === 'none'),
    wrongDef: share((r) => r.verdict === 'wrongDef'),
    avgReaction: reactions.length ? reactions.reduce((a, b) => a + b, 0) / reactions.length : null,
    waistBend: ducks.length ? ducks.filter((r) => r.waistBend).length / ducks.length : 0,
    byAttack: {},
  };
  for (const r of defResults) {
    const b = (stats.byAttack[r.attack] ??= { tries: 0, ok: 0 });
    b.tries++;
    if (r.verdict === 'ok') b.ok++;
  }
  const pct = (x) => `%${Math.round(x * 100)}`;
  const tips = [];
  if (stats.none > 0.25) tips.push(`Saldırıların ${pct(stats.none)} kadarında hiç savunma görmedim. Komutu duyduğun an baş hareket etsin: kay, eğil ya da kapan.`);
  if (stats.late > 0.2) tips.push(`Savunman geç kalıyor (${pct(stats.late)}). Vuruşu beklemeden hareket et; omuzların gevşek, dizlerin hafif bükük dursun ki hemen kayabilesin.`);
  if (stats.wrongDef > 0.2) tips.push(`Yanlış savunma seçiyorsun (${pct(stats.wrongDef)}). Düz yumruğa kay ya da kapan, kroşenin altından eğil, low kick'e dizini kaldırıp kontrol et.`);
  if (ducks.length >= 2 && stats.waistBend > 0.4) tips.push(`Eğilirken belden kırılıyorsun (${pct(stats.waistBend)}). Sırtın dik kalsın, dizlerinden çömel. Belden eğilince başın rakibin dizine iner.`);
  if (stats.avgReaction != null && stats.avgReaction > 0.9) tips.push(`Tepki süren ${stats.avgReaction.toFixed(2)} sn. Savaş modunu kısa turlarla sık tekrar et, bu süre düşer.`);
  const strengths = [];
  if (stats.defended >= 0.75 && defResults.length >= 5) strengths.push(`Saldırıların ${pct(stats.defended)} kadarını doğru savundun.`);
  if (stats.avgReaction != null && stats.avgReaction <= 0.6) strengths.push(`Savunma tepkin hızlı (${stats.avgReaction.toFixed(2)} sn).`);
  return { stats, tips, strengths };
}

// Turn a whole session into stats and plain-language advice.
export function summarize(results, idleGuardShare) {
  const all = results.flatMap((r) => r.moves);
  const n = all.length || 1;
  const count = (fn) => all.filter(fn).length;
  const reactions = results.map((r) => r.reaction).filter((x) => x != null && x > 0);
  const avgReaction = reactions.length ? reactions.reduce((a, b) => a + b, 0) / reactions.length : null;
  const thrown = all.filter((m) => m.got);
  const punches = thrown.filter((m) => m.got.kind === 'arm');
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
    telegraph: punches.length ? punches.filter((m) => m.got.telegraph > CFG.telegraph).length / punches.length : 0,
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
  if (punches.length >= 10 && stats.telegraph > 0.3)
    tips.push({ w: 1 + stats.telegraph, text: `Yumruktan önce elini geri çekiyorsun (${pct(stats.telegraph)} yumrukta). Rakip bunu görüp hazırlanır. Yumruk gardın olduğu yerden doğrudan çıksın, önce geriye gitmesin.` });
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
