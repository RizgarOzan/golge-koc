import { PoseLandmarker, FilesetResolver, DrawingUtils } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs';
import * as A from './analyzer.js';
import * as C from './coach.js';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
// Landmarks that must be on screen: nose, shoulders, wrists, hips, knees, ankles.
const NEEDED = [0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28];
// Pause between combos, by level (seconds, min..max).
const PAUSE = { 1: [2.8, 4], 2: [1.8, 3], 3: [1.2, 2.2] };
// Fight mode: time from the call until the imaginary punch lands, and what the opponent throws per level.
const WINDOW = { 1: 1.3, 2: 1.0, 3: 0.8 };
const ATTACK_POOL = {
  1: ['jab', 'cross', 'hook', 'low'],
  2: ['jab', 'cross', 'hook', 'double', 'low', 'llow', 'mid'],
  3: ['jab', 'cross', 'hook', 'double', 'low', 'llow', 'mid', 'high'],
};
// Shadow mode: the opponent also throws short chains from level 2 on. Each attack lands 0.55 s after the one before.
const ATTACK_SEQS = {
  1: [],
  2: [['jab', 'hook'], ['cross', 'low'], ['jab', 'cross', 'hook']],
  3: [['llow', 'high'], ['jab', 'cross', 'hook'], ['low', 'high'], ['hook', 'mid'], ['jab', 'llow']],
};
const SEQ_GAP = 0.55;
// Counters after a good defence: short and fast.
const COUNTERS = {
  1: [['cross'], ['jab', 'cross'], ['lhook']],
  2: [['cross', 'lhook'], ['jab', 'cross'], ['rupper', 'lhook'], ['cross', 'rlow']],
  3: [['cross', 'lhook', 'cross'], ['rupper', 'lhook', 'rlow'], ['lhook', 'cross', 'rmid'], ['cross', 'lhook']],
};
// Fast mode: single moves and attacks mixed, short irregular pauses.
const FAST_MOVES = { 1: ['jab', 'cross', 'lhook', 'rlow'], 2: ['jab', 'cross', 'lhook', 'rhook', 'rupper', 'rlow', 'rmid'], 3: Object.keys(A.MOVES) };
const FAST_PAUSE = { 1: [1.2, 2.4], 2: [0.8, 1.8], 3: [0.5, 1.4] };

const $ = (id) => document.getElementById(id);
const now = () => performance.now() / 1000;
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- settings (remembered per device) ----------
const settings = { mode: 'session', stance: 'orthodox', level: '1', minutes: '2', rounds: '1', names: 'lr', days: '3' };
try { Object.assign(settings, JSON.parse(localStorage.getItem('gk-settings') || '{}')); } catch {}
document.querySelectorAll('.seg').forEach((seg) => {
  const key = seg.dataset.key;
  const sync = () => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === settings[key])));
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    settings[key] = b.dataset.v; sync();
    try { localStorage.setItem('gk-settings', JSON.stringify(settings)); } catch {}
  });
  sync();
});

const loadJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const loadHistory = () => loadJSON('gk-history', []);

// ---------- speech ----------
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find((v) => v.lang?.toLowerCase().startsWith('tr') && v.localService) || vs.find((v) => v.lang?.toLowerCase().startsWith('tr')) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

// Resolves when speech ends. onStart gets the moment audio actually began.
function say(text, { rate = 1.1, onStart } = {}) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { onStart?.(now()); return resolve(); }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'tr-TR'; if (voice) u.voice = voice; u.rate = rate;
    let started = false, done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onstart = () => { started = true; onStart?.(now()); };
    u.onend = finish; u.onerror = finish;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    // Some browsers never fire onstart/onend; don't hang the session on them.
    setTimeout(() => { if (!started) onStart?.(now()); }, 600);
    setTimeout(finish, 1500 + text.length * 90);
  });
}

