import { assets } from './assets.js';
import { characters } from './characters.js';
import {
  playSound,
  setMusic,
  startMusic,
  music,
  resumeAudio,
  toggleSound,
  setSound,
} from './audio.js';
import { readProgress, writeProgress } from './storage.js';
import { setupDialogs, isModalOpen, closeTopModal } from './ui.js';
import { shuffled } from './utils.js';
import { loadingPose, creditsMotion } from './presentation.js';

// Engine coordinates follow the original pixel-art poster; CSS scales the whole stage.

const WORLD_WIDTH = 887,
  WORLD_HEIGHT = 1774,
  getElement = (i) => document.getElementById(i),
  canvas = getElement('c'),
  context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
const FONT_FAMILY = "'DotGothic16','FusionPixelTW',monospace";
const createImage = (s) => {
  const i = new Image();
  i.src = s;
  return i;
};
const HAS_CLEAN_BACKGROUND = !!assets.cleanBackground,
  backgroundImage = createImage(assets.cleanBackground || assets.background),
  carImage = createImage(assets.car),
  pinkCarImage = createImage(assets.pinkCar),
  characterImages = assets.sprites.map((o) => createImage(o.src));
const fillRect = (c, a, b, w, h) => {
  context.fillStyle = c;
  context.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h));
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 角色設定位於 characters.js。

// ===== state =====
let march = 0,
  jp = { n: 0, t: 0, k: 0 },
  eggs = [],
  J_EGG_MESSAGES = [
    'JP = JAPAN 🇯🇵<br>J 代表 Japan，也代表全團唯一的 J 人——鳥導遊！',
    'J 人（Judging）負責行程，P 人（Perceiving）負責亂入。<br>這團是 1 個 J 帶 6 個 P。',
    '再點一次你就知道了：<br>鳥導遊旗子上的「JP」，其實是 Just Pigeon（開玩笑的）。',
  ],
  elapsedTime = 0,
  hasBooted = 0,
  isPlaying = 0,
  night = 0,
  nightTransition = 0,
  flash = 0,
  towerLightTime = 0,
  mountainEffectTime = 0,
  parts = [],
  keys = {},
  trainOffset = 0,
  boost = 0,
  metCharacters = new Set(),
  foundSecrets = new Set(),
  pendingHotspot = null,
  rip = null,
  bub = null,
  newsItems = [],
  currentCharacter = 0,
  dialogueTime = 0;
const fl = { cam: 0, book: 0, tea: 0, tk: 0, tok: 0, car: 0 };
const homes = assets.sprites.map((o) => ({ x: o.x + o.w / 2, y: o.y + o.h }));
const HOME_CENTER_X = homes.reduce((a, h) => a + h.x, 0) / 7,
  HOME_BASE_Y = Math.max(...homes.map((h) => h.y)) - 6;
const offs = homes.map((h) => ({ dx: h.x - HOME_CENTER_X, dy: h.y - HOME_BASE_Y }));
const party = {
  x: HOME_CENTER_X,
  y: HOME_BASE_Y,
  tx: null,
  ty: null,
  g: 1,
  gt: 1,
  face: 1,
  mv: 0,
  m: homes.map((h) => ({ x: h.x, y: h.y })),
  jump: [0, 0, 0, 0, 0, 0, 0],
};
const pc = { x: -300, y: 1306, dir: 1, run: 0, hon: 0 },
  car = { x: assets.carX, y: assets.carY, hon: 0 };
const perspectiveScale = (y) => Math.min(1, 0.42 + (0.58 * (y - 1300)) / (HOME_BASE_Y - 1300));
const partyHalfWidth = (y = party.y) => {
  const s = perspectiveScale(y);
  return 360 * s * party.g + 50;
};
function clampPartyPosition(px, py) {
  py = clamp(py, 1380, HOME_BASE_Y);
  const h = partyHalfWidth(py);
  return [clamp(px, h, WORLD_WIDTH - h), py];
}
// ===== UI =====
function say(txt, name, ms = 3400) {
  const e = getElement('say');
  getElement('st').textContent = txt.replace(/<br\s*\/?\s*>/gi, ' ');
  getElement('sn').textContent = name || '';
  getElement('sn').style.display = name ? 'block' : 'none';
  e.style.display = 'block';
  dialogueTime = ms / 1000;
  playSound(560, 0.04);
}
getElement('say').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  getElement('say').style.display = 'none';
  dialogueTime = 0;
});
const DAYS = [
  '10.28 淺草',
  '10.29 表參道',
  '10.30 鎌倉',
  '10.31 吉祥寺',
  '11.01 銀座',
  '11.02 中目黑',
];
let currentDay = 0;
function mark(id) {
  if (foundSecrets.has(id)) return;
  foundSecrets.add(id);
  getElement('h1').textContent = foundSecrets.size;
  newsItems.unshift('快報：發現「' + id + '」！');
  newsItems = newsItems.slice(0, 3);
  playSound(880, 0.15, 'triangle', 0.06);
  coachNext(1);
  toast('✨ 發現：' + id);
  const d = Math.min(5, Math.floor(foundSecrets.size / 3));
  if (d > currentDay) {
    currentDay = d;
    setTimeout(() => toast('📅 ' + DAYS[d] + ' 出發！'), 1500);
    newsItems.unshift('今日行程：' + DAYS[d]);
    newsItems = newsItems.slice(0, 3);
  }
  saveProgress();
  if (foundSecrets.size === 16) setTimeout(showEnd, 1300);
}
function toast(s) {
  const e = getElement('toast');
  e.textContent = s;
  e.style.opacity = 1;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (e.style.opacity = 0), 2000);
}
function spawnEgg(a, b, chs, cs) {
  chs.forEach((ch, i) =>
    eggs.push({
      x: a,
      y: b,
      vx: (i - chs.length / 2) * 5 + (Math.random() - 0.5) * 4,
      vy: -14 - Math.random() * 8,
      l: 1.6,
      ch,
      c: cs[i % cs.length],
    }),
  );
}
function burst(a, b, cs, n = 24, sp = 14) {
  for (let i = 0; i < n; i++)
    parts.push({
      x: a,
      y: b,
      vx: (Math.random() - 0.5) * sp,
      vy: -Math.random() * sp * 0.8,
      l: 1,
      c: cs[i % cs.length],
    });
}
const ELEMENT_ICONS = { 風: '🌪️', 水: '💧', 闇: '🌑', 光: '✨', 土: '🪨', 火: '🔥' },
  STAT_LABELS = ['體力', '購物力', '美食雷達', '方向感', '拍照力'];
