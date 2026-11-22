import { PoseLandmarker, FilesetResolver, DrawingUtils } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs';
import * as A from './analyzer.js';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
// Landmarks that must be on screen: nose, shoulders, wrists, hips, knees, ankles.
const NEEDED = [0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28];
// Pause between combos, by level (seconds, min..max).
const PAUSE = { 1: [2.8, 4], 2: [1.8, 3], 3: [1.2, 2.2] };

const $ = (id) => document.getElementById(id);
const now = () => performance.now() / 1000;
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- settings (remembered per device) ----------
const settings = { stance: 'orthodox', level: '1', minutes: '2' };
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
}

// ---------- UI helpers ----------
const show = (id) => ['menu', 'summary', 'stage'].forEach((s) => ($(s).hidden = s !== id));
const banner = (text) => { $('banner').innerHTML = text ? `<span>${text}</span>` : ''; };
const cmd = (text) => { $('cmd').textContent = text; };
const result = (html) => { $('result').innerHTML = html; };

async function begin(mode) {
  $('err').textContent = '';
  // First speak() must happen inside the tap, or iOS stays silent for the whole session.
  say('Hazırlan');
  keepAwake();
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
  detector = A.createDetector(); frameLog = []; eventLog = []; lastVideoTime = -1;
  running = true; show('stage'); cmd(''); result(''); $('timer').textContent = '';
  requestAnimationFrame(loop);
  if (mode === 'test') runTest(); else runSession();
}

async function end() {
  running = false; onEvent = null;
  speechSynthesis?.cancel();
  stopCamera();
  try { await wakeLock?.release(); } catch {}
}

$('go').onclick = () => begin('session');
$('testBtn').onclick = () => begin('test');
$('stop').onclick = () => { stopRequested = true; if (testing) { end(); show('menu'); } };
$('again').onclick = () => begin('session');
$('home').onclick = () => show('menu');

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
    seen.unshift(A.eventName(ev));
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

async function runSession() {
  stopRequested = false;
  const stance = settings.stance, level = settings.level;
  const total = Number(settings.minutes) * 60;
  const results = [];
  let idleUp = 0, idleAll = 0, lastCue = -10;

  await calibrate();
  if (!running || stopRequested) return finishSession(results, null);
  await say('Başlıyoruz');
  const startedAt = now();
  const tick = setInterval(() => {
    const left = Math.max(0, total - (now() - startedAt));
    $('timer').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  }, 250);

  while (running && !stopRequested && now() - startedAt < total) {
    const combo = pick(A.COMBOS[level]);
    const names = combo.map((id) => A.moveName(id, stance));
    let cmdStart = now();
    cmd(names.map((n) => n.show).join(' · '));
    result('');
    await say(names.map((n) => n.say).join(', '), { rate: 1.15, onStart: (t) => (cmdStart = t) });
    const spokeEnd = now();

    // Wait until all strikes are seen (plus a moment), or the window runs out.
    const deadline = spokeEnd + 1.0 + 0.7 * combo.length;
    let events = [];
    while (now() < deadline && !stopRequested) {
      events = eventLog.filter((e) => e.start >= cmdStart - 0.05);
      if (events.length >= combo.length && now() - events.at(-1).end > 0.5) break;
      await sleep(0.05);
    }
    events = eventLog.filter((e) => e.start >= cmdStart - 0.05);
    if (stopRequested) break;

    // Give the hands time to come back, then check the guard.
    const lastEnd = events.at(-1)?.end ?? now();
    while (now() < lastEnd + 0.8) await sleep(0.05);
    const after = frameLog.filter((f) => f.t > lastEnd && f.t <= lastEnd + 0.8).map((f) => f.frame);
    const r = A.scoreCombo(combo, events, stance, cmdStart, after);
    results.push(r);
    showComboResult(r);

    const sloppy = r.moves.some((m) => m.guardDrop) || (events.length && !r.returnedGuard);
    if (sloppy && now() - lastCue > 8) { lastCue = now(); say('Gard!', { rate: 1.2 }); }

    // Pause between combos; also measures whether the guard stays up while waiting.
    const [lo, hi] = PAUSE[level];
    const pauseEnd = now() + lo + Math.random() * (hi - lo);
    cmd('');
    const from = now();
    while (now() < pauseEnd && !stopRequested) await sleep(0.1);
    for (const f of frameLog) if (f.t > from + 0.3 && f.t < pauseEnd) { idleAll++; if (A.guardUp(f.frame, 'L') && A.guardUp(f.frame, 'R')) idleUp++; }
  }
  clearInterval(tick);
  if (running) await say('Süre bitti. Güzel iş.');
  finishSession(results, idleAll > 30 ? idleUp / idleAll : null);
}