// ---------- camera + pose ----------
const video = $('video'), canvas = $('canvas'), ctx = canvas.getContext('2d');
const draw = new DrawingUtils(ctx);
let landmarker = null, stream = null, wakeLock = null;

async function loadModel() {
  if (landmarker) return;
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  try { landmarker = await PoseLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { landmarker = await PoseLandmarker.createFromOptions(fileset, opts('CPU')); }
}

async function startCamera() {
  if (stream) return;
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false,
  });
  video.srcObject = stream;
  await video.play();
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
}

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop()); stream = null; video.srcObject = null;
}

async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && running) keepAwake(); });

// ---------- frame loop ----------
let running = false, detector = null, lastVideoTime = -1;
let visible = false, stillSince = null;
let frameLog = [];          // recent {t, frame, visible} for guard checks
let eventLog = [];          // strikes the detector finished
let defLog = [];            // defences the detector finished (duck, slip, block)
let onEvent = null;         // test mode hook
let fpsCount = 0, fpsT = now();

function loop() {
  if (!running) return;
  requestAnimationFrame(loop);
  if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  const t = now();
  const r = landmarker.detectForVideo(video, performance.now());
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const img = r.landmarks?.[0], world = r.worldLandmarks?.[0];
  visible = !!img && NEEDED.every((i) => (img[i].visibility ?? 1) > 0.5 && img[i].x > -0.02 && img[i].x < 1.02 && img[i].y > -0.02 && img[i].y < 1.02);
  if (img) {
    const color = visible ? '#3fb950' : '#e3b341';
    draw.drawConnectors(img, PoseLandmarker.POSE_CONNECTIONS, { color, lineWidth: 3 });
    draw.drawLandmarks(img, { color: '#fff', radius: 2 });
  }
  if (++fpsCount >= 15) { $('fps').textContent = `${Math.round(fpsCount / (t - fpsT))} fps`; fpsCount = 0; fpsT = t; }
  if (!visible) { stillSince = null; return; }

  const out = detector.update(t, world);
  stillSince = out.still ? stillSince ?? t : null;
  frameLog.push({ t, frame: out.frame });
  if (frameLog.length > 300) frameLog.splice(0, 100);
  for (const ev of out.events) { eventLog.push(ev); onEvent?.(ev); }
  for (const d of out.defs) { defLog.push(d); onEvent?.(d); }
}

// ---------- UI helpers ----------
const show = (id) => {
  ['menu', 'summary', 'stage'].forEach((s) => ($(s).hidden = s !== id));
  if (id === 'menu') renderProgram();
};
const banner = (text) => { $('banner').innerHTML = text ? `<span>${text}</span>` : ''; };
const cmd = (text, attack = false) => { $('cmd').textContent = text; $('cmd').classList.toggle('attack', attack); };
const result = (html) => { $('result').innerHTML = html; };
// The top-left clock: "R1/3 · 2:14" while a round runs, "Dinlenme · 0:42" in the break.
let clock = null, clockTick = null;
const setClock = (label, secs) => { clock = { label, until: now() + secs }; };

let cfg = null, lastRun = null;

async function begin(kind, override) {
  $('err').textContent = '';
  cfg = { ...settings, ...override };
  lastRun = [kind, override];
  // First speak() must happen inside the tap, or iOS stays silent for the whole session.
  say('Hazırlan');
  keepAwake();
  const camera = kind === 'test' || cfg.mode !== 'bag';
  if (camera) {
    try {
      $('go').disabled = $('testBtn').disabled = true;
      $('go').textContent = 'Yükleniyor…';
      await Promise.all([loadModel(), startCamera()]);
    } catch (e) {
      const name = e?.name || '';
      $('err').textContent = name === 'NotAllowedError'
        ? 'Kamera izni verilmedi. Tarayıcı ayarlarından bu siteye kamera izni ver.'
        : name === 'NotFoundError' ? 'Kamera bulunamadı.'
        : !window.isSecureContext ? 'Kamera sadece https adresinde açılır.'
        : `Başlatılamadı: ${e?.message || e}`;
      stopCamera();
      return;
    } finally {
      $('go').disabled = $('testBtn').disabled = false;
      $('go').textContent = 'Başla';
    }
  }
  detector = A.createDetector(); frameLog = []; eventLog = []; defLog = []; lastVideoTime = -1;
  running = true; show('stage'); cmd(''); result(''); banner(''); $('timer').textContent = ''; $('fps').textContent = '';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (camera) requestAnimationFrame(loop);
  if (kind === 'test') runTest(); else runSession(cfg);
}

