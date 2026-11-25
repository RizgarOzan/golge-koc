// Training plan, adaptive focus, round judging and bag-work cues. Pure functions, no DOM.
// Rest between rounds, by level (seconds).
export const REST = { 1: 60, 2: 45, 3: 30 };

// Which modes a week holds, by training days per week. Technique first, sparring-style work last.
const WEEK = {
  3: ['session', 'bag', 'shadow'],
  4: ['session', 'bag', 'fight', 'shadow'],
  5: ['session', 'bag', 'fight', 'bag', 'shadow'],
};
export const MODE_NAME = { session: 'Kombinasyon', fight: 'Savunma', fast: 'Hızlı refleks', bag: 'Kum torbası', shadow: 'Rakipli shadow' };

// One week of sessions. Volume grows one round every two weeks, up to a cap.
export function buildWeek(level, days, week) {
  const lv = Number(level);
  const minutes = lv === 1 ? 2 : 3;
  const base = { 1: 2, 2: 3, 3: 4 }[lv];
  const rounds = Math.min(base + Math.floor(week / 2), base + 3);
  return (WEEK[days] || WEEK[3]).map((mode) => ({
    mode,
    minutes,
    // Technique and defence blocks stay shorter; the bag and the shadow fight carry the volume.
    rounds: mode === 'bag' || mode === 'shadow' ? rounds : Math.max(1, rounds - 1),
  }));
}

const DAY = 864e5;
// Monday 00:00 of the week that holds t.
export function weekStart(t) {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  return d.getTime() - ((d.getDay() + 6) % 7) * DAY;
}

// Where the user stands in the program: week number, plan, what is done, what comes next.
export function programStatus(program, history, t) {
  const start = weekStart(program.start);
  const ws = weekStart(t);
  const week = Math.max(0, Math.round((ws - start) / (7 * DAY)));
  const plan = buildWeek(program.level, program.days, week);
  const done = history.filter((h) => h.program && h.at >= ws).length;
  return { week, plan, done: Math.min(done, plan.length), next: plan[done] || null };
}

// Moves and attacks the user keeps getting wrong in the last few sessions.
export function weakSpots(history, last = 6) {
  const add = (acc, src) => {
    for (const [id, b] of Object.entries(src || {})) {
      const a = (acc[id] ??= { tries: 0, ok: 0 });
      a.tries += b.tries; a.ok += b.ok;
    }
    return acc;
  };
  const recent = history.slice(-last);
  const rank = (acc) => Object.entries(acc)
    .filter(([, b]) => b.tries >= 3 && b.ok / b.tries < 0.7)
    .sort((x, y) => x[1].ok / x[1].tries - y[1].ok / y[1].tries)
    .slice(0, 3).map(([id]) => id);
  return {
    moves: rank(recent.reduce((acc, h) => add(acc, h.byMove), {})),
    attacks: rank(recent.reduce((acc, h) => add(acc, h.byAttack), {})),
  };
}

// Random pick where items that contain focus ids come up three times as often.
export function pickFocus(pool, focus, rnd = Math.random) {
  const has = (item) => [].concat(item).some((id) => focus.includes(id));
  const w = pool.map((item) => (has(item) ? 3 : 1));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) if ((r -= w[i]) < 0) return pool[i];
  return pool.at(-1);
}

// Suggest moving up or down a level from the last three camera sessions at this level.
export function levelAdvice(history, level) {
  const recent = history.filter((h) => h.mode !== 'bag' && String(h.level) === String(level) && h.accuracy != null).slice(-3);
  if (recent.length < 3) return null;
  const good = recent.every((h) => h.accuracy >= 0.8 && (h.defended == null || h.defended >= 0.75));
  const bad = recent.every((h) => h.accuracy < 0.5 || (h.defended != null && h.defended < 0.4));
  if (good && Number(level) < 3) return 'up';
  if (bad && Number(level) > 1) return 'down';
  return null;
}