function showComboResult(r) {
  const parts = r.moves.map((m) => {
    if (m.verdict === 'ok') return `<span class="${m.guardDrop ? 'warn' : 'ok'}">✓ ${A.moveName(m.id, settings.stance).show}</span>`;
    if (m.verdict === 'missed') return `<span class="bad">✗ ${A.moveName(m.id, settings.stance).show} görmedim</span>`;
    return `<span class="bad">✗ ${A.eventName(m.got)} attın</span>`;
  });
  const react = r.reaction != null ? ` · ${r.reaction.toFixed(2)} sn` : '';
  const guard = r.moves.some((m) => m.guardDrop) ? '<br><span class="warn">Boştaki el düştü</span>'
    : r.moves.some((m) => m.got) && !r.returnedGuard ? '<br><span class="warn">Gardına dönmedin</span>' : '';
  result(parts.join(' &nbsp; ') + react + guard);
}

async function finishSession(results, idleGuard) {
  await end();
  if (!results.length) { show('menu'); return; }
  const s = A.summarize(results, idleGuard);
  let history = [];
  try { history = JSON.parse(localStorage.getItem('gk-history') || '[]'); } catch {}
  const prev = history.at(-1);
  const entry = { at: Date.now(), level: settings.level, ...s.stats };
  try { localStorage.setItem('gk-history', JSON.stringify([...history, entry].slice(-30))); } catch {}
  renderSummary(s, prev);
  show('summary');
}

function renderSummary({ stats, tips, strengths }, prev) {
  const pct = (x) => `%${Math.round(x * 100)}`;
  const diff = (cur, old, fmt, lowerIsBetter) => {
    if (old == null || cur == null) return '';
    const d = cur - old; if (Math.abs(d) < 1e-3) return 'öncekiyle aynı';
    const better = lowerIsBetter ? d < 0 : d > 0;
    return `${better ? '▲ iyileşti' : '▼ geriledi'} (önceki ${fmt(old)})`;
  };
  $('sumSub').textContent = `${stats.combos} kombinasyon, ${stats.moves} hareket.`;
  const cards = [
    ['Doğruluk', pct(stats.accuracy), diff(stats.accuracy, prev?.accuracy, pct)],
    ['Tepki', stats.avgReaction != null ? `${stats.avgReaction.toFixed(2)} sn` : '—', diff(stats.avgReaction, prev?.avgReaction, (x) => `${x.toFixed(2)} sn`, true)],
    ['El düşürme', pct(stats.guardDrop), diff(stats.guardDrop, prev?.guardDrop, pct, true)],
    ['Garda dönmeme', pct(stats.noReturn), diff(stats.noReturn, prev?.noReturn, pct, true)],
  ];
  $('cards').innerHTML = cards.map(([k, v, d]) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join('');
  $('advice').innerHTML = tips.length ? tips.map((t) => `<li>${t}</li>`).join('') : '<li>Belirgin bir hata görmedim. Seviyeyi yükseltmeyi dene.</li>';
  $('strengths').innerHTML = strengths.length ? `<h2>İyi gidenler</h2>${strengths.map((t) => `<p class="good">${t}</p>`).join('')}` : '';
  $('byMove').innerHTML = Object.entries(stats.byMove)
    .sort((a, b) => b[1].tries - a[1].tries)
    .map(([id, b]) => `<tr><td>${A.moveName(id, settings.stance).show}</td><td>${b.ok}/${b.tries}</td></tr>`).join('');
}