async function end() {
  running = false; onEvent = null;
  clearInterval(clockTick); clock = null;
  speechSynthesis?.cancel();
  stopCamera();
  try { await wakeLock?.release(); } catch {}
}

$('go').onclick = () => begin('session');
$('testBtn').onclick = () => begin('test');
$('stop').onclick = () => { stopRequested = true; if (testing) { end(); show('menu'); } };
// "Tekrar" repeats the same workout but doesn't count it as another program day.
$('again').onclick = () => begin(lastRun?.[0] || 'session', lastRun?.[1] && { ...lastRun[1], program: false });
$('home').onclick = () => show('menu');

// ---------- training program ----------
function renderProgram() {
  const program = loadJSON('gk-program', null);
  $('progNew').hidden = !!program; $('progOn').hidden = !program;
  if (!program) return;
  const history = loadHistory();
  const st = C.programStatus(program, history, Date.now());
  const pills = st.plan.map((s, i) => `<span class="pill${i < st.done ? ' done' : ''}">${i < st.done ? '✓ ' : ''}${C.MODE_NAME[s.mode]}</span>`).join('');
  const lines = [`<div class="k">Program · ${st.week + 1}. hafta · ${st.done}/${st.plan.length}</div>`, `<div class="pills">${pills}</div>`];
  lines.push(st.next
    ? `<p>Sıradaki: <b>${C.MODE_NAME[st.next.mode]}</b>, ${st.next.rounds} raund × ${st.next.minutes} dk</p>`
    : '<p>Bu haftanın programı bitti. Pazartesi yeni hafta başlıyor, biraz daha yüklenerek.</p>');
  const weak = C.weakSpots(history);
  const names = [...weak.moves.map((id) => A.moveName(id, settings.stance, settings.names).show),
    ...weak.attacks.map((id) => `${A.attackText([id], settings.names).show.slice(0, -1)} savunması`)];
  if (names.length) lines.push(`<p class="d">Bu hafta üstüne gittiğim: ${names.join(', ')}. Bunları daha sık söyleyeceğim.</p>`);
  const adv = C.levelAdvice(history, program.level);
  if (adv === 'up') lines.push('<p class="good">Son üç seansın temiz. Seviyeyi bir yükseltmeyi dene.</p>');
  if (adv === 'down') lines.push('<p class="warn">Son üç seans zor geçti. Bir seviye inip tekniği oturt, sonra geri çık.</p>');
  $('progInfo').innerHTML = lines.join('');
  $('today').hidden = !st.next;
}
$('progStart').onclick = () => {
  try { localStorage.setItem('gk-program', JSON.stringify({ start: Date.now(), level: settings.level, days: Number(settings.days) })); } catch {}
  renderProgram();
};
$('progReset').onclick = () => {
  if (!confirm('Program silinsin mi? Antrenman geçmişin kalır.')) return;
  localStorage.removeItem('gk-program'); renderProgram();
};
$('today').onclick = () => {
  const program = loadJSON('gk-program', null);
  const next = program && C.programStatus(program, loadHistory(), Date.now()).next;
  if (next) begin('session', { mode: next.mode, rounds: String(next.rounds), minutes: String(next.minutes), level: program.level, program: true });
};