function card(i) {
  coachNext(2);
  currentCharacter = i;
  const c = characters[i];
  metCharacters.add(i);
  getElement('h2').textContent = metCharacters.size;
  getElement('pn').textContent = metCharacters.size;
  getElement('ov').style.display = 'flex';
  getElement('ov').scrollTop = 0;
  getElement('pi').src = assets.sprites[i].src;
  getElement('pi').alt = c.name;
  getElement('cno').textContent = 'No.' + (i + 1);
  getElement('cn').textContent = c.name;
  getElement('cr').textContent = c.title;
  getElement('cb').innerHTML =
    (c.mbti ? '<span class="bd r">' + c.mbti + '</span>' : '<span class="bd b">?</span>') +
    '<span class="bd y">' +
    ELEMENT_ICONS[c.element] +
    ' ' +
    c.element +
    '屬性</span>';
  getElement('stats').innerHTML = STAT_LABELS.map(
    (n, k) =>
      '<div class="sr"><span>' +
      n +
      '</span><span class="bl">' +
      [0, 1, 2, 3, 4].map((j) => '<i class="' + (j < c.stats[k] ? 'f' : '') + '"></i>').join('') +
      '</span></div>',
  ).join('');
  getElement('sk').textContent = c.skill;
  getElement('it').textContent = c.item;
  getElement('bio').textContent = c.biography;
  getElement('dots').innerHTML = characters
    .map((_, k) => '<i class="' + (k === i ? 'on' : metCharacters.has(k) ? 'met' : '') + '"></i>')
    .join('');
  party.jump[i] = 1;
  playSound(700, 0.15, 'triangle', 0.05, 1000);
  saveProgress();
  if (metCharacters.size === 7 && !card.done) {
    card.done = 1;
    newsItems.unshift('★ 七位團員都認識了！ ★');
  }
}
getElement('cx').onclick = () => {
  getElement('ov').style.display = 'none';
  playSound(500, 0.06);
};
getElement('pv').onclick = () => card((currentCharacter + 6) % 7);
getElement('nt').onclick = () => card((currentCharacter + 1) % 7);
getElement('ov').addEventListener('pointerdown', (e) => {
  if (e.target === getElement('ov')) getElement('ov').style.display = 'none';
});
// ===== hotspots =====
const trainR = [420, 899, 330, 215];
const hotspots = [
  {
    id: 'J彩蛋',
    r: [600, 80, 190, 250],
    p: [690, 215],
    d() {
      jp.n++;
      jp.t = 3.4;
      jp.k = jp.n;
      spawnEgg(
        690,
        215,
        ['J', 'A', 'P', 'A', 'N'],
        ['#c8f31d', '#fff', '#ff2e93', '#1e5bff', '#ffe600'],
      );
      if (jp.n % 3 === 0) burst(690, 215, ['#e60026', '#fff'], 60, 30);
      playSound(900, 0.2, 'triangle', 0.06);
      say(J_EGG_MESSAGES[(jp.n - 1) % 3], '彩蛋');
    },
  },
  {
    id: 'P彩蛋',
    r: [250, 90, 150, 260],
    p: [322, 235],
    d() {
      spawnEgg(
        322,
        235,
        ['P', 'P', 'P', 'P', 'P', 'P', 'J'],
        ['#ff2e93', '#ff5fae', '#ffe600', '#c8f31d', '#8fd0ff', '#fff', '#c8f31d'],
      );
      playSound(500, 0.3, 'square', 0.05, 900);
      say(
        'P = Perceiving？Party？Photo？Pigeon？六個 P 的旅行信條只有一句：「哪裡都好～」（最後那個閃閃的 J，是來收拾殘局的。）',
        '彩蛋',
      );
    },
  },
  {
    id: '30+彩蛋',
    r: [60, 375, 330, 160],
    p: [200, 470],
    d() {
      spawnEgg(200, 470, ['熟', '女', '團', '30+'], ['#ff2e93', '#c8f31d', '#ffe600', '#fff']);
      burst(200, 470, ['#ffe600', '#ff2e93'], 30);
      playSound(700, 0.3, 'triangle', 0.06, 1200);
      say('30+：不是年紀，是經驗值。<br>熟女團＝越熟越敢玩，越玩越熟。', '彩蛋');
    },
  },
  {
    id: '東京招牌',
    r: [25, 545, 150, 520],
    p: [100, 800],
    d() {
      fl.tok = 2;
      burst(100, 800, ['#fff', '#ff2e93', '#c8f31d']);
      say('「東京」兩個字亮起來了！你們是 P 人還是 J 人？（團員裡 6 個 P，1 個 J。）');
    },
  },
  {
    id: '東京鐵塔',
    r: [655, 615, 150, 430],
    p: [705, 760],
    d() {
      towerLightTime = 3.5;
      flash = 1;
      playSound(1200, 0.1);
      say('📸 喀嚓！東京鐵塔亮燈了。', '黑髮少女');
    },
  },
  {
    id: '富士山',
    r: [480, 730, 230, 90],
    p: [590, 775],
    d() {
      mountainEffectTime = 3;
      burst(590, 760, ['#fff', '#8fd0ff']);
      say('富士山露出雪白的山頂，雲被吹散了。');
    },
  },
  {
    id: '太陽',
    r: [580, 585, 150, 150],
    p: [655, 690],
    d() {
      night = night ? 0 : 1;
      playSound(night ? 180 : 620, 0.5, 'triangle', 0.06);
      say(night ? '太陽下班了，東京的夜晚開張！' : '天亮了，新的一天出發！');
    },
  },
  {
    id: '山手線',
    r: trainR,
    p: [560, 985],
    d() {
      boost = 3;
      playSound(180, 0.9, 'sawtooth', 0.05, 460);
      say('嗶——！山手線加速通過。', '廣播');
    },
  },
  {
    id: 'カメラ招牌',
    r: [362, 830, 60, 165],
    p: [392, 915],
    d() {
      fl.cam = 1.5;
      flash = 1;
      playSound(1200, 0.08);
      say('「免費幫你們拍一張合照！」', 'カメラ店');
    },
  },
  {
    id: '本',
    r: [520, 830, 65, 95],
    p: [552, 880],
    d() {
      fl.book = 1.5;
      say('翻到一本《如何在東京不迷路》，第一頁是空白的。', '舊書店');
    },
  },
  {
    id: '茶招牌',
    r: [735, 775, 70, 120],
    p: [768, 832],
    d() {
      fl.tea = 1.5;
      say('茶招牌冒出一縷熱氣，聞起來好香。');
    },
  },
  {
    id: 'TOKYO',
    r: [795, 730, 75, 400],
    p: [832, 930],
    d() {
      fl.tk = 1.5;
      burst(832, 950, ['#c8f31d', '#fff', '#ff2e93']);
      say('TOKYO 霓虹字一格一格亮起來了！');
    },
  },
  {
    id: '吉姆尼',
    r: [assets.carX, assets.carY, assets.carWidth, assets.carHeight],
    p: [assets.carX + assets.carWidth / 2, assets.carY + 50],
    d() {
      car.hon = 1;
      pc.run = 1;
      pc.x = -300;
      pc.dir = 1;
      playSound(330, 0.2, 'square', 0.06);
      setTimeout(() => playSound(330, 0.2, 'square', 0.06), 220);
      bub = ['叭叭！', 535, 1260, 1.2];
      say('吉姆尼叭叭叫，一台粉紅色的吉姆尼開過來了！');
    },
  },
  {
    id: '販賣機',
    r: [0, 1225, 85, 175],
    p: [42, 1305],
    w: [170, 1480],
    d() {
      enterShop('C');
    },
  },
  {
    id: '雜貨店',
    r: [90, 1090, 215, 240],
    p: [230, 1235],
    w: [260, 1485],
    d() {
      enterShop('A');
    },
  },
  {
    id: '喫茶店',
    r: [800, 1215, 87, 80],
    p: [845, 1255],
    w: [740, 1485],
    d() {
      enterShop('B');
    },
  },
];
// ===== input =====
const toWorldPoint = (e) => {
  const r = canvas.getBoundingClientRect();
  return [
    ((e.clientX - r.left) / r.width) * WORLD_WIDTH,
    ((e.clientY - r.top) / r.height) * WORLD_HEIGHT,
  ];
};
function handleCanvasTap(e) {
  if (!isPlaying || isModalOpen() || transitioning) return;
  e.preventDefault();
  canvas.focus({ preventScroll: true });
  resumeAudio();
  const [px, py] = toWorldPoint(e);
  if (currentScene) {
    sceneTap(px, py);
    return;
  }
  // characters first
  const order = [...Array(7).keys()].sort((a, b) => party.m[b].y - party.m[a].y);
  for (const i of order) {
    const o = assets.sprites[i],
      s = perspectiveScale(party.m[i].y) * 0.999 + 0,
      m = party.m[i],
      w = o.w * s,
      h = o.h * s;
    if (px > m.x - w / 2 && px < m.x + w / 2 && py > m.y - h && py < m.y) {
      card(i);
      return;
    }
  }
  let hh = null,
    ha = 1e12;
  for (const h of hotspots) {
    const r = h.r;
    if (px >= r[0] && px <= r[0] + r[2] && py >= r[1] && py <= r[1] + r[3] && r[2] * r[3] < ha) {
      hh = h;
      ha = r[2] * r[3];
    }
  }
  if (hh) {
    activateHotspot(hh);
    return;
  }
  if (py > 1340 && py < 1612) {
    moveParty(px, py);
  }
}
function activateHotspot(h) {
  mark(h.id);
  if (h.w && HAS_CLEAN_BACKGROUND) {
    party.tx = h.w[0];
    party.ty = h.w[1];
    party.gt = 0.32;
    pendingHotspot = h;
  } else if (h.w) {
    march = 1;
    playSound(300, 0.08);
    setTimeout(() => h.d(), 950);
  } else {
    party.gt = party.g < 1 ? 1 : party.gt;
    h.d();
  }
}
function moveParty(px, py) {
  if (!HAS_CLEAN_BACKGROUND) {
    march = 1.4;
    rip = { x: px, y: py, t: 0 };
    playSound(300, 0.08);
    return;
  }
  party.gt = 1;
  const [a, b] = clampPartyPosition(px, py);
  party.tx = a;
  party.ty = b;
  pendingHotspot = null;
  rip = { x: a, y: b, t: 0 };
}
// A scroll or drag must not accidentally activate a secret or a timed coffee tap.
let pointerGesture = null;
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !isPlaying || isModalOpen() || transitioning) return;
  pointerGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  canvas.setPointerCapture(event.pointerId);
  canvas.focus({ preventScroll: true });
  if (currentScene === 'C' && miniGame.phase === 'play') miniGame.targetX = toWorldPoint(event)[0];
});
canvas.addEventListener('pointermove', (event) => {
  if (!pointerGesture || event.pointerId !== pointerGesture.id) return;
  if (Math.hypot(event.clientX - pointerGesture.x, event.clientY - pointerGesture.y) > 10)
    pointerGesture.moved = true;
  if (currentScene === 'C' && miniGame.phase === 'play') miniGame.targetX = toWorldPoint(event)[0];
});
canvas.addEventListener('pointerup', (event) => {
  const gesture = pointerGesture;
  pointerGesture = null;
  if (gesture && gesture.id === event.pointerId && !gesture.moved) handleCanvasTap(event);
});
canvas.addEventListener('pointercancel', () => (pointerGesture = null));
const movementKeys = new Set([
  'arrowleft',
  'arrowright',
  'arrowup',
  'arrowdown',
  'w',
  'a',
  's',
  'd',
]);
addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    closeTopModal();
    return;
  }
  if (
    !event.repeat &&
    isPlaying &&
    !isModalOpen() &&
    !transitioning &&
    currentScene &&
    miniGame.phase === 'play'
  ) {
    if (currentScene === 'B' && (event.code === 'Space' || key === ' ' || key === 'enter')) {
      event.preventDefault();
      sceneTap(443, 900);
      return;
    }
    if (currentScene === 'A' && /^[1-9]$/.test(key)) {
      const slot = Number(key) - 1;
      event.preventDefault();
      sceneTap(195 + (slot % 3) * 243, 615 + Math.floor(slot / 3) * 245);
      return;
    }
    const skill = 'qwertyu'.indexOf(key);
    if (currentScene === 'A' && skill >= 0) {
      event.preventDefault();
      if (miniGame.ready[skill]) useSkill(skill);
      return;
    }
  }
  if (
    !isPlaying ||
    isModalOpen() ||
    transitioning ||
    !movementKeys.has(key) ||
    event.target.closest('button,input,select,textarea')
  )
    return;
  event.preventDefault();
  keys[key] = 1;
});
addEventListener('keyup', (event) => (keys[event.key.toLowerCase()] = 0));
addEventListener('blur', () => {
  keys = {};
});
document.addEventListener('visibilitychange', () => {
  keys = {};
  previousFrameTime = performance.now();
});
// ===== update =====
function step(dt) {
  elapsedTime += dt;
  if (currentScene) {
    sceneStep(dt);
    return;
  }
  trainOffset += dt * (boost > 0 ? 360 : 95);
  if (boost > 0) boost -= dt;
  if (towerLightTime > 0) towerLightTime -= dt;
  if (mountainEffectTime > 0) mountainEffectTime -= dt;
  if (car.hon > 0) car.hon -= dt;
  for (const k in fl) if (fl[k] > 0) fl[k] -= dt;
  if (dialogueTime > 0) {
    dialogueTime -= dt;
    if (dialogueTime <= 0) getElement('say').style.display = 'none';
  }
  nightTransition += ((night ? 1 : 0) - nightTransition) * Math.min(1, dt * 3);
  if (pc.run) {
    pc.x += pc.dir * 420 * dt;
    if (pc.x > WORLD_WIDTH + 80) pc.run = 0;
  } else if (!pc.run && Math.random() < dt * 0.025) {
    pc.run = 1;
    pc.x = -300;
  }
  for (let i = 0; i < 7; i++)
    if (party.jump[i] > 0) party.jump[i] = Math.max(0, party.jump[i] - dt * 2.2);
  party.g += (party.gt - party.g) * Math.min(1, dt * 4);
  let mx = 0,
    my = 0;
  if (keys.arrowleft || keys.a) mx = -1;
  if (keys.arrowright || keys.d) mx = 1;
  if (keys.arrowup || keys.w) my = -1;
  if (keys.arrowdown || keys.s) my = 1;
  party.mv = HAS_CLEAN_BACKGROUND ? 0 : march > 0 ? 1 : 0;
  if (!HAS_CLEAN_BACKGROUND) {
    if (march > 0) march -= dt;
    if (isPlaying && (mx || my)) march = 0.3;
  }
  if (HAS_CLEAN_BACKGROUND && isPlaying && (mx || my)) {
    party.tx = null;
    pendingHotspot = null;
    party.gt = 1;
    const [a, b] = clampPartyPosition(party.x + mx * 200 * dt, party.y + my * 140 * dt);
    if (mx) party.face = mx;
    party.x = a;
    party.y = b;
    party.mv = 1;
  } else if (HAS_CLEAN_BACKGROUND && isPlaying && party.tx != null) {
    const dx = party.tx - party.x,
      dy = party.ty - party.y,
      d = Math.hypot(dx, dy);
    if (d < 8) {
      party.tx = null;
      if (pendingHotspot) {
        const h = pendingHotspot;
        pendingHotspot = null;
        h.d();
        party.gt = 1;
      }
    } else {
      const sp = (300 * perspectiveScale(party.y) + 90) * dt;
      party.x += (dx / d) * Math.min(sp, d);
      party.y += (dy / d) * Math.min(sp, d);
      if (Math.abs(dx) > 2) party.face = dx > 0 ? 1 : -1;
      party.mv = 1;
      if (Math.random() < 0.2)
        parts.push({
          x: party.x + (Math.random() - 0.5) * 300 * party.g,
          y: party.y,
          vx: (Math.random() - 0.5) * 3,
          vy: -3,
          l: 0.5,
          c: '#ddd',
        });
    }
  }
  const s = perspectiveScale(party.y);
  party.m.forEach((m, i) => {
    const o = offs[i],
      tx = party.x + o.dx * s * party.g,
      ty = party.y + o.dy * s,
      k = Math.min(1, dt * (party.mv ? 7 + i * 0.3 : 12));
    m.x += (tx - m.x) * k;
    m.y += (ty - m.y) * k;
  });
}
// ===== draw =====
function sprite(img, o, ax, ay, sx, sy, rot, face) {
  context.save();
  context.translate(ax, ay);
  context.rotate(rot);
  context.scale(sx * face, sy);
  context.drawImage(img, -o.w / 2, -o.h, o.w, o.h);
  context.restore();
}
function neon(r, key, idx) {
  const f =
    fl[key] > 0
      ? Math.floor(elapsedTime * 14) % 2
      : Math.sin(elapsedTime * 3 + idx * 2) > -0.55
        ? 1
        : 0;
  if (nightTransition > 0.4) return;
  if (!f) {
    context.fillStyle = 'rgba(15,10,50,.45)';
    context.fillRect(r[0], r[1], r[2], r[3]);
  } else if (fl[key] > 0) {
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = 'rgba(255,255,255,.25)';
    context.fillRect(r[0], r[1], r[2], r[3]);
    context.globalCompositeOperation = 'source-over';
  }
}
function trainDraw() {
  const sc0 = Math.floor(trainOffset);
  for (let cx = 420; cx < 748; cx += 3) {
    if (cx >= 620 && cx <= 640) continue;
    const s = (cx - 420) / 328,
      top = 899 + 171 * s - 1,
      bot = 957 + 156 * s + 2,
      th = bot - top,
      ph = (((cx - 420 + sc0) % 52) + 52) % 52,
      wi = Math.floor((cx - 420 + sc0) / 52),
      door = ((wi % 4) + 4) % 4 === 3;
    const B = (c, a, b) => fillRect(c, cx, top + a * th, 3, (b - a) * th + 1);
    B('#e8e8ee', 0, 0.09);
    B('#f6f6fa', 0.09, 0.55);
    if (door) {
      B('#dfe3ee', 0.12, 0.55);
      if (ph > 16 && ph < 24) B('#1b2a66', 0.2, 0.48);
      if (ph < 2 || ph >= 50) B('#b8bccb', 0.1, 0.55);
    } else if (ph < 32) {
      B('#1b2a66', 0.17, 0.47);
      if (ph < 4) B('#4a6ad0', 0.17, 0.2);
    }
    B('#8fd14f', 0.55, 0.76);
    B('#3e9d3e', 0.76, 0.86);
    B('#d0d0d8', 0.88, 0.96);
    B('#3a3a4a', 0.96, 1);
    if (ph < 1) B('#9a9aa8', 0.09, 0.88);
  }
}
function sparkle(px, py, sz) {
  const k = 0.65 + 0.35 * Math.sin(elapsedTime * 6 + px);
  const a = sz * k;
  context.save();
  context.translate(px, py);
  context.rotate(Math.sin(elapsedTime * 2 + py) * 0.15);
  context.fillStyle = '#fff';
  context.strokeStyle = '#111';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(0, -a);
  context.lineTo(a * 0.28, -a * 0.28);
  context.lineTo(a, 0);
  context.lineTo(a * 0.28, a * 0.28);
  context.lineTo(0, a);
  context.lineTo(-a * 0.28, a * 0.28);
  context.lineTo(-a, 0);
  context.lineTo(-a * 0.28, -a * 0.28);
  context.closePath();
  context.stroke();
  context.fill();
  context.fillStyle = '#ffe600';
  context.fillRect(-4, -4, 8, 8);
  context.restore();
}
const LED_PATTERN = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 6;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,.55)';
  g.fillRect(0, 0, 6, 2);
  g.fillRect(0, 0, 2, 6);
  return c;
})();
const MARQUEE_BOUNDS = { x: 238, y: 1630, w: 596, h: 130 };
function marquee() {
  const T1 = DAYS.map((d, i) => (i === currentDay ? '▶ ' : '') + d).join('　✈　') + '　✈　';
  context.save();
  fillRect(
    '#111',
    MARQUEE_BOUNDS.x - 6,
    MARQUEE_BOUNDS.y - 6,
    MARQUEE_BOUNDS.w + 12,
    MARQUEE_BOUNDS.h + 12,
  );
  for (let i = 0; i < 30; i++) {
    const on = (i + Math.floor(elapsedTime * 6)) % 3 === 0;
    fillRect(
      on ? '#ff2e93' : '#ffe600',
      MARQUEE_BOUNDS.x - 6 + i * 20.7,
      MARQUEE_BOUNDS.y - 6,
      8,
      4,
    );
    fillRect(
      on ? '#ffe600' : '#ff2e93',
      MARQUEE_BOUNDS.x - 6 + i * 20.7,
      MARQUEE_BOUNDS.y + MARQUEE_BOUNDS.h + 2,
      8,
      4,
    );
  }
  context.beginPath();
  context.rect(MARQUEE_BOUNDS.x, MARQUEE_BOUNDS.y, MARQUEE_BOUNDS.w, MARQUEE_BOUNDS.h);
  context.clip();
  fillRect('#0b0b18', MARQUEE_BOUNDS.x, MARQUEE_BOUNDS.y, MARQUEE_BOUNDS.w, MARQUEE_BOUNDS.h);
  context.font = '44px ' + FONT_FAMILY;
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  const w1 = context.measureText(T1).width;
  context.shadowColor = '#c8f31d';
  context.shadowBlur = 14;
  context.fillStyle = '#c8f31d';
  let o1 = -((elapsedTime * 110) % w1);
  for (let k = 0; k < 3; k++)
    context.fillText(T1, MARQUEE_BOUNDS.x + o1 + k * w1, MARQUEE_BOUNDS.y + 52);
  const T2 =
    '大人になっても、旅は冒険だ。 ★ 點閃光的地方，找出東京的 16 個小秘密 ★ ' +
    newsItems.join('　') +
    (newsItems.length ? '　★ ' : '');
  context.font = '40px ' + FONT_FAMILY;
  const w2 = context.measureText(T2).width;
  context.shadowColor = '#ff5fae';
  context.fillStyle = '#ff7cc0';
  let o2 = ((elapsedTime * 70) % w2) - w2;
  for (let k = 0; k < 3; k++)
    context.fillText(T2, MARQUEE_BOUNDS.x + o2 + k * w2, MARQUEE_BOUNDS.y + 112);
  context.shadowBlur = 0;
  context.fillStyle = context.createPattern(LED_PATTERN, 'repeat');
  context.fillRect(MARQUEE_BOUNDS.x, MARQUEE_BOUNDS.y, MARQUEE_BOUNDS.w, MARQUEE_BOUNDS.h);
  context.restore();
}
function draw(dt) {
  const frameScale = dt * 60;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  if (currentScene) {
    drawScene(dt);
    return;
  }
  if (party.mv) coachNext(0);
  context.drawImage(backgroundImage, 0, 0);
  // clouds
  context.save();
  context.beginPath();
  context.rect(272, 590, 410, 62);
  context.clip();
  for (let i = 0; i < 5; i++) {
    const cx = ((elapsedTime * (9 + i * 3) + i * 130) % 520) - 70 + 272,
      cy = 596 + i * 10,
      s = 1 + (i % 3) * 0.4,
      o = mountainEffectTime > 0 ? -30 : 0;
    fillRect('#fff', cx + o, cy, 64 * s, 10 * s);
    fillRect('#fff', cx + 14 * s + o, cy - 8 * s, 34 * s, 10 * s);
    fillRect('#cfe3ff', cx + o, cy + 10 * s, 64 * s, 5);
  }
  context.restore();
  // planes
  for (const p of [
    { x: ((elapsedTime * 30) % 520) + 250, y: 628, d: 1 },
    { x: 700 - ((elapsedTime * 20) % 440), y: 652, d: -1 },
  ]) {
    for (let k = 1; k < 9; k++) if (k % 2) fillRect('#fff', p.x - p.d * (34 + k * 16), p.y, 10, 4);
    fillRect('#111', p.x - 22, p.y - 3, 44, 10);
    fillRect('#111', p.x - 4, p.y - 16, 10, 36);
    fillRect('#111', p.x - 20, p.y - 8, 8, 8);
  }
  context.globalAlpha = 0.16 + 0.1 * Math.sin(elapsedTime * 2);
  context.fillStyle = '#ff2e93';
  context.beginPath();
  context.arc(655, 700, 92 + 6 * Math.sin(elapsedTime * 2), 0, 7);
  context.fill();
  context.globalAlpha = 1;
  for (const [a, b, w] of [
    [705, 640, 0],
    [706, 700, 3],
    [706, 770, 9],
    [706, 840, 16],
    [706, 910, 24],
    [706, 975, 32],
    [706, 1020, 38],
  ]) {
    const on =
      towerLightTime > 0
        ? Math.floor(elapsedTime * 9 + b) % 2
        : Math.sin(elapsedTime * 2.2 + b) > 0.45;
    if (on || nightTransition > 0.4) {
      fillRect('#fff', a - w - 4, b, 9, 9);
      if (w) fillRect('#fff', a + w - 4, b, 9, 9);
    }
  }
  fillRect(Math.floor(elapsedTime * 3) % 2 ? '#ff2e93' : '#fff', 702, 622, 6, 12);
  neon([362, 830, 60, 165], 'cam', 1);
  neon([520, 830, 65, 95], 'book', 2);
  neon([750, 790, 40, 90], 'tea', 3);
  if (fl.tk > 0 || Math.sin(elapsedTime * 1.7) > 0.2) {
    const k = Math.floor(elapsedTime * (fl.tk > 0 ? 12 : 3)) % 5;
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = 'rgba(200,243,29,.5)';
    context.fillRect(815, 745 + k * 76, 34, 70);
    context.globalCompositeOperation = 'source-over';
  }
  if (fl.tok > 0 && Math.floor(elapsedTime * 14) % 2) {
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = 'rgba(255,255,255,.3)';
    context.fillRect(25, 545, 150, 520);
    context.globalCompositeOperation = 'source-over';
  }
  if (fl.tea > 0 || Math.floor(elapsedTime * 2) % 4 < 2) {
    fillRect('#fff', 822, 688, 14, 6);
    fillRect('#fff', 818, 696, 22, 10);
  }
  trainDraw();
  {
    const o = { w: assets.carWidth, h: assets.carHeight },
      k = car.hon > 0 ? Math.abs(Math.sin(elapsedTime * 22)) * 5 : Math.sin(elapsedTime * 3) * 1.3;
    sprite(
      carImage,
      o,
      car.x + assets.carWidth / 2,
      car.y + assets.carHeight - k * 0.4,
      1,
      1 + k * 0.004,
      Math.sin(elapsedTime * 2.4) * 0.004,
      1,
    );
  }
  if (pc.run || pc.x > -300) {
    const o = { w: assets.carWidth, h: assets.carHeight };
    sprite(
      pinkCarImage,
      o,
      pc.x + assets.carWidth / 2,
      pc.y + assets.carHeight + Math.sin(elapsedTime * 20) * 2,
      0.85,
      0.85,
      0,
      pc.dir,
    );
  }
  // party sorted
  const ord = [...Array(7).keys()].sort((a, b) => party.m[a].y - party.m[b].y),
    s = perspectiveScale(party.y);
  for (const i of ord) {
    const m = party.m[i],
      o = assets.sprites[i],
      k = party.jump[i],
      J = k > 0 ? Math.sin((1 - k) * Math.PI) * (HAS_CLEAN_BACKGROUND ? 60 : 7) * s : 0,
      ph = elapsedTime * (party.mv ? 11 : 2.4) + i * 0.9;
    const bob = party.mv
      ? Math.abs(Math.sin(ph)) * (HAS_CLEAN_BACKGROUND ? 14 : 2.5) * s
      : Math.sin(ph) * 1.5;
    context.fillStyle = 'rgba(0,0,0,' + 0.25 * s + ')';
    context.beginPath();
    context.ellipse(m.x, m.y + 2, o.w * s * 0.3, 9 * s, 0, 0, 7);
    context.fill();
    sprite(
      characterImages[i],
      o,
      m.x,
      m.y - bob - J,
      s * (1 + (party.mv ? 0 : Math.sin(ph) * 0.006)),
      s * (1 + (party.mv ? 0 : -Math.sin(ph) * 0.012)),
      party.mv ? Math.sin(ph) * 0.06 : Math.sin(ph) * 0.01,
      party.face,
    );
    if (!metCharacters.has(i) && isPlaying) {
      const bx = m.x,
        by = m.y - o.h * s - 24 - Math.abs(Math.sin(elapsedTime * 4 + i)) * 8;
      fillRect('#111', bx - 26, by - 22, 52, 36);
      fillRect('#fff', bx - 22, by - 18, 44, 28);
      fillRect('#111', bx - 14, by - 6, 6, 6);
      fillRect('#111', bx - 3, by - 6, 6, 6);
      fillRect('#111', bx + 8, by - 6, 6, 6);
      fillRect('#fff', bx - 4, by + 10, 10, 10);
    }
  }
  // sparkles
  if (isPlaying) for (const h of hotspots) if (!foundSecrets.has(h.id)) sparkle(h.p[0], h.p[1], 24);
  if (rip) {
    rip.t += dt * 3;
    context.strokeStyle = 'rgba(255,255,255,' + (1 - rip.t) + ')';
    context.lineWidth = 5;
    context.beginPath();
    context.ellipse(rip.x, rip.y, 70 * rip.t + 6, 26 * rip.t + 3, 0, 0, 7);
    context.stroke();
    if (rip.t > 1) rip = null;
  }

  for (const e of eggs) {
    e.x += e.vx * frameScale;
    e.y += e.vy * frameScale;
    e.vy += 0.7 * frameScale;
    e.l -= dt;
    context.font = '64px ' + FONT_FAMILY;
    context.textAlign = 'center';
    context.globalAlpha = Math.min(1, e.l);
    context.fillStyle = '#111';
    context.fillText(e.ch, e.x + 4, e.y + 4);
    context.fillStyle = e.c;
    context.fillText(e.ch, e.x, e.y);
    context.globalAlpha = 1;
  }
  eggs = eggs.filter((e) => e.l > 0);
  if (jp.t > 0) {
    jp.t -= dt;
    const n = Math.min(5, Math.floor((3.4 - jp.t) / 0.26));
    fillRect('#111', 110, 22, 560, 112);
    for (let i = 0; i < 5; i++) {
      if (i < n) {
        fillRect('#c8f31d', 124 + i * 106, 34, 92, 88);
        context.font = '72px ' + FONT_FAMILY;
        context.textAlign = 'center';
        context.fillStyle = '#111';
        context.fillText('JAPAN'[i], 170 + i * 106, 100);
      } else fillRect('#333', 124 + i * 106, 34, 92, 88);
    }
    for (let c = 0; c < 110; c += 5) {
      const wv = Math.sin(elapsedTime * 6 + c * 0.08) * 7;
      fillRect('#fff', 690 + c, 34 + wv, 5, 76);
      fillRect('#e60026', 690 + c, 34 + wv, 5, 0);
    }
    context.fillStyle = '#e60026';
    context.beginPath();
    context.arc(745, 72 + Math.sin(elapsedTime * 6 + 0.55) * 7, 22, 0, 7);
    context.fill();
    fillRect('#111', 686, 24, 4, 100);
  }
  if (nightTransition > 0.02) {
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = 'rgba(70,80,180,' + nightTransition * 0.62 + ')';
    context.fillRect(0, 570, WORLD_WIDTH, 1045);
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = 'rgba(255,215,110,' + nightTransition * 0.5 + ')';
    for (const [a, b] of [
      [530, 1020],
      [770, 1225],
      [325, 1235],
      [200, 1200],
      [100, 1330],
    ]) {
      context.beginPath();
      context.arc(a, b, 80 + 8 * Math.sin(elapsedTime * 3 + a), 0, 7);
      context.fill();
    }
    context.globalCompositeOperation = 'source-over';
    fillRect('rgba(255,240,150,' + nightTransition * 0.5 + ')', pc.x + 200, pc.y + 70, 60, 22);
  }
  for (const p of parts) {
    p.x += p.vx * frameScale;
    p.y += p.vy * frameScale;
    p.vy += 0.5 * frameScale;
    p.l -= 1.5 * dt;
    fillRect(p.c, p.x, p.y, 10, 10);
  }
  parts = parts.filter((p) => p.l > 0);
  if (bub) {
    bub[3] -= dt;
    if (bub[3] <= 0) bub = null;
    else {
      context.font = '34px ' + FONT_FAMILY;
      context.textAlign = 'center';
      const w = context.measureText(bub[0]).width + 30;
      fillRect('#111', bub[1] - w / 2, bub[2] - 44, w, 50);
      fillRect('#c8f31d', bub[1] - w / 2 + 4, bub[2] - 40, w - 8, 42);
      context.fillStyle = '#111';
      context.fillText(bub[0], bub[1], bub[2] - 8);
    }
  }
  if (!isPlaying && Math.floor(elapsedTime * 6) % 2) {
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = 'rgba(255,255,255,.18)';
    context.fillRect(0, 0, WORLD_WIDTH, 570);
    context.globalCompositeOperation = 'source-over';
  }
  if (flash > 0) {
    context.fillStyle = 'rgba(255,255,255,' + flash + ')';
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    flash = Math.max(0, flash - 4.2 * dt);
  }
  marquee();
}