// Score one round of shadow boxing like a judge on the 10-point must system.
// Clean strikes and clean defences earn points; punches you ate count double against you.
export function judgeRound({ landed = 0, defended = 0, late = 0, hit = 0 }) {
  const you = landed + defended;
  const opp = hit * 2 + late;
  let score = [10, 10], result = 'draw';
  if (you > opp) { result = 'win'; score = [10, you - opp >= 6 ? 8 : 9]; }
  else if (opp > you) { result = 'loss'; score = [opp - you >= 6 ? 8 : 9, 10]; }
  return { you, opp, score, result };
}

// Fight verdict over all rounds: total of judge cards.
export function judgeFight(rounds) {
  const you = rounds.reduce((a, r) => a + r.score[0], 0);
  const opp = rounds.reduce((a, r) => a + r.score[1], 0);
  return { you, opp, result: you > opp ? 'win' : opp > you ? 'loss' : 'draw' };
}

// Bag work: short bursts called in the middle of a round.
export const BAG_DRILLS = [
  { show: 'Seri düz yumruk!', say: 'Seri düz yumruk! On saniye, hızlı!', secs: 10 },
  { show: 'Seri kroşe!', say: 'Sağlı sollu kroşe! On saniye!', secs: 10 },
  { show: 'Diz!', say: 'Klinç, dizler! On saniye!', secs: 10 },
  { show: 'Low kick serisi', say: 'Sağ low kick, durmadan! On saniye!', secs: 10 },
];

// Technique reminders for the rest minute after a bag round.
export const BAG_TIPS = [
  'Torbaya vurduktan sonra yumruğu itme, çabuk geri çek. Vurduğun yoldan dön.',
  'Low kick\'i ayağınla değil kaval kemiğinle vur, kalçanı döndür.',
  'Torbanın etrafında dön, hep aynı yerde durma. Vur, çık, açı al.',
  'Kroşede dirseğin omuz hizasında olsun, ön ayağının topuğunu döndür.',
  'Nefesini tutma. Her vuruşta kısa bir nefes ver.',
  'Kombinasyon bitince gardın yüzünde olsun. Torba da geri gelir.',
  'Tekmeden sonra ayağını dağıtma, hemen gard duruşuna in.',
];

// Combos for the bag: the level's camera combos plus a few longer bag-only chains.
export const BAG_COMBOS = {
  1: [['jab', 'cross'], ['jab', 'cross', 'lhook'], ['jab', 'rlow'], ['cross', 'lhook'], ['jab', 'jab', 'cross'], ['rknee']],
  2: [['jab', 'cross', 'lhook', 'cross'], ['jab', 'cross', 'rlow'], ['cross', 'cross', 'llow'], ['jab', 'rupper', 'lhook', 'cross'],
      ['lhook', 'cross', 'rmid'], ['jab', 'cross', 'rknee', 'rknee']],
  3: [['jab', 'cross', 'lhook', 'cross', 'rlow'], ['lhook', 'rhook', 'lupper', 'rupper'], ['jab', 'cross', 'lhook', 'rhigh'],
      ['cross', 'cross', 'llow', 'rmid'], ['jab', 'rupper', 'lhook', 'cross', 'lmid'], ['rlow', 'cross', 'lhook', 'rknee']],
};

// Short spoken note for the break, from the round's numbers. The first match wins.
export function roundNote({ hit = 0, attacks = 0, landed = 0, tries = 0, guardDrop = 0 }) {
  if (attacks && hit / attacks > 0.35) return 'Çok yumruk yedin. Saldırı sesini duyar duymaz başını merkezden çek.';
  if (tries && landed / tries < 0.5) return 'Kombinasyonları eksik attın. Acele etme, her vuruşu tam uzat.';
  if (guardDrop > 0.3) return 'Vururken boştaki elin düşüyor. Çenen hep korunsun.';
  if (tries < 4) return 'Az vurdun. Rakibe baskı yap, savunmadan sonra hemen karşılık ver.';
  return 'İyi raund. Aynı tempoyu koru, gardını unutma.';
}