// ---------- calibration ----------
async function calibrate() {
  banner('Tüm vücudun ekranda görünsün, gardını al ve dur.');
  say('Telefondan iki üç metre uzaklaş. Tüm vücudun görünsün, gardını al.');
  while (running && !stopRequested) {
    if (!visible) banner('Seni tam göremiyorum. Biraz geri git, ayakların da görünsün.');
    else if (!stillSince) banner('Gördüm. Gardını al ve bir saniye kıpırdama.');
    else if (now() - stillSince > 1.5) break;
    await sleep(0.1);
  }
  banner('');
}

// ---------- test mode ----------
let testing = false;
async function runTest() {
  testing = true; stopRequested = false;
  await calibrate();
  cmd('Serbest vur');
  const seen = [];
  onEvent = (ev) => {
    seen.unshift(ev.kind === 'def' ? A.DEF_NAME[ev.type] + (ev.waistBend ? ' (belden)' : '') : A.eventName(ev));
    result(seen.slice(0, 4).map((s, i) => `<div style="opacity:${1 - i * 0.22}">${s}</div>`).join(''));
  };
  while (running && !stopRequested) {
    $('timer').textContent = visible ? '' : 'Kadrajdan çıktın';
    await sleep(0.3);
  }
  testing = false;
}

// ---------- training session ----------
let stopRequested = false;

async function runSession(c) {
  stopRequested = false;
  const { mode } = c;
  const rounds = Number(c.rounds) || 1;
  const total = Number(c.minutes) * 60;
  const weak = C.weakSpots(loadHistory());
  const all = { results: [], defences: [], rounds: [], combos: 0, drills: 0, worked: 0, idleUp: 0, idleAll: 0 };

  if (mode !== 'bag') {
    await calibrate();
    if (!running || stopRequested) return finishSession(c, all);
  }
  clockTick = setInterval(() => {
    if (clock) $('timer').textContent = `${clock.label} · ${mmss(Math.max(0, clock.until - now()))}`;
  }, 250);
  await say(mode === 'bag' ? 'Torbaya geç. Başlıyoruz.' : mode === 'session' ? 'Başlıyoruz' : 'Gardını al. Saldırıyorum.');

  for (let n = 1; n <= rounds && running && !stopRequested; n++) {
    const label = rounds > 1 ? `R${n}/${rounds}` : 'Süre';
    setClock(label, total);
    const startedAt = now();
    const rd = mode === 'bag' ? await bagRound(c, weak, startedAt + total, all) : await cameraRound(c, weak, startedAt + total, all);
    all.worked += Math.min(now() - startedAt, total);
    if (!running || stopRequested) break;
    all.rounds.push(rd);

    let note;
    if (mode === 'shadow') {
      Object.assign(rd, C.judgeRound(rd));
      const [a, b] = rd.score;
      const verdict = rd.result === 'win' ? 'Raundu kazandın' : rd.result === 'loss' ? 'Raundu kaybettin' : 'Raund berabere';
      cmd(`${verdict} ${a}-${b}`);
      await say(`${verdict}. ${a} ${b}.`);
    }
    if (n === rounds) break;
    note = mode === 'bag' ? pick(C.BAG_TIPS) : C.roundNote(rd);
    await rest(c, n, note);
  }
  clearInterval(clockTick); clock = null;
  if (running && !stopRequested) await say('Antrenman bitti. Güzel iş.');
  finishSession(c, all);
}

// Rest between rounds: one coaching note, a "ten seconds" warning, then the next round is called.
async function rest(c, n, note) {
  const secs = C.REST[c.level] || 60;
  setClock('Dinlenme', secs);
  const until = now() + secs;
  cmd('Dinlen'); result(''); banner(note);
  await say(`Dinlen. ${note}`);
  let warned = false;
  while (running && !stopRequested && now() < until) {
    if (!warned && until - now() <= 10) { warned = true; say('On saniye'); }
    await sleep(0.2);
  }
  banner('');
  if (running && !stopRequested) await say(`Raund ${n + 1}. Başla!`);
}