// ===== 店內小遊戲 =====
let currentScene = null,
  miniGame = {},
  bestScores = { A: 0, B: 0, C: 0 },
  transitioning = false;
const SKILL_NAMES = [
  '返鄉回血',
  '人來瘋暴走',
  '現金結界',
  '有求必應出圖',
  '高音吟唱',
  '牆角論破',
  '秒速分帳',
];
const SKILL_DESCRIPTIONS = [
  '時間 +5 秒',
  '商品暴增 4 秒',
  '4 秒內得分 ×3',
  '5 秒商品慢慢消失',
  '5 秒內不會出現賣完了',
  '全部商品一次收走',
  '得分 +25%',
];
const COFFEE_ORDERS = [
  '回血用，大杯！',
  '哪裡都好～冰的就好',
  '續命咖啡，謝謝',
  '雙份濃縮，越夜越強',
  '要有愛心形狀♥',
  '拉花要對稱，不然我論破',
  '分我一口，算你 1 円',
];
const COFFEE_REACTIONS = [
  '舒服！回血完成',
  '好喝！氣氛 +100',
  '現金結界展開，這杯我請',
  '圖馬上出！好喝',
  '高音吟唱：太棒了！',
  '論破失敗，完美',
  '秒速分帳：每人 1 円',
];
const COFFEE_MISS_REACTIONS = ['…有點歪喔', '還可以啦，下次加油', '我自己來好了'];
const HEART = [
  '.XX...XX.',
  'XXXX.XXXX',
  'XXXXXXXXX',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
  '....X....',
];
const ROUND_LABELS = ['普通', '窄一點', '區域會漂移', '雙區域！', 'Boss：忽快忽慢'];
function createMiniGame(k) {
  const cu = shuffled([0, 1, 2, 3, 4, 5, 6]).slice(0, 5);
  return {
    phase: 'ready',
    score: 0,
    combo: 0,
    time: 0,
    slots: [],
    cheer: [0, 0, 0, 0, 0, 0, 0],
    ready: [0, 0, 0, 0, 0, 0, 0],
    nextSkillIndex: 0,
    results: [],
    shake: 0,
    popups: [],
    cheerBubble: null,
    rush: 0,
    multiplier: 0,
    slow: 0,
    noSoldOut: 0,
    round: 0,
    spawn: 0,
    customers: cu,
    say: null,
    lives: 3,
    basketX: 443,
    targetX: null,
    items: [],
  };
}
function enterShop(k) {
  if (transitioning || currentScene) return;
  transitioning = true;
  coachNext(3);
  getElement('fade').style.opacity = 1;
  setTimeout(() => {
    currentScene = k;
    clearTimeout(toast.t);
    getElement('toast').style.opacity = '0';
    canvas.classList.toggle('catching-drinks', k === 'C');
    miniGame = createMiniGame();
    setMusic('game');
    getElement('hud').style.display = 'none';
    getElement('say').style.display = 'none';
    draw(0);
    mgShow(false);
    getElement('mgq').style.display = 'block';
    getElement('fade').style.opacity = 0;
    transitioning = false;
  }, 400);
}
function leaveShop() {
  if (transitioning) return;
  transitioning = true;
  keys = {};
  getElement('fade').style.opacity = 1;
  setTimeout(() => {
    currentScene = null;
    canvas.classList.toggle('catching-drinks', false);
    setMusic('street');
    getElement('hud').style.display = 'flex';
    getElement('mg').style.display = 'none';
    getElement('mgq').style.display = 'none';
    getElement('fade').style.opacity = 0;
    transitioning = false;
  }, 400);
}
getElement('mgq').onclick = leaveShop;
function mgShow(end) {
  getElement('mg').style.display = 'flex';
  const hostIndex = { A: 2, B: 6, C: 1 }[currentScene];
  getElement('mgp').src = assets.sprites[hostIndex].src;
  getElement('mgp').alt = characters[hostIndex].name;
  getElement('mgt').textContent = {
    A: '雜貨店・搶購限定品',
    B: '喫茶店・完美拉花',
    C: '販賣機・接住汽水',
  }[currentScene];
  getElement('mgd').innerHTML = end
    ? ''
    : {
        A: '貨架冒出商品，快點它放進購物籃！<br>🌟 +5 分　🚫賣完了＝千萬別點<br><b style="color:#c8f31d">連擊 5 次</b>會解鎖團員技能，點下方發亮的團員放大招！限時 30 秒',
        B: '指針來回跑，在<b style="color:#c8f31d">綠色區域</b>按下去倒奶泡！<br>5 位客人、5 種難度，越準愛心越漂亮。',
        C: '左右拖曳籃子，接住掉下來的飲料！<br>🌟 +5 分　💣 會扣一顆心（共 3 顆）<br>限時 30 秒，越後面掉越快',
      }[currentScene];
  getElement('mgr').innerHTML = end ? miniGame.resultHtml : '';
  getElement('mgs').textContent = end ? '再玩一次 ▶' : 'START ▶';
}
getElement('mgs').onclick = () => {
  getElement('mg').style.display = 'none';
  const k = currentScene;
  miniGame = createMiniGame();
  miniGame.phase = 'play';
  if (k === 'B') newRound();
  playSound(660, 0.12);
};
function newRound() {
  const r = miniGame.round;
  miniGame.roundPhase = 'aim';
  miniGame.roundTime = 0;
  miniGame.pointerTravel = 0;
  miniGame.zoneCenter = 0.25 + Math.random() * 0.5;
  miniGame.zoneWidth = [0.22, 0.17, 0.16, 0.15, 0.1][r];
  miniGame.pointerSpeed = [0.5, 0.66, 0.7, 0.8, 0.95][r];
  miniGame.pointerPosition = 0;
  miniGame.wait = 0;
  miniGame.say = null;
  zones();
}
function zones() {
  const r = miniGame.round;
  let c = miniGame.zoneCenter;
  if (r === 2) c = miniGame.zoneCenter + 0.13 * Math.sin(miniGame.roundTime * 2.2);
  miniGame.zones = [{ c, w: miniGame.zoneWidth, p: 1 }];
  if (r === 3)
    miniGame.zones.push({ c: 1 - miniGame.zoneCenter, w: miniGame.zoneWidth * 1.3, p: 0 });
}
function cheer(i, txt) {
  miniGame.cheer[i] = 1;
  miniGame.cheerBubble = { i, txt, t: 1 };
}
function endGame() {
  miniGame.phase = 'end';
  const s = miniGame.score;
  bestScores[currentScene] = Math.max(bestScores[currentScene], s);
  saveProgress();
  const RK = {
    A: [
      [60, '搶購之神'],
      [38, '掃貨達人'],
      [18, '逛街新手'],
      [0, '還在看價格'],
    ],
    B: [
      [13, '拉花大師'],
      [8, '人氣店員'],
      [0, '見習生'],
    ],
    C: [
      [45, '販賣機之神'],
      [28, '補貨達人'],
      [14, '路過的客人'],
      [0, '手滑新手'],
    ],
  };
  const r = RK[currentScene].find((a) => s >= a[0])[1];
  miniGame.resultHtml =
    (currentScene === 'B' ? '得分 ' + s + ' / 15' : '得分 ' + s) +
    '<br>稱號：' +
    r +
    '<br><span style="font-size:3.6cqw;color:#fff">最高紀錄 ' +
    bestScores[currentScene] +
    '</span>';
  newsItems.unshift(
    { A: '雜貨店搶購 ', B: '喫茶店拉花 ', C: '販賣機接汽水 ' }[currentScene] +
      s +
      ' 分「' +
      r +
      '」',
  );
  newsItems = newsItems.slice(0, 3);
  playSound(880, 0.3, 'triangle', 0.07);
  burst(443, 900, ['#ffe600', '#fff', '#ff2e93'], 60, 30);
  mgShow(true);
}
function grant() {
  for (let k = 0; k < 7; k++) {
    const i = (miniGame.nextSkillIndex + k) % 7;
    if (!miniGame.ready[i]) {
      miniGame.ready[i] = 1;
      miniGame.nextSkillIndex = (i + 1) % 7;
      miniGame.popups.push({
        x: 443,
        y: 430,
        t: 0,
        s: '技能：' + SKILL_NAMES[i],
        c: '#c8f31d',
        f: 40,
      });
      playSound(1200, 0.12, 'triangle', 0.06);
      return;
    }
  }
}
function useSkill(i) {
  miniGame.ready[i] = 0;
  cheer(i, SKILL_NAMES[i] + '！');
  playSound(1000, 0.35, 'triangle', 0.07, 1600);
  burst(443, 900, ['#ffe600', '#fff', '#c8f31d'], 40, 24);
  miniGame.popups.push({ x: 443, y: 430, t: 0, s: SKILL_DESCRIPTIONS[i], c: '#ffe600', f: 40 });
  if (i === 0) miniGame.time = Math.max(0, miniGame.time - 5);
  else if (i === 1) miniGame.rush = 4;
  else if (i === 2) miniGame.multiplier = 4;
  else if (i === 3) miniGame.slow = 5;
  else if (i === 4) {
    miniGame.noSoldOut = 5;
    for (let k = 0; k < 9; k++)
      if (miniGame.slots[k] && miniGame.slots[k].k === 'bad') miniGame.slots[k] = null;
  } else if (i === 5) {
    for (let k = 0; k < 9; k++) {
      const s = miniGame.slots[k];
      if (s && s.k !== 'bad') {
        miniGame.score += s.k === 'gold' ? 5 : 1;
        miniGame.slots[k] = null;
        miniGame.popups.push({
          x: 80 + (k % 3) * 243 + 115,
          y: 500 + ((k / 3) | 0) * 245 + 60,
          t: 0,
          s: '+' + (s.k === 'gold' ? 5 : 1),
          c: '#fff',
        });
      } else if (s) miniGame.slots[k] = null;
    }
  } else if (i === 6) {
    const a = Math.ceil(miniGame.score * 0.25);
    miniGame.score += a;
  }
}
function sceneStep(dt) {
  if (dialogueTime > 0) {
    dialogueTime -= dt;
    if (dialogueTime <= 0) getElement('say').style.display = 'none';
  }
  for (let i = 0; i < 7; i++)
    if (miniGame.cheer[i] > 0) miniGame.cheer[i] = Math.max(0, miniGame.cheer[i] - dt * 2.4);
  if (miniGame.cheerBubble) {
    miniGame.cheerBubble.t -= dt * 1.4;
    if (miniGame.cheerBubble.t <= 0) miniGame.cheerBubble = null;
  }
  miniGame.popups = miniGame.popups.filter((p) => (p.t += dt) < (p.f ? 1.4 : 0.8));
  if (miniGame.shake > 0) miniGame.shake -= dt;

  if (miniGame.phase !== 'play') return;
  if (currentScene === 'C') return stepC(dt);
  if (currentScene === 'A') {
    miniGame.time += dt;
    if (miniGame.time >= 30) return endGame();
    for (const k of ['rush', 'mult', 'slow', 'noBad']) if (miniGame[k] > 0) miniGame[k] -= dt;
    miniGame.spawn -= dt;
    if (miniGame.spawn <= 0) {
      miniGame.spawn = Math.max(0.3, 0.78 - miniGame.time * 0.015) * (miniGame.rush > 0 ? 0.42 : 1);
      const free = [...Array(9).keys()].filter((i) => !miniGame.slots[i]);
      if (free.length) {
        const i = free[(Math.random() * free.length) | 0],
          r = Math.random();
        miniGame.slots[i] = {
          k: r < 0.12 ? 'gold' : r < 0.3 && miniGame.noSoldOut <= 0 ? 'bad' : 'good',
          e: ['🐱', '🍵', '🧧', '🐼', '🧸'][(Math.random() * 5) | 0],
          t: 0,
          d: Math.max(0.75, 1.6 - miniGame.time * 0.022),
        };
      }
    }
    for (let i = 0; i < 9; i++) {
      const s = miniGame.slots[i];
      if (s) {
        s.t += dt * (miniGame.slow > 0 ? 0.5 : 1);
        if (s.t > s.d) {
          if (s.k === 'good') miniGame.combo = 0;
          miniGame.slots[i] = null;
        }
      }
    }
  } else if (miniGame.roundPhase === 'aim') {
    miniGame.roundTime += dt;
    miniGame.pointerTravel +=
      dt *
      miniGame.pointerSpeed *
      (miniGame.round === 4 ? 1 + 0.7 * Math.sin(miniGame.roundTime * 3.2) : 1);
    miniGame.pointerPosition = Math.abs((((miniGame.pointerTravel % 2) + 2) % 2) - 1);
    zones();
  } else {
    miniGame.wait -= dt;
    if (miniGame.wait <= 0) {
      miniGame.round++;
      if (miniGame.round >= 5) endGame();
      else newRound();
    }
  }
}
// Seven equal-width slots keep the last character inside the poster.
const crowdCenterX = (index) => (WORLD_WIDTH * (index + 0.5)) / characters.length;
function crowdRect(i) {
  const o = assets.sprites[i],
    s = 0.58;
  return [crowdCenterX(i) - (o.w * s) / 2, 1592 - o.h * s, o.w * s, o.h * s];
}
function sceneTap(px, py) {
  if (miniGame.phase === 'play' || miniGame.phase === 'ready')
    for (let i = 0; i < 7; i++) {
      const r = crowdRect(i);
      if (px > r[0] && px < r[0] + r[2] && py > r[1] && py < r[1] + r[3]) {
        if (miniGame.phase === 'play' && currentScene === 'A' && miniGame.ready[i]) useSkill(i);
        else {
          miniGame.cheer[i] = 1;
          playSound(500 + i * 40, 0.08);
        }
        return;
      }
    }
  if (miniGame.phase !== 'play') return;
  if (currentScene === 'C') {
    miniGame.targetX = px;
    return;
  }
  if (currentScene === 'A') {
    for (let i = 0; i < 9; i++) {
      const x0 = 80 + (i % 3) * 243,
        y0 = 500 + ((i / 3) | 0) * 245,
        s = miniGame.slots[i];
      if (s && px > x0 && px < x0 + 230 && py > y0 && py < y0 + 230) {
        miniGame.slots[i] = null;
        const m = (Math.random() * 7) | 0;
        if (s.k === 'bad') {
          miniGame.score = Math.max(0, miniGame.score - 3);
          miniGame.time += 2;
          miniGame.combo = 0;
          miniGame.shake = 0.3;
          playSound(130, 0.25, 'sawtooth', 0.07);
          miniGame.popups.push({ x: x0 + 115, y: y0 + 60, t: 0, s: '-3', c: '#ff2e93' });
        } else {
          const add =
            (s.k === 'gold' ? 5 : 1 + (miniGame.combo >= 3 ? 1 : 0)) *
            (miniGame.multiplier > 0 ? 3 : 1);
          miniGame.score += add;
          miniGame.combo++;
          playSound(600 + Math.min(miniGame.combo, 10) * 60, 0.1, 'triangle', 0.06);
          miniGame.popups.push({
            x: x0 + 115,
            y: y0 + 60,
            t: 0,
            s: '+' + add,
            c: s.k === 'gold' ? '#ffe600' : '#fff',
          });
          if (miniGame.combo % 5 === 0) grant();
          else if (miniGame.combo % 4 === 0)
            cheer(m, ['哇！', '好快！', '連擊！'][(Math.random() * 3) | 0]);
          else miniGame.cheer[m] = 1;
        }
        return;
      }
    }
  } else if (miniGame.roundPhase === 'aim') {
    let q = 'm';
    for (const z of miniGame.zones) {
      const d = Math.abs(miniGame.pointerPosition - z.c);
      if (d < z.w * 0.25 && z.p) {
        q = 'p';
        break;
      }
      if (d < z.w * 0.5 && q !== 'p') q = 'g';
    }
    miniGame.results.push(q);
    miniGame.quality = q;
    miniGame.score += { p: 3, g: 1, m: 0 }[q];
    miniGame.roundPhase = 'show';
    miniGame.wait = 1.3;
    const ci = miniGame.customers[miniGame.round];
    miniGame.say =
      q === 'p'
        ? COFFEE_REACTIONS[ci]
        : q === 'g'
          ? '還不錯，謝謝！'
          : COFFEE_MISS_REACTIONS[(Math.random() * 3) | 0];
    playSound(
      q === 'p' ? 1000 : q === 'g' ? 700 : 200,
      0.15,
      q === 'm' ? 'sawtooth' : 'triangle',
      0.06,
    );
    if (q === 'p') {
      cheer(ci, characters[ci].name + '：太棒了！');
      burst(443, 780, ['#ffe6ee', '#ff2e93', '#fff'], 30, 22);
    } else miniGame.cheer[ci] = 1;
  }
}
function crowd() {
  for (let i = 0; i < 7; i++) {
    const o = assets.sprites[i],
      s = 0.58,
      bx = crowdCenterX(i) - 60,
      by = 1592,
      k = miniGame.cheer[i],
      J =
        (k > 0 ? Math.sin((1 - k) * Math.PI) * 60 : 0) +
        (miniGame.ready[i] ? Math.abs(Math.sin(elapsedTime * 8)) * 18 : 0),
      b = Math.abs(Math.sin(elapsedTime * 3 + i)) * 3;
    sprite(
      characterImages[i],
      o,
      bx + 60,
      by - J - b,
      s,
      s,
      Math.sin(elapsedTime * 3 + i) * 0.02,
      1,
    );
    if (miniGame.ready[i]) {
      const yy = by - o.h * s - J - 30;
      fillRect('#111', bx + 30, yy - 34, 60, 50);
      fillRect('#ffe600', bx + 34, yy - 30, 52, 42);
      context.font = '40px ' + FONT_FAMILY;
      context.textAlign = 'center';
      context.fillStyle = '#111';
      context.fillText('技能!', bx + 60, yy + 2);
    }
  }
  if (miniGame.cheerBubble) {
    const b = miniGame.cheerBubble,
      bx = crowdCenterX(b.i);
    context.font = '30px ' + FONT_FAMILY;
    context.textAlign = 'center';
    const w = context.measureText(b.txt).width + 30;
    fillRect('#111', clamp(bx - w / 2, 4, WORLD_WIDTH - w - 4), 1300, w, 50);
    fillRect('#c8f31d', clamp(bx - w / 2, 4, WORLD_WIDTH - w - 4) + 4, 1304, w - 8, 42);
    context.fillStyle = '#111';
    context.fillText(b.txt, clamp(bx, w / 2 + 4, WORLD_WIDTH - w / 2 - 4), 1336);
  }
}
function sign(txt, bg) {
  fillRect('#111', 60, 50, 767, 150);
  fillRect(bg, 72, 62, 743, 126);
  context.fillStyle = '#111';
  context.font = '80px ' + FONT_FAMILY;
  context.textAlign = 'center';
  context.fillText(txt, 443, 148);
}
function pops() {
  for (const p of miniGame.popups) {
    const f = p.f || 70;
    context.font = f + 'px ' + FONT_FAMILY;
    context.textAlign = 'center';
    context.fillStyle = '#111';
    context.fillText(p.s, p.x + 3, p.y - p.t * (p.f ? 20 : 100) + 3);
    context.fillStyle = p.c;
    context.fillText(p.s, p.x, p.y - p.t * (p.f ? 20 : 100));
  }
}
function drawScene(dt) {
  const frameScale = dt * 60;
  context.save();
  if (miniGame.shake > 0) context.translate((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
  if (currentScene === 'A') drawA();
  else if (currentScene === 'C') drawC();
  else drawB();
  pops();
  context.restore();
  crowd();
  for (const p of parts) {
    p.x += p.vx * frameScale;
    p.y += p.vy * frameScale;
    p.vy += 0.5 * frameScale;
    p.l -= 1.5 * dt;
    fillRect(p.c, p.x, p.y, 10, 10);
  }
  parts = parts.filter((p) => p.l > 0);
  context.drawImage(
    backgroundImage,
    0,
    1612,
    WORLD_WIDTH,
    WORLD_HEIGHT - 1612,
    0,
    1612,
    WORLD_WIDTH,
    WORLD_HEIGHT - 1612,
  );
  marquee();
}
function pcard(a, b, w, h, f) {
  fillRect('#111', a + 8, b + 8, w, h);
  fillRect('#111', a - 5, b - 5, w + 10, h + 10);
  fillRect(f, a, b, w, h);
}
function bunting(y, cols) {
  for (let i = 0; i < 16; i++) {
    const cx = 26 + i * 56;
    context.fillStyle = cols[i % cols.length];
    context.beginPath();
    context.moveTo(cx - 24, y + 4);
    context.lineTo(cx + 24, y + 4);
    context.lineTo(cx, y + 50 + Math.sin(elapsedTime * 3 + i) * 3);
    context.closePath();
    context.fill();
    context.strokeStyle = '#111';
    context.lineWidth = 4;
    context.stroke();
  }
  fillRect('#111', 0, y, WORLD_WIDTH, 8);
}
function clock(cx, cy, fr, tx) {
  context.fillStyle = '#111';
  context.beginPath();
  context.arc(cx, cy, 64, 0, 7);
  context.fill();
  context.fillStyle = '#fff';
  context.beginPath();
  context.arc(cx, cy, 53, 0, 7);
  context.fill();
  context.fillStyle = fr < 0.25 ? '#ff2e93' : '#c8f31d';
  context.beginPath();
  context.moveTo(cx, cy);
  context.arc(cx, cy, 53, -Math.PI / 2, -Math.PI / 2 + fr * Math.PI * 2);
  context.closePath();
  context.fill();
  context.fillStyle = '#111';
  context.font = '42px ' + FONT_FAMILY;
  context.textAlign = 'center';
  context.fillText(tx, cx, cy + 15);
}
function drawA() {
  fillRect('#fff0c8', 0, 0, WORLD_WIDTH, 1612);
  for (let i = 0; i < WORLD_WIDTH; i += 74) fillRect('#ffe6a6', i, 0, 37, 1250);
  fillRect('#c98b4a', 0, 1250, WORLD_WIDTH, 362);
  for (let i = 0; i < WORLD_WIDTH; i += 80) fillRect('rgba(0,0,0,.12)', i, 1250, 6, 362);
  fillRect('#5a3510', 0, 1244, WORLD_WIDTH, 12);
  bunting(0, ['#ff2e93', '#c8f31d', '#ffe600', '#1e5bff']);
  pcard(150, 80, 587, 112, '#c8f31d');
  context.fillStyle = '#111';
  context.font = '70px ' + FONT_FAMILY;
  context.textAlign = 'center';
  context.fillText('ZAKKA 雜貨店', 443, 160);
  pcard(60, 235, 290, 100, '#111');
  context.fillStyle = '#fff';
  context.font = '26px ' + FONT_FAMILY;
  context.textAlign = 'left';
  context.fillText('SCORE', 80, 268);
  context.fillStyle = '#c8f31d';
  context.font = '64px ' + FONT_FAMILY;
  context.fillText(String(miniGame.score).padStart(3, '0'), 80, 322);
  pcard(537, 235, 290, 100, '#111');
  context.fillStyle = '#fff';
  context.font = '26px ' + FONT_FAMILY;
  context.fillText('COMBO', 557, 268);
  context.fillStyle = miniGame.combo >= 5 ? '#ffe600' : '#ff7cc0';
  context.font = '64px ' + FONT_FAMILY;
  context.fillText('×' + miniGame.combo, 557, 322);
  clock(
    443,
    285,
    miniGame.phase === 'play' ? Math.max(0, 1 - miniGame.time / 30) : 1,
    String(Math.max(0, Math.ceil(30 - (miniGame.time || 0)))),
  );
  // buffs
  const bf = [];
  if (miniGame.rush > 0) bf.push(['暴走 ' + Math.ceil(miniGame.rush), '#ffe600']);
  if (miniGame.multiplier > 0) bf.push(['得分×3 ' + Math.ceil(miniGame.multiplier), '#ff7cc0']);
  if (miniGame.slow > 0) bf.push(['慢動作 ' + Math.ceil(miniGame.slow), '#8fd0ff']);
  if (miniGame.noSoldOut > 0) bf.push(['無地雷 ' + Math.ceil(miniGame.noSoldOut), '#c8f31d']);
  if (!bf.length && miniGame.phase === 'play') {
    context.fillStyle = '#7a4a22';
    context.font = '34px ' + FONT_FAMILY;
    context.textAlign = 'center';
    context.fillText('連擊 5 次 → 解鎖團員技能（點下方發亮的團員）', 443, 395);
  }
  bf.forEach((b, i) => {
    const bx = 443 - bf.length * 95 + i * 190 + 10;
    fillRect('#111', bx, 360, 170, 50);
    fillRect(b[1], bx + 4, 364, 162, 42);
    context.fillStyle = '#111';
    context.font = '30px ' + FONT_FAMILY;
    context.textAlign = 'center';
    context.fillText(b[0], bx + 85, 396);
  });
  // shelf
  fillRect('#111', 44, 434, 799, 822);
  fillRect('#8a5a2b', 50, 440, 787, 810);
  fillRect('#6e431c', 50, 440, 787, 18);
  for (let i = 0; i < 9; i++) {
    const x0 = 80 + (i % 3) * 243,
      y0 = 500 + ((i / 3) | 0) * 245;
    fillRect('#d9bd7e', x0, y0, 230, 230);
    fillRect('#fff3d0', x0 + 8, y0 + 10, 214, 204);
    fillRect('#ecd9a4', x0 + 8, y0 + 10, 214, 22);
    fillRect('#a8743a', x0, y0 + 214, 230, 16);
    fillRect('#5a3510', x0, y0 + 226, 230, 4);
    const s = miniGame.slots[i];
    if (s) {
      context.save();
      context.beginPath();
      context.rect(x0 + 8, y0 + 10, 214, 204);
      context.clip();
      const u = Math.min(1, s.t / 0.14),
        fo = s.d - s.t < 0.25 ? (s.d - s.t) / 0.25 : 1;
      context.globalAlpha = Math.max(0, fo);
      const oy = (1 - u) * 170;
      if (s.k === 'bad') {
        fillRect('#111', x0 + 34, y0 + 70 + oy, 162, 110);
        fillRect('#e0324a', x0 + 40, y0 + 76 + oy, 150, 98);
        context.fillStyle = '#fff';
        context.font = '46px ' + FONT_FAMILY;
        context.textAlign = 'center';
        context.fillText('賣完了', x0 + 115, y0 + 140 + oy);
        fillRect('#fff', x0 + 44, y0 + 84 + oy, 142, 4);
      } else {
        context.fillStyle = 'rgba(255,255,255,.9)';
        context.beginPath();
        context.arc(x0 + 115, y0 + 130 + oy, 74, 0, 7);
        context.fill();
        if (s.k === 'gold') {
          context.strokeStyle = '#ffe600';
          context.lineWidth = 10;
          context.beginPath();
          context.arc(x0 + 115, y0 + 130 + oy, 70 + Math.sin(elapsedTime * 12) * 5, 0, 7);
          context.stroke();
        }
        context.font = '104px serif';
        context.textAlign = 'center';
        context.fillStyle = '#111';
        context.fillText(s.k === 'gold' ? '🌟' : s.e, x0 + 115, y0 + 165 + oy);
      }
      context.restore();
    }
  }
  fillRect('#111', 0, 1244, WORLD_WIDTH, 6);
}
function art(q, cx, cy, perspectiveScale) {
  if (q === 'p') {
    const c = 22 * perspectiveScale;
    for (let r = 0; r < 8; r++)
      for (let k = 0; k < 9; k++)
        if (HEART[r][k] === 'X')
          fillRect('#ffe6ee', cx - 4.5 * c + k * c, cy - 4 * c + r * c, c + 1, c + 1);
  } else if (q === 'g') {
    for (let i = 0; i < 7; i++) {
      const w = (4 - Math.abs(i - 3)) * 26 * perspectiveScale;
      fillRect(
        '#fff3dc',
        cx - w,
        cy - 80 * perspectiveScale + i * 28 * perspectiveScale,
        w * 2,
        22 * perspectiveScale,
      );
    }
    fillRect(
      '#9a6a3a',
      cx - 3 * perspectiveScale,
      cy - 90 * perspectiveScale,
      6 * perspectiveScale,
      190 * perspectiveScale,
    );
  } else {
    for (const [a, b, r] of [
      [-30, -20, 60],
      [30, 10, 50],
      [-10, 50, 44],
      [40, -40, 34],
    ]) {
      context.fillStyle = '#fff3dc';
      context.beginPath();
      context.arc(cx + a * perspectiveScale, cy + b * perspectiveScale, r * perspectiveScale, 0, 7);
      context.fill();
    }
  }
}
function wrapPx(s, mw) {
  const o = [];
  let l = '';
  for (const ch of s) {
    if (context.measureText(l + ch).width > mw) {
      o.push(l);
      l = ch;
    } else l += ch;
  }
  if (l) o.push(l);
  return o;
}

function drawB() {
  fillRect('#4a2c1a', 0, 0, WORLD_WIDTH, 1612);
  for (let i = 0; i < WORLD_WIDTH; i += 74) {
    fillRect('#3f2616', i, 0, 4, 1180);
    fillRect('#57341f', i + 40, 0, 3, 1180);
  }
  for (const lx of [70, 817]) {
    fillRect('#111', lx - 2, 0, 4, 170);
    context.fillStyle = '#ffe9a0';
    context.beginPath();
    context.arc(lx, 200, 38, Math.PI, 0);
    context.fill();
    fillRect('#111', lx - 40, 198, 80, 7);
    context.globalAlpha = 0.16 + 0.06 * Math.sin(elapsedTime * 3 + lx);
    context.fillStyle = '#ffe9a0';
    context.beginPath();
    context.arc(lx, 215, 120, 0, 7);
    context.fill();
    context.globalAlpha = 1;
  }
  pcard(160, 50, 567, 108, '#ffe600');
  context.fillStyle = '#111';
  context.font = '62px ' + FONT_FAMILY;
  context.textAlign = 'center';
  context.fillText('喫茶 ・ 本日拉花', 443, 126);
  pcard(60, 225, 767, 120, '#2b1a10');
  for (let i = 0; i < 5; i++) {
    const cx = 60 + (767 * (i + 0.5)) / 5,
      cy = 285;
    context.fillStyle =
      i === Math.min(4, miniGame.round || 0) && miniGame.phase === 'play' ? '#ffe600' : '#fff';
    context.beginPath();
    context.arc(cx, cy, 46, 0, 7);
    context.fill();
    context.fillStyle = '#9a6a3a';
    context.beginPath();
    context.arc(cx, cy, 36, 0, 7);
    context.fill();
    if (miniGame.results[i]) art(miniGame.results[i], cx, cy, 0.4);
    else {
      context.fillStyle = 'rgba(255,255,255,.55)';
      context.font = '34px ' + FONT_FAMILY;
      context.textAlign = 'center';
      context.fillText(i + 1, cx, cy + 11);
    }
  }
  fillRect('#7a4a22', 0, 1180, WORLD_WIDTH, 432);
  for (let i = 0; i < WORLD_WIDTH; i += 70) fillRect('rgba(0,0,0,.14)', i, 1196, 5, 416);
  fillRect('#5a3510', 0, 1172, WORLD_WIDTH, 16);
  fillRect('#111', 0, 1188, WORLD_WIDTH, 5);
  const cx = 320,
    cy = 760;
  context.fillStyle = 'rgba(0,0,0,.3)';
  context.beginPath();
  context.arc(cx, cy + 24, 232, 0, 7);
  context.fill();
  context.fillStyle = '#fff';
  context.beginPath();
  context.arc(cx, cy, 225, 0, 7);
  context.fill();
  context.strokeStyle = '#111';
  context.lineWidth = 8;
  context.stroke();
  fillRect('#fff', cx + 150, cy - 30, 92, 60);
  fillRect('#111', cx + 240, cy - 30, 7, 60);
  context.fillStyle = '#f6f1e3';
  context.beginPath();
  context.arc(cx, cy, 178, 0, 7);
  context.fill();
  context.stroke();
  context.fillStyle = '#9a6a3a';
  context.beginPath();
  context.arc(cx, cy, 144, 0, 7);
  context.fill();
  if (miniGame.phase === 'play' && miniGame.roundPhase === 'show')
    art(miniGame.quality, cx, cy, 1.25);
  else
    for (let i = 0; i < 3; i++)
      fillRect(
        'rgba(255,255,255,.35)',
        cx - 20 + Math.sin(elapsedTime * 2 + i) * 26,
        cy - 200 - ((elapsedTime * 50 + i * 60) % 110),
        9,
        36,
      );
  const ci = miniGame.customers[Math.min(miniGame.round || 0, 4)];
  if (miniGame.phase !== 'end') {
    const o = assets.sprites[ci],
      b = Math.abs(Math.sin(elapsedTime * 3)) * 6;
    sprite(characterImages[ci], o, 795, 1150 - b, 0.8, 0.8, 0, -1);
    const tx =
      miniGame.phase === 'play' && miniGame.roundPhase === 'show'
        ? miniGame.say
        : COFFEE_ORDERS[ci];
    context.font = '28px ' + FONT_FAMILY;
    const L = wrapPx(tx, 260),
      bw = 300,
      bh = L.length * 36 + 28,
      bx0 = 570,
      by0 = 968 - bh;
    pcard(bx0, by0, bw, bh, '#fff');
    context.fillStyle = '#111';
    context.textAlign = 'left';
    L.forEach((l, k) => context.fillText(l, bx0 + 16, by0 + 40 + k * 36));
    fillRect('#111', bx0 + 206, 970, 26, 20);
    fillRect('#fff', bx0 + 210, 962, 18, 24);
    fillRect('#111', 556, 1098, 200, 48);
    fillRect('#ffe600', 560, 1102, 192, 40);
    context.fillStyle = '#111';
    context.font = '26px ' + FONT_FAMILY;
    context.textAlign = 'center';
    context.fillText('客人：' + characters[ci].name, 656, 1131);
  }
  if (miniGame.phase === 'play' || miniGame.phase === 'ready') {
    context.fillStyle = '#ffe600';
    context.font = '34px ' + FONT_FAMILY;
    context.textAlign = 'left';
    context.fillText(
      '第 ' +
        Math.min(5, (miniGame.round || 0) + 1) +
        ' / 5 杯　' +
        ROUND_LABELS[Math.min(4, miniGame.round || 0)],
      90,
      1244,
    );
    pcard(80, 1275, 727, 118, '#111');
    fillRect('#2b1a10', 92, 1287, 703, 94);
    for (let k = 0; k <= 10; k++) fillRect('#7a5a3a', 92 + k * 70.3, 1371, 3, 10);
    const zs = miniGame.zones || [{ c: 0.5, w: 0.2, p: 1 }];
    for (const z of zs) {
      fillRect('#3d8f5c', 100 + (z.c - z.w / 2) * 687, 1292, z.w * 687, 66);
      if (z.p) fillRect('#c8f31d', 100 + (z.c - z.w / 4) * 687, 1292, (z.w * 687) / 2, 66);
    }
    const pos = miniGame.pointerPosition || 0;
    fillRect('#111', 100 + pos * 687 - 13, 1266, 26, 142);
    fillRect('#ff2e93', 100 + pos * 687 - 8, 1271, 16, 132);
    context.fillStyle = '#fff';
    context.font = '50px ' + FONT_FAMILY;
    context.textAlign = 'center';
    context.fillText(
      miniGame.phase === 'play' && miniGame.roundPhase === 'aim'
        ? Math.floor(elapsedTime * 4) % 2
          ? 'TAP！'
          : '　'
        : miniGame.phase === 'play'
          ? { p: 'PERFECT ♥', g: 'GOOD', m: 'MISS…' }[miniGame.quality]
          : '點 START 開始',
      443,
      1460,
    );
  }
}

// ===== 手帳 / 引導 / 載入 / 結局 =====
const SECRET_HINTS = {
  東京招牌: '左邊的黑色大招牌',
  東京鐵塔: '粉紅色的高塔',
  富士山: '城市後面的白色山頂',
  太陽: '天空的粉紅大圓',
  山手線: '高架上跑的電車',
  カメラ招牌: '粉紅色的相機招牌',
  本: '粉紅色的「本」',
  茶招牌: '小小的粉紅「茶」',
  TOKYO: '右邊藍色直立招牌',
  吉姆尼: '馬路上的綠色小車',
  販賣機: '左下角粉紅色機器',
  雜貨店: '左邊的玻璃屋',
  喫茶店: '右邊的粉紅雨棚',
  J彩蛋: '大標題的「J」',
  P彩蛋: '大標題的「P」',
  '30+彩蛋': '大標題的「30+」',
};
let bookTab = 0,
  coachS = -1;
const COACH_MESSAGES = [
  '👆 點一下地面，團員一起出發！',
  '✨ 點閃閃發光的地方，發現秘密',
  '💬 點團員，看他們的冒險檔案',
  '🛍 走到雜貨店或喫茶店，玩小遊戲',
  '📖 點左上「手帳」看收集進度',
];
let coachUntil = 0;
function coachSet(i) {
  coachS = i;
  if (i < 0 || i >= COACH_MESSAGES.length) {
    coachUntil = 0;
    return;
  }
  getElement('coach').textContent = COACH_MESSAGES[i];
  coachUntil = performance.now() + 7000;
}
function coachTick() {
  const c = getElement('coach'),
    blk =
      currentScene ||
      ['ov', 'bk', 'endv', 'load'].some(
        (k) =>
          getElement(k).style.display === 'flex' ||
          (k === 'load' && getElement(k).style.display !== 'none'),
      );
  c.style.display =
    !blk && coachS >= 0 && coachS < COACH_MESSAGES.length && performance.now() < coachUntil
      ? 'block'
      : 'none';
}
function coachNext(f) {
  if (coachS === f) coachSet(f + 1);
}
function renderBook() {
  const b = getElement('bkb');
  getElement('bkd').textContent =
    '📅 今日行程：' + DAYS[currentDay] + '　（每發現 3 個秘密，前進一天）';
  document
    .querySelectorAll('#tabs button')
    .forEach((e, i) => e.classList.toggle('on', i === bookTab));
  if (bookTab === 0)
    b.innerHTML =
      '<div class="gr">' +
      hotspots
        .map((h) =>
          foundSecrets.has(h.id)
            ? '<div class="it f">✓ ' + h.id + '</div>'
            : '<div class="it">？ ' + (SECRET_HINTS[h.id] || '') + '</div>',
        )
        .join('') +
      '</div>';
  else if (bookTab === 1)
    b.innerHTML =
      '<div class="cg">' +
      characters
        .map(
          (c, i) =>
            '<button class="cb' +
            (metCharacters.has(i) ? ' m' : '') +
            '" data-i="' +
            i +
            '"><img src="' +
            assets.sprites[i].src +
            '"><span>' +
            (metCharacters.has(i) ? c.name : '？？？') +
            '</span></button>',
        )
        .join('') +
      '</div>';
  else if (bookTab === 2)
    b.innerHTML =
      '<div class="gm">🛍 雜貨店・搶購限定品<br>最高紀錄：<b>' +
      bestScores.A +
      '</b> 分<hr>☕ 喫茶店・完美拉花<br>最高紀錄：<b>' +
      bestScores.B +
      '</b> / 15<hr>🥤 販賣機・接住汽水<br>最高紀錄：<b>' +
      bestScores.C +
      '</b> 分<hr>走到店門口或販賣機就能玩！</div>';
  else {
    b.replaceChildren();
    const hint = document.createElement('p');
    hint.className = 'row';
    hint.textContent =
      '選擇探索地點，也能用鍵盤操作。雜貨店按 1–9 點貨架、Q–U 放技能，喫茶店按空白鍵倒奶泡，販賣機用左右鍵移動。';
    b.append(hint);
    const list = document.createElement('div');
    list.className = 'gr';
    hotspots.forEach((hotspot) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'explore-button';
      button.textContent = (foundSecrets.has(hotspot.id) ? '✓ ' : '') + hotspot.id;
      button.onclick = () => {
        getElement('bk').style.display = 'none';
        activateHotspot(hotspot);
      };
      list.append(button);
    });
    b.append(list);
  }
  b.querySelectorAll('.cb').forEach((e) => (e.onclick = () => card(+e.dataset.i)));
}
function openBook(i) {
  bookTab = i;
  getElement('bk').style.display = 'flex';
  renderBook();
  playSound(560, 0.05);
}
let resetConfirmationTimer;
getElement('reset').onclick = () => {
  const button = getElement('reset');
  if (button.dataset.confirm !== 'true') {
    button.dataset.confirm = 'true';
    button.textContent = '再按一次清除';
    clearTimeout(resetConfirmationTimer);
    resetConfirmationTimer = setTimeout(() => {
      button.dataset.confirm = '';
      button.textContent = '重新冒險';
    }, 3500);
    return;
  }
  clearTimeout(resetConfirmationTimer);
  button.dataset.confirm = '';
  button.textContent = '重新冒險';
  foundSecrets.clear();
  metCharacters.clear();
  bestScores = { A: 0, B: 0, C: 0 };
  currentDay = 0;
  card.done = false;
  newsItems = [];
  pendingHotspot = null;
  party.tx = null;
  party.gt = 1;
  getElement('h1').textContent = '0';
  getElement('h2').textContent = '0';
  saveProgress();
  renderBook();
  toast('新冒險開始，進度已清除！');
};
getElement('bk1').onclick = () => openBook(0);
getElement('bk2').onclick = () => openBook(1);
getElement('bk3').onclick = () => openBook(0);
document.querySelectorAll('#tabs button').forEach(
  (e, i) =>
    (e.onclick = () => {
      bookTab = i;
      renderBook();
      playSound(500, 0.04);
    }),
);
getElement('bkx').onclick = () => {
  getElement('bk').style.display = 'none';
  coachNext(4);
};
function showEnd(preview = false) {
  setMusic('end');
  burst(443, 1000, ['#ffe600', '#fff', '#ff2e93', '#c8f31d'], 160, 36);
  playSound(880, 0.5, 'triangle', 0.07, 1760);
  const ROLE = [
    ['唯一的 J', '主題曲：蔡依林的特務J'],
    ['氣氛組', '安靜是不可能的任務！'],
    ['總經理', '關鍵時刻，總經理說了算'],
    ['CAD 萬應公', '十項全能の小S君'],
    ['御守補給官', '本團指定精神復活充電器'],
    ['空間鑑定賢者', '慧不慧..有一天..時間真的能倒退...'],
    ['分帳精算師', '友情不計較，帳目沒煩惱兒'],
  ];
  const cast = characters
    .map(
      (character, index) =>
        `<div class="cast"><div class="cast-portrait"><img src="${assets.sprites[index].src}" alt="${character.name}"></div><div class="cast-copy"><b>${character.name}</b><small>${ROLE[index][0]}</small><span>${ROLE[index][1]}</span></div></div>`,
    )
    .join('');
  const itinerary = DAYS.map((day) => {
    const [date, place] = day.split(' ');
    return `<div class="itinerary-row"><span class="itinerary-date">${date}</span><span>${place}</span></div>`;
  }).join('');
  const records = [
    ['認識團員', `${metCharacters.size} / 7`],
    ['雜貨店搶購', `${bestScores.A} 分`],
    ['喫茶店拉花', `${bestScores.B} / 15`],
    ['販賣機接汽水', `${bestScores.C} 分`],
  ]
    .map(
      ([label, score]) =>
        `<div class="record-row"><span>${label}</span><span>${score}</span></div>`,
    )
    .join('');
  getElement('ecr').innerHTML =
    '<div class="big">ENDING</div><img class="t" width="887" height="592" alt="多P單J 東京冒險" src="' +
    assets.title +
    '">' +
    '<div class="etl">TOKYO QUEST</div><div class="etl2">THE REUNION EDITION</div><div class="etl3">11 YEARS IN THE MAKING.</div>' +
    '<h2>16 個秘密，全數解鎖！</h2>' +
    '<p class="ending-intro"><span class="ending-line">恭喜各位玩家，</span><span class="ending-line">成功完成東京冒險的行前測驗！</span></p>' +
    '<p class="boss"><span class="ending-line">真正的魔王任務——</span><span class="ending-line">七個女人一起出國，</span><span class="ending-line">現在才要開始 &lt;3</span></p>' +
    '<div class="sec">— CAST —</div>' +
    cast +
    '<div class="sec">— 這次的紀錄 —</div><div class="ending-records">' +
    records +
    '</div>' +
    '<div class="achv"><div class="ah">BONUS ACHIEVEMENTS UNLOCKED!</div><div class="ai">✓ 成功湊齊七個人的時間</div><div class="ai">✓ 友情存活超過 11 年</div><div class="ai">✓ 音量轟炸日本國你我有責</div></div>' +
    '<div class="sec">— 接下來 —</div><div class="ending-itinerary">' +
    itinerary +
    '</div><div class="credits-final"><div class="the">TO BE<br>CONTINUED…</div>' +
    '<p class="save"><span id="memory-save-label">回憶存檔中……</span><br><span id="memory-save-bar" aria-hidden="true">▮▮▮▮▮▮▮▯</span></p><p>歷時 11 年籌備。旅途平安，玩得開心。</p><p><b>大人になっても、旅は冒険だ。</b></p></div>';
  getElement('endv').dataset.preview = String(preview);
  getElement('endv').style.display = 'flex';
  getElement('endx').style.display = 'none';
  getElement('endpause').style.display = 'none';
  startCredits();
  clearTimeout(showEnd.controlsTimer);
  showEnd.controlsTimer = setTimeout(() => {
    getElement('endpause').style.display = 'block';
    getElement('endx').style.display = 'block';
  }, 3500);
}
function startCredits() {
  const credits = getElement('ecr'),
    viewport = getElement('ecw');
  credits.style.animation = 'none';
  credits.style.animationPlayState = 'running';
  getElement('endpause').dataset.finished = 'false';
  getElement('endpause').textContent = '暫停字幕';
  getElement('memory-save-label').textContent = '回憶存檔中……';
  getElement('memory-save-bar').textContent = '▮▮▮▮▮▮▮▯';
  viewport.scrollTop = 0;
  const stageWidth = canvas.getBoundingClientRect().width;
  const motion = creditsMotion(
    viewport.clientHeight || stageWidth * 2,
    credits.scrollHeight || stageWidth * 6,
    stageWidth,
  );
  credits.style.setProperty('--credits-from', (motion.from / stageWidth) * 100 + 'cqw');
  credits.style.setProperty('--credits-to', (motion.to / stageWidth) * 100 + 'cqw');
  void credits.offsetWidth;
  credits.style.animation = `credits-roll ${motion.duration}ms linear both`;
}
getElement('endpause').onclick = () => {
  const button = getElement('endpause'),
    credits = getElement('ecr');
  if (button.dataset.finished === 'true') {
    startCredits();
    return;
  }
  const paused = credits.style.animationPlayState === 'paused';
  credits.style.animationPlayState = paused ? 'running' : 'paused';
  button.textContent = paused ? '暫停字幕' : '播放字幕';
};
getElement('ecr').addEventListener('animationend', (event) => {
  if (event.animationName !== 'credits-roll') return;
  getElement('endpause').dataset.finished = 'true';
  getElement('endpause').textContent = '重播字幕';
  const saved = saveProgress();
  getElement('memory-save-label').textContent = saved ? '回憶存檔完成。' : '旅途平安，玩得開心。';
  getElement('memory-save-bar').textContent = '▮▮▮▮▮▮▮▮';
});
getElement('endx').onclick = () => {
  getElement('endv').style.display = 'none';
  clearTimeout(showEnd.controlsTimer);
  getElement('ecr').style.animation = 'none';
  setMusic('street');
  if (foundSecrets.size === hotspots.length) newsItems.unshift('★ 全部完成！旅は冒険だ。 ★');
};
getElement('skip').onclick = () => {
  const b = getElement('skip');
  if (b.dataset.c !== '1') {
    b.dataset.c = '1';
    b.textContent = '再點一次';
    clearTimeout(b.t);
    b.t = setTimeout(() => {
      b.dataset.c = '';
      b.textContent = '⏩ 結局';
    }, 2500);
    return;
  }
  b.dataset.c = '';
  b.textContent = '⏩ 結局';
  showEnd(true);
};
function renderSoundButton(enabled) {
  const button = getElement('snd');
  const speaker = 'M2 6h3V4h2V2h2v12H7v-2H5v-2H2z';
  const waves = 'M11 4h2v2h-2z M13 6h2v4h-2z M11 10h2v2h-2z';
  const cross = 'M11 5h1v1h1v1h1V6h1V5h1v2h-1v2h1v2h-1v-1h-1V9h-1v1h-1v1h-1V9h1V7h-1z';
  button.innerHTML = `<svg class="sound-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${speaker}"/><path d="${enabled ? waves : cross}"/></svg>`;
  button.setAttribute('aria-label', enabled ? '關閉聲音' : '開啟聲音');
  button.setAttribute('aria-pressed', String(enabled));
}
getElement('snd').onclick = () => {
  renderSoundButton(toggleSound());
  saveProgress();
};
// Loading presentation has its own clock; engine gameplay remains paused behind it.
getElement('lti').src = assets.title;
const LOADING_TIPS = [
  '點地面，團員會一起走。',
  '閃光的地方藏著秘密。',
  '點團員可以看冒險檔案。',
  '雜貨店和喫茶店有小遊戲。',
  '手帳可以查看收集進度。',
  '點太陽可以切換白天和夜晚。',
];
let loadT = 0,
  displayLoad = 0,
  loaderReady = false,
  loaderFailed = false;
const loaderStart = performance.now();
let loaderPrevious = loaderStart;
let loaderEntranceStart = null;
const reducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const loadingCharacters = assets.sprites.map((sprite) => {
  const image = document.createElement('img');
  image.src = sprite.src;
  image.alt = '';
  getElement('lrow').appendChild(image);
  return image;
});
function updateLoadProgress(progress) {
  const percent = Math.round(progress * 100);
  getElement('lfill').style.width = progress * 100 + '%';
  getElement('lpct').textContent = 'NOW LOADING… ' + percent + '%';
  getElement('lbar').setAttribute('aria-valuenow', String(percent));
}
function loaderFrame(now) {
  if (loaderFailed || getElement('load').style.display === 'none') return;
  const elapsed = (now - loaderStart) / 1000,
    dt = Math.min(0.1, Math.max(0, (now - loaderPrevious) / 1000));
  loaderPrevious = now;
  if (loaderReady && loaderEntranceStart === null) loaderEntranceStart = now;
  const entranceElapsed = loaderEntranceStart === null ? 0 : (now - loaderEntranceStart) / 1000;
  const target = Math.min(loadT, elapsed / 2.8);
  displayLoad += (target - displayLoad) * (1 - Math.exp(-9 * dt));
  if (loaderReady && entranceElapsed >= 2.8 && displayLoad > 0.99) displayLoad = 1;
  else displayLoad = Math.min(displayLoad, 0.99);
  updateLoadProgress(displayLoad);
  loadingCharacters.forEach((image, index) => {
    const pose = loadingPose(index, entranceElapsed, reducedMotion);
    image.style.left = pose.left + 'cqw';
    image.style.opacity = String(pose.opacity);
    image.style.transform = `translateY(${pose.bounce}cqw)`;
  });
  getElement('ltip').textContent = LOADING_TIPS[Math.floor(elapsed / 1.8) % LOADING_TIPS.length];
  if (displayLoad === 1 && loaderReady && getElement('lgo').style.visibility !== 'visible') {
    getElement('lgo').style.visibility = 'visible';
    getElement('lgo').setAttribute('aria-hidden', 'false');
  }
  requestAnimationFrame(loaderFrame);
}
requestAnimationFrame(loaderFrame);
getElement('lgo').onclick = () => {
  startMusic();
  isPlaying = 1;
  getElement('load').style.display = 'none';
  playSound(660, 0.12);
  resumeAudio();
  coachSet(0);
};

// ===== 小遊戲 C：販賣機接汽水 =====
function stepC(dt) {
  if (keys.arrowleft || keys.a) miniGame.targetX = miniGame.basketX - 450 * dt;
  if (keys.arrowright || keys.d) miniGame.targetX = miniGame.basketX + 450 * dt;
  miniGame.time += dt;
  if (miniGame.time >= 30 || miniGame.lives <= 0) return endGame();
  miniGame.basketX +=
    ((miniGame.targetX == null ? miniGame.basketX : miniGame.targetX) - miniGame.basketX) *
    Math.min(1, dt * 14);
  miniGame.basketX = clamp(miniGame.basketX, 95, 792);
  miniGame.spawn -= dt;
  if (miniGame.spawn <= 0) {
    miniGame.spawn = Math.max(0.26, 0.62 - miniGame.time * 0.012);
    const r = Math.random();
    miniGame.items.push({
      x: 110 + Math.random() * 667,
      y: 470,
      k: r < 0.1 ? 'gold' : r < 0.3 ? 'bad' : 'good',
      e: ['🥤', '🧃', '🍙', '🍡', '🍜'][(Math.random() * 5) | 0],
      v: 420 + miniGame.time * 10 + Math.random() * 80,
      d: 0,
    });
  }
  for (const it of miniGame.items) {
    it.y += it.v * dt;
    if (!it.d && it.y > 1300 && it.y < 1430 && Math.abs(it.x - miniGame.basketX) < 95) {
      it.d = 1;
      if (it.k === 'bad') {
        miniGame.lives--;
        miniGame.shake = 0.3;
        miniGame.combo = 0;
        playSound(130, 0.25, 'sawtooth', 0.07);
        miniGame.popups.push({ x: it.x, y: 1280, t: 0, s: '-♥', c: '#ff2e93' });
      } else {
        const add = it.k === 'gold' ? 5 : 1 + (miniGame.combo >= 5 ? 1 : 0);
        miniGame.score += add;
        miniGame.combo++;
        playSound(620 + Math.min(miniGame.combo, 12) * 50, 0.09, 'triangle', 0.06);
        miniGame.popups.push({
          x: it.x,
          y: 1280,
          t: 0,
          s: '+' + add,
          c: it.k === 'gold' ? '#ffe600' : '#fff',
        });
        if (miniGame.combo % 6 === 0) cheer((Math.random() * 7) | 0, '連續接住！');
      }
    } else if (!it.d && it.y > 1500) {
      it.d = 1;
      if (it.k !== 'bad') miniGame.combo = 0;
    }
  }
  miniGame.items = miniGame.items.filter((i) => i.y < 1520 && !i.d);
}
function drawC() {
  fillRect('#13246b', 0, 0, WORLD_WIDTH, 1612);
  for (let i = 0; i < 40; i++) fillRect('#fff', (i * 97) % 870, ((i * 53) % 420) + 20, 3, 3);
  for (let i = 0; i < 9; i++) {
    const bw = 70 + ((i * 37) % 50),
      bh = 120 + ((i * 71) % 160);
    fillRect('#0b1650', i * 100 - 10, 1440 - bh, bw, bh);
    for (let k = 0; k < 6; k++)
      fillRect('#ffe600', i * 100 + (k % 2) * 28, 1440 - bh + 20 + ((k / 2) | 0) * 34, 12, 16);
  }
  pcard(190, 50, 507, 390, '#ff4fa3');
  fillRect('#111', 215, 75, 457, 270);
  fillRect('#bfe8ff', 225, 85, 437, 250);
  const cols = ['#1e5bff', '#ffe600', '#c8f31d', '#ff2e93', '#fff'];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++) {
      fillRect('#111', 236 + c * 84, 98 + r * 78, 64, 70);
      fillRect(cols[(r + c) % 5], 240 + c * 84, 102 + r * 78, 56, 62);
      fillRect('#fff', 246 + c * 84, 108 + r * 78, 10, 24);
    }
  fillRect('#111', 280, 362, 327, 56);
  fillRect('#3a0a28', 288, 370, 311, 40);
  context.fillStyle = '#fff';
  context.font = '28px ' + FONT_FAMILY;
  context.textAlign = 'center';
  context.fillText('富士山汽水 ¥150', 443, 350);
  pcard(60, 515, 290, 92, '#111');
  context.fillStyle = '#fff';
  context.font = '24px ' + FONT_FAMILY;
  context.textAlign = 'left';
  context.fillText('SCORE', 78, 545);
  context.fillStyle = '#c8f31d';
  context.font = '54px ' + FONT_FAMILY;
  context.fillText(String(miniGame.score).padStart(3, '0'), 78, 592);
  pcard(537, 515, 290, 92, '#111');
  context.fillStyle = '#fff';
  context.font = '24px ' + FONT_FAMILY;
  context.fillText('LIFE', 555, 545);
  context.fillStyle = '#ff2e93';
  context.font = '48px ' + FONT_FAMILY;
  context.fillText(
    '♥'.repeat(Math.max(0, miniGame.lives)) + '♡'.repeat(Math.max(0, 3 - miniGame.lives)),
    555,
    592,
  );
  clock(
    443,
    561,
    miniGame.phase === 'play' ? Math.max(0, 1 - miniGame.time / 30) : 1,
    String(Math.max(0, Math.ceil(30 - (miniGame.time || 0)))),
  );
  for (const it of miniGame.items) {
    context.fillStyle = 'rgba(255,255,255,.88)';
    context.beginPath();
    context.arc(it.x, it.y, 50, 0, 7);
    context.fill();
    if (it.k === 'gold') {
      context.strokeStyle = '#ffe600';
      context.lineWidth = 8;
      context.beginPath();
      context.arc(it.x, it.y, 46 + Math.sin(elapsedTime * 12) * 4, 0, 7);
      context.stroke();
    }
    context.font = '72px serif';
    context.textAlign = 'center';
    context.fillStyle = '#111';
    context.fillText(it.k === 'gold' ? '🌟' : it.k === 'bad' ? '💣' : it.e, it.x, it.y + 25);
  }
  const bx = miniGame.basketX;
  sprite(characterImages[0], assets.sprites[0], bx, 1452, 0.62, 0.62, 0, 1);
  fillRect('#111', bx - 96, 1318, 192, 86);
  fillRect('#c98b4a', bx - 90, 1324, 180, 74);
  fillRect('#8a5a2b', bx - 90, 1324, 180, 16);
  for (let k = 0; k < 5; k++) fillRect('#a8743a', bx - 80 + k * 36, 1348, 6, 48);
  fillRect('#111', bx - 104, 1308, 208, 16);
  fillRect('#e0b070', bx - 98, 1312, 196, 8);
  fillRect('#2b3a8a', 0, 1440, WORLD_WIDTH, 172);
  fillRect('#111', 0, 1436, WORLD_WIDTH, 6);
}
// 音效和背景音樂位於 audio.js。

