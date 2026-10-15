// Web Audio 合成音效與背景音樂，不需要外部音檔。
let audioContext,
  SOUND_ON = true;
const playSound = (f, d = 0.1, ty = 'square', v = 0.035, f2) => {
  if (!SOUND_ON) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioContext.createOscillator(),
      g = audioContext.createGain();
    o.type = ty;
    o.frequency.value = f;
    if (f2) o.frequency.linearRampToValueAtTime(f2, audioContext.currentTime + d);
    g.gain.value = v;
    o.connect(g);
    g.connect(audioContext.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(1e-4, audioContext.currentTime + d);
    o.stop(audioContext.currentTime + d);
  } catch (e) {}
};
const music = { mode: '', step: 0, next: 0, on: true, vol: 0.55, timer: null, master: null };
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
    [60, 64, 67],
    [59, 62, 67],
    [57, 60, 64],
    [53, 57, 60],
  ],
  ROOT = [36, 43, 45, 41];
const MEL1 = [
  72, 0, 76, 0, 79, 76, 74, 0, 71, 0, 74, 0, 79, 74, 71, 0, 69, 0, 72, 0, 76, 72, 69, 0, 65, 0, 69,
  0, 72, 69, 67, 0,
];
const MEL2 = [
  76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 79, 0, 83, 79, 74, 0, 72, 0, 76, 0, 81, 76, 72, 0, 72, 0, 77,
  0, 81, 77, 74, 0,
];
const MELE = [
  72, 0, 0, 0, 76, 0, 0, 0, 74, 0, 0, 0, 71, 0, 0, 0, 72, 0, 0, 0, 69, 0, 0, 0, 77, 0, 0, 0, 76, 0,
  74, 0,
];
function bgmNote(f, t0, d, ty, v) {
  const o = audioContext.createOscillator(),
    g = audioContext.createGain();
  o.type = ty;
  o.frequency.value = f;
  o.connect(g);
  g.connect(music.master);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(v, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.start(t0);
  o.stop(t0 + d + 0.03);
}
function bgmHat(t0, v) {
  const n = Math.floor(audioContext.sampleRate * 0.04),
    b = audioContext.createBuffer(1, n, audioContext.sampleRate),
    dd = b.getChannelData(0);
  for (let i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = audioContext.createBufferSource();
  s.buffer = b;
  const g = audioContext.createGain();
  g.gain.value = v;
  const hp = audioContext.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  s.connect(hp);
  hp.connect(g);
  g.connect(music.master);
  s.start(t0);
}
function bgmPlay(step, t0, d) {
  const m = music.mode,
    bar = Math.floor(step / 8) % 4,
    k = step % 8,
    loop = Math.floor(step / 32),
    ch = CHORDS[bar];
  if (m === 'end') {
    if (k === 0) ch.forEach((n) => bgmNote(mf(n), t0, d * 7, 'triangle', 0.02));
    if (k === 0 || k === 4) bgmNote(mf(ROOT[bar]), t0, d * 3.6, 'triangle', 0.06);
    const e = MELE[step % 32];
    if (e) bgmNote(mf(e), t0, d * 3, 'triangle', 0.04);
    return;
  }
  bgmNote(
    mf(ch[[0, 1, 2, 1, 0, 1, 2, 1][k]]),
    t0,
    d * 0.9,
    'triangle',
    m === 'game' ? 0.02 : 0.016,
  );
  if (k === 0 || k === 4) bgmNote(mf(ROOT[bar]), t0, d * 1.8, 'triangle', 0.07);
  if (k === 6) bgmNote(mf(ROOT[bar] + 7), t0, d * 0.8, 'triangle', 0.04);
  const ml = (loop % 2 ? MEL2 : MEL1)[step % 32];
  if (ml) bgmNote(mf(ml), t0, d * 1.6, 'square', 0.024);
  if (k % 2 === 1) bgmHat(t0, m === 'game' ? 0.012 : 0.006);
}
function bgmTick() {
  if (!audioContext || !music.on || !music.mode || audioContext.state !== 'running') return;
  const sd = 60 / ({ game: 140, end: 84 }[music.mode] || 112) / 2;
  if (music.next < audioContext.currentTime) music.next = audioContext.currentTime + 0.05;
  while (music.next < audioContext.currentTime + 0.3) {
    bgmPlay(music.step, music.next, sd);
    music.next += sd;
    music.step++;
  }
}
function setMusic(m) {
  music.mode = m;
  music.step = 0;
  music.next = 0;
  if (audioContext && audioContext.state === 'suspended') audioContext.resume();
}
function startMusic() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (!music.master) {
      music.master = audioContext.createGain();
      music.master.gain.value = music.on ? music.vol : 0;
      music.master.connect(audioContext.destination);
    }
    audioContext.resume().catch(() => {});
    if (!music.timer) music.timer = setInterval(bgmTick, 80);
    setMusic('street');
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (!audioContext) return;
  if (document.hidden) audioContext.suspend().catch(() => {});
  else if (music.on) audioContext.resume();
});

export function resumeAudio() {
  if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
}
export function setSound(enabled) {
  music.on = Boolean(enabled);
  SOUND_ON = music.on;
  if (music.master) music.master.gain.value = music.on ? music.vol : 0;
  if (music.on) resumeAudio();
  return music.on;
}
export function toggleSound() {
  return setSound(!music.on);
}
export { playSound, setMusic, startMusic, music };