// Wait until t, but give up early on stop.
async function waitUntil(t) {
  while (running && !stopRequested && now() < t) await sleep(0.1);
}

// Bag round: no camera. Combos called left/right, with a 10-second burst about every 45 s.
async function bagRound(c, weak, roundEnd, all) {
  const rd = { combos: 0, drills: 0 };
  let nextDrill = now() + 30 + Math.random() * 20;
  const [lo, hi] = PAUSE[c.level];
  while (running && !stopRequested && now() < roundEnd) {
    if (now() > nextDrill && roundEnd - now() > 14) {
      const d = pick(C.BAG_DRILLS);
      cmd(d.show);
      await say(d.say, { rate: 1.2 });
      await waitUntil(Math.min(now() + d.secs, roundEnd));
      if (running && !stopRequested) say('Bitti, devam!', { rate: 1.2 });
      rd.drills++; all.drills++;
      nextDrill = now() + 40 + Math.random() * 15;
      await waitUntil(Math.min(now() + 1.5, roundEnd));
      continue;
    }
    const combo = C.pickFocus(C.BAG_COMBOS[c.level], weak.moves);
    const t = A.comboText(combo, c.stance, c.names);
    cmd(t.show);
    await say(t.say, { rate: 1.15 });
    rd.combos++; all.combos++;
    // Longer combos need longer to throw, so the pause grows with the combo.
    await waitUntil(Math.min(now() + lo + Math.random() * (hi - lo) + 0.4 * combo.length, roundEnd));
  }
  cmd('');
  return rd;
}

// One camera round of the chosen mode. Returns the numbers the judge and the break note need.
async function cameraRound(c, weak, roundEnd, all) {
  const { mode, level, stance } = c;
  const results = [], defences = [];
  let lastCue = -10;
  const attack = async (ids, speed) => {
    const ds = await defendSeq(ids, level, speed, c.names);
    if (ds) defences.push(...ds);
    return ds;
  };
  const strike = async (combo, slack) => {
    const r = await strikeRound(combo, stance, slack, c.names);
    if (r) results.push(r);
    return r;
  };

  while (running && !stopRequested && now() < roundEnd) {
    if (mode === 'fight' || mode === 'shadow') {
      // Shadow: half the time the opponent attacks (singles or chains), half the time the fighter leads.
      if (mode === 'fight' || Math.random() < 0.5) {
        const chain = mode === 'shadow' && ATTACK_SEQS[level].length && Math.random() < 0.4;
        const ids = chain ? pick(ATTACK_SEQS[level]) : [C.pickFocus(ATTACK_POOL[level], weak.attacks)];
        const ds = await attack(ids, 1);
        if (!ds) break;
        if (ds.every((d) => d.verdict === 'ok' || d.verdict === 'late')) {
          if (!(await strike(pick(COUNTERS[level]), 0.6))) break;
        }
      } else if (!(await strike(C.pickFocus(A.COMBOS[level], weak.moves), 0.8))) break;
    } else if (mode === 'fast') {
      // Attacks come about a third of the time, unannounced, with a slightly shorter window.
      if (Math.random() < 0.35) { if (!(await attack([pick(ATTACK_POOL[level])], 0.85))) break; }
      else if (!(await strike([pick(FAST_MOVES[level])], 0.4))) break;
    } else {
      const r = await strike(C.pickFocus(A.COMBOS[level], weak.moves), 1.0);
      if (!r) break;
      const sloppy = r.moves.some((m) => m.guardDrop) || (r.moves.some((m) => m.got) && !r.returnedGuard);
      if (sloppy && now() - lastCue > 8) { lastCue = now(); say('Gard!', { rate: 1.2 }); }
    }

    // Pause; also measures whether the guard stays up while waiting.
    const [lo, hi] = (mode === 'session' ? PAUSE : FAST_PAUSE)[level];
    const pauseEnd = Math.min(now() + lo + Math.random() * (hi - lo), roundEnd);
    cmd('');
    const from = now();
    await waitUntil(pauseEnd);
    for (const f of frameLog) if (f.t > from + 0.3 && f.t < pauseEnd) { all.idleAll++; if (A.guardUp(f.frame, 'L') && A.guardUp(f.frame, 'R')) all.idleUp++; }
  }
  cmd('');
  all.results.push(...results); all.defences.push(...defences);
  const moves = results.flatMap((r) => r.moves);
  const count = (v) => defences.filter((d) => d.verdict === v).length;
  return {
    landed: moves.filter((m) => m.verdict === 'ok').length,
    tries: moves.length,
    defended: count('ok'),
    late: count('late'),
    hit: count('none') + count('wrongDef'),
    attacks: defences.length,
    guardDrop: moves.length ? moves.filter((m) => m.guardDrop).length / moves.length : 0,
  };
}