// Gameplay pauses behind dialogs and while the document is in the background.
const MIN_FRAME_INTERVAL = 1000 / 60;
let previousFrameTime = performance.now();
function loop(now) {
  if (now - previousFrameTime < MIN_FRAME_INTERVAL - 0.5) {
    requestAnimationFrame(loop);
    return;
  }
  const dt = Math.min(0.05, (now - previousFrameTime) / 1000);
  previousFrameTime = now;
  if (!document.hidden) {
    coachTick();
    if (!isModalOpen() && !transitioning) {
      step(dt);
      draw(dt);
    }
  }
  requestAnimationFrame(loop);
}
function boot() {
  if (hasBooted) return;
  hasBooted = 1;
  requestAnimationFrame(loop);
}
function decodeImage(image) {
  return new Promise((resolve, reject) => {
    const done = () => (image.naturalWidth > 0 ? resolve() : reject(new Error(image.src)));
    if (image.complete) {
      done();
      return;
    }
    image.addEventListener('load', done, { once: true });
    image.addEventListener('error', () => reject(new Error(image.src)), { once: true });
  })
    .then(() => image.decode?.())
    .catch((error) => {
      throw error;
    });
}
async function loadAssets() {
  const titleImage = getElement('lti');
  const images = [backgroundImage, carImage, pinkCarImage, ...characterImages, titleImage];
  let loaded = 0;
  try {
    const jobs = [
      ...images.map(decodeImage),
      document.fonts.load('16px DotGothic16'),
      document.fonts.load('16px FusionPixelTW'),
    ];
    await Promise.all(
      jobs.map(async (job) => {
        await job;
        loadT = ++loaded / jobs.length;
      }),
    );
    loaderReady = true;
    boot();
  } catch (error) {
    loaderFailed = true;
    console.error('遊戲資源載入失敗', error);
    getElement('lpct').textContent = '資源載入失敗';
    getElement('ltip').textContent = '請檢查網路連線，再重新載入。';
    getElement('lgo').textContent = '重新載入';
    getElement('lgo').style.visibility = 'visible';
    getElement('lgo').setAttribute('aria-hidden', 'false');
    getElement('lgo').onclick = () => location.reload();
  }
}
restoreProgress();
setupDialogs();
loadAssets();

function saveProgress() {
  return writeProgress({
    found: [...foundSecrets],
    met: [...metCharacters],
    best: bestScores,
    sound: music.on,
  });
}
function restoreProgress() {
  const saved = readProgress(
    hotspots.map((h) => h.id),
    characters.length,
  );
  foundSecrets = new Set(saved.found);
  metCharacters = new Set(saved.met);
  bestScores = saved.best;
  currentDay = Math.min(5, Math.floor(foundSecrets.size / 3));
  getElement('h1').textContent = foundSecrets.size;
  getElement('h2').textContent = metCharacters.size;
  setSound(saved.sound);
  renderSoundButton(saved.sound);
}