// Say a combo, wait for the strikes, score them. Returns null if stopped.
async function strikeRound(combo, stance, slack, names) {
  const t = A.comboText(combo, stance, names);
  let cmdStart = now();
  cmd(t.show);
  result('');
  await say(t.say, { rate: 1.15, onStart: (s) => (cmdStart = s) });
  const spokeEnd = now();

  // Wait until all strikes are seen (plus a moment), or the window runs out.
  const deadline = spokeEnd + slack + 0.7 * combo.length;
  let events = [];
  while (now() < deadline && !stopRequested) {
    events = eventLog.filter((e) => e.start >= cmdStart - 0.05);
    if (events.length >= combo.length && now() - events.at(-1).end > 0.5) break;
    await sleep(0.05);
  }
  if (stopRequested) return null;
  events = eventLog.filter((e) => e.start >= cmdStart - 0.05);

  // Give the hands time to come back, then check the guard.
  const lastEnd = events.at(-1)?.end ?? now();
  while (now() < lastEnd + 0.8) await sleep(0.05);
  const after = frameLog.filter((f) => f.t > lastEnd && f.t <= lastEnd + 0.8).map((f) => f.frame);
  const r = A.scoreCombo(combo, events, stance, cmdStart, after);
  showComboResult(r, names);
  return r;
}

// The coach calls one attack or a chain; each one lands SEQ_GAP after the one before.
// Every attack is answered by the first defence after the previous answer. Returns null if stopped.
async function defendSeq(ids, level, speed, names) {
  const t = A.attackText(ids, names);
  let callStart = now();
  cmd(t.show, true);
  result('');
  say(t.say, { rate: 1.35, onStart: (s) => (callStart = s) });
  const hitAt = (i) => callStart + WINDOW[level] * speed + i * SEQ_GAP;
  await sleep(0.05);
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    const prev = out.at(-1);
    const from = () => (!prev ? callStart : prev.got ? prev.got.start + 0.05 : Math.max(callStart, hitAt(i - 1) - 0.2));
    const answered = () => defLog.some((d) => d.start >= from()) || eventLog.some((e) => e.kind === 'leg' && e.start >= from());
    while (!stopRequested && now() < hitAt(i) + 0.6 && !answered()) await sleep(0.03);
    if (stopRequested) return null;
    out.push(A.scoreDefence(ids[i], defLog, eventLog, from(), hitAt(i)));
  }
  showDefence(ids, out, names);
  if (out.some((d) => d.verdict === 'none')) { say('Yedin!', { rate: 1.2 }); await sleep(0.6); }
  return out;
}

function showDefence(ids, ds, names) {
  const lines = ds.map((d, i) => {
    const what = A.attackText([ids[i]], names).show.slice(0, -1);
    const name = d.got ? A.DEF_NAME[d.got.type] : '';
    const react = d.reaction != null ? ` · ${d.reaction.toFixed(2)} sn` : '';
    if (d.verdict === 'ok') return `<span class="${d.waistBend ? 'warn' : 'ok'}">✓ ${name}${react}</span>${d.waistBend ? ' <span class="warn">belden eğildin, dizlerinden çök</span>' : ''}`;
    if (d.verdict === 'late') return `<span class="warn">Geç kaldın: ${name}${react}</span>`;
    if (d.verdict === 'wrongDef') return `<span class="bad">✗ ${what}: ${name} işe yaramaz</span> <span class="warn">Doğrusu: ${A.ATTACKS[ids[i]].ok.map((k) => A.DEF_NAME[k]).join(' ya da ')}</span>`;
    return `<span class="bad">✗ ${what}: yedin</span>`;
  });
  result(lines.join('<br>'));
}

function showComboResult(r, names) {
  const nm = (id) => A.moveName(id, settings.stance, names).show;
  const parts = r.moves.map((m) => {
    if (m.verdict === 'ok') return `<span class="${m.guardDrop ? 'warn' : 'ok'}">✓ ${nm(m.id)}</span>`;
    if (m.verdict === 'missed') return `<span class="bad">✗ ${nm(m.id)} görmedim</span>`;
    return `<span class="bad">✗ ${A.eventName(m.got)} attın</span>`;
  });
  const react = r.reaction != null ? ` · ${r.reaction.toFixed(2)} sn` : '';
  const guard = r.moves.some((m) => m.guardDrop) ? '<br><span class="warn">Boştaki el düştü</span>'
    : r.moves.some((m) => m.got) && !r.returnedGuard ? '<br><span class="warn">Gardına dönmedin</span>' : '';
  result(parts.join(' &nbsp; ') + react + guard);
}

// ---------- summary ----------
async function finishSession(c, all) {
  await end();
  const { mode } = c;
  const history = loadHistory();
  const prev = history.filter((h) => (h.mode || 'session') === mode).at(-1);
  const base = { at: Date.now(), mode, level: c.level, program: !!c.program, rounds: all.rounds.length };

  if (mode === 'bag') {
    if (!all.combos) { show('menu'); return; }
    saveHistory(history, { ...base, combos: all.combos, drills: all.drills, secs: Math.round(all.worked) });
    renderBagSummary(c, all);
    show('summary');
    return;
  }
  if (!all.results.length && !all.defences.length) { show('menu'); return; }
  const s = A.summarize(all.results, all.idleAll > 30 ? all.idleUp / all.idleAll : null);
  const f = all.defences.length ? A.summarizeFight(all.defences) : null;
  const judged = mode === 'shadow' && all.rounds.length ? C.judgeFight(all.rounds) : null;
  saveHistory(history, {
    ...base, ...s.stats, defended: f?.stats.defended, defReaction: f?.stats.avgReaction,
    byAttack: f?.stats.byAttack, result: judged?.result,
  });
  renderSummary(c, s, f, prev, judged, all.rounds);
  show('summary');
}

function saveHistory(history, entry) {
  try { localStorage.setItem('gk-history', JSON.stringify([...history, entry].slice(-30))); } catch {}
}

const cardsHtml = (cards) => cards.map(([k, v, d]) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d || ''}</div></div>`).join('');

function renderBagSummary(c, all) {
  $('sumSub').textContent = `Kum torbası · ${all.rounds.length || 1} raund.`;
  $('cards').innerHTML = cardsHtml([
    ['Raund', all.rounds.length || 1], ['Kombinasyon', all.combos], ['Seri patlama', all.drills], ['Çalışma', mmss(all.worked)],
  ]);
  $('advice').innerHTML = [...C.BAG_TIPS].sort(() => Math.random() - 0.5).slice(0, 3).map((t) => `<li>${t}</li>`).join('');
  $('strengths').innerHTML = '<p class="d">Torbada kamera yok, vuruşlarını ölçemem. Tekniğini görmemi istersen aynı kombinasyonları Kombinasyon modunda kameraya at.</p>';
  $('roundsBox').innerHTML = '';
  $('byMoveH').hidden = true; $('byMove').innerHTML = '';
}

function renderSummary(c, { stats, tips, strengths }, fight, prev, judged, rounds) {
  const { mode } = c;
  const pct = (x) => `%${Math.round(x * 100)}`;
  const sec = (x) => (x != null ? `${x.toFixed(2)} sn` : '—');
  const diff = (cur, old, fmt, lowerIsBetter) => {
    if (old == null || cur == null) return '';
    const d = cur - old; if (Math.abs(d) < 1e-3) return 'öncekiyle aynı';
    const better = lowerIsBetter ? d < 0 : d > 0;
    return `${better ? '▲ iyileşti' : '▼ geriledi'} (önceki ${fmt(old)})`;
  };
  const strikeCards = [
    [mode === 'fight' ? 'Karşılık doğruluğu' : 'Doğruluk', stats.moves ? pct(stats.accuracy) : '—', diff(stats.accuracy, prev?.accuracy, pct)],
    [mode === 'session' ? 'Tepki' : 'Vuruş tepkisi', sec(stats.avgReaction), diff(stats.avgReaction, prev?.avgReaction, sec, true)],
  ];
  const cards = fight
    ? [['Savunma', pct(fight.stats.defended), diff(fight.stats.defended, prev?.defended, pct)],
       ['Savunma tepkisi', sec(fight.stats.avgReaction), diff(fight.stats.avgReaction, prev?.defReaction, sec, true)], ...strikeCards]
    : [...strikeCards,
       ['El düşürme', pct(stats.guardDrop), diff(stats.guardDrop, prev?.guardDrop, pct, true)],
       ['Garda dönmeme', pct(stats.noReturn), diff(stats.noReturn, prev?.noReturn, pct, true)]];
  const verdict = judged && { win: 'Maçı kazandın', loss: 'Maçı kaybettin', draw: 'Maç berabere' }[judged.result];
  $('sumSub').textContent = verdict
    ? `${verdict}, hakem kartı ${judged.you}-${judged.opp}. ${fight?.stats.attacks || 0} saldırı, ${stats.moves} vuruş.`
    : fight ? `${fight.stats.attacks} saldırı, ${stats.moves} vuruş.`
    : `${stats.combos} kombinasyon, ${stats.moves} hareket.`;
  $('cards').innerHTML = cardsHtml(cards);
  const allTips = [...(fight?.tips || []), ...tips].slice(0, 5);
  const allGood = [...(fight?.strengths || []), ...strengths];
  $('advice').innerHTML = allTips.length ? allTips.map((t) => `<li>${t}</li>`).join('') : '<li>Belirgin bir hata görmedim. Seviyeyi yükseltmeyi dene.</li>';
  $('strengths').innerHTML = allGood.length ? `<h2>İyi gidenler</h2>${allGood.map((t) => `<p class="good">${t}</p>`).join('')}` : '';
  const word = { win: 'kazandın', loss: 'kaybettin', draw: 'berabere' };
  $('roundsBox').innerHTML = judged
    ? `<h2>Raundlar</h2><table>${rounds.map((r, i) => `<tr><td>${i + 1}. raund · ${r.landed} isabet, ${r.defended} savunma, ${r.hit} yediğin</td><td>${r.score[0]}-${r.score[1]} ${word[r.result]}</td></tr>`).join('')}</table>`
    : '';
  const rows = [
    ...Object.entries(fight?.stats.byAttack || {}).map(([id, b]) => [`${A.attackText([id], c.names).show.slice(0, -1)} savunması`, b]),
    ...Object.entries(stats.byMove).map(([id, b]) => [A.moveName(id, c.stance, c.names).show, b]),
  ];
  $('byMoveH').hidden = !rows.length;
  $('byMove').innerHTML = rows
    .sort((a, b) => b[1].tries - a[1].tries)
    .map(([name, b]) => `<tr><td>${name}</td><td>${b.ok}/${b.tries}</td></tr>`).join('');
}

renderProgram();
