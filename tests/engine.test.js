import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { assets } from '../src/assets.js';
import { characters } from '../src/characters.js';
import { readProgress, writeProgress } from '../src/storage.js';
import { shuffled } from '../src/utils.js';
import { loadingPose, creditsMotion } from '../src/presentation.js';

/** Engine integration tests use a minimal DOM/canvas adapter, not a real browser. */
async function engine({ brokenImage = false } = {}) {
  const drawCalls = [];
  const ctx = new Proxy(
    { measureText: (text) => ({ width: text.length * 24 }), createPattern: () => ({}) },
    { get: (obj, key) => obj[key] ?? ((...args) => drawCalls.push([key, ...args])) },
  );
  const elements = new Map();
  const timers = [];
  const handlers = {};
  let value = null;
  class Element {
    constructor(id = '') {
      this.id = id;
      this.style = {
        display: ['ov', 'bk', 'mg', 'endv'].includes(id) ? 'none' : id === 'load' ? 'flex' : '',
      };
      this.style.visibility = id === 'lgo' ? 'hidden' : 'visible';
      this.style.setProperty = (key, value) => (this.style[key] = value);
      this.dataset = {};
      this.classList = { toggle() {} };
      this.listeners = {};
      this.textContent = '';
      this.innerHTML = '';
      this.children = [];
      this.complete = true;
      this.naturalWidth = brokenImage ? 0 : 887;
    }
    getContext() {
      return ctx;
    }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 887, height: 1774 };
    }
    addEventListener(type, callback) {
      this.listeners[type] = callback;
    }
    setAttribute() {}
    focus() {}
    setPointerCapture() {}
    querySelectorAll() {
      return [];
    }
    appendChild(element) {
      this.children.push(element);
    }
    append(element) {
      this.children.push(element);
    }
    replaceChildren() {
      this.children = [];
    }
    decode() {
      return Promise.resolve();
    }
  }
  const get = (id) => elements.get(id) ?? (elements.set(id, new Element(id)), elements.get(id));
  const tabs = Array.from({ length: 4 }, () => new Element());
  const storage = { getItem: () => value, setItem: (_key, next) => (value = next) };
  const music = { on: true };
  const sandbox = {
    assets,
    characters,
    shuffled,
    loadingPose,
    creditsMotion,
    readProgress: (ids, count) => readProgress(ids, count, storage),
    writeProgress: (progress) => writeProgress(progress, storage),
    music,
    playSound() {},
    setMusic() {},
    startMusic() {},
    resumeAudio() {},
    toggleSound: () => (music.on = !music.on),
    setSound: (enabled) => (music.on = enabled),
    isModalOpen: () =>
      ['load', 'ov', 'bk', 'mg', 'endv'].some((id) => get(id).style.display === 'flex'),
    setupDialogs() {},
    closeTopModal() {},
    Image: Element,
    document: {
      hidden: false,
      fonts: { load: () => Promise.resolve() },
      getElementById: get,
      createElement: () => new Element(),
      querySelectorAll: () => tabs,
      addEventListener() {},
    },
    addEventListener: (type, callback) => (handlers[type] = callback),
    performance: { now: () => 0 },
    requestAnimationFrame() {},
    setTimeout: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeout() {},
    console: { error() {} },
    location: { reload() {} },
    Math,
  };
  const context = vm.createContext(sandbox);
  const source = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8').replace(
    /^import[\s\S]*?;\n/gm,
    '',
  );
  vm.runInContext(
    source +
      `\n globalThis.harness={
   loaderStatus:()=>({ready:loaderReady,progress:loadT}),loaderFrame,setLoaderReady:value=>loaderReady=value,
   effects:()=>({jpTime:jp.t,eggs:eggs.length,particles:parts.length}),
   state:()=>({found:[...foundSecrets],met:[...metCharacters],best:{...bestScores},scene:currentScene,miniGame,party}),
   start:()=>getElement('lgo').onclick(),mark,card,step,draw,sceneTap,sceneStep,stepC,showEnd,
   enterShop,leaveShop,activateHotspot,
   setGame:(scene,game)=>{currentScene=scene;miniGame=game;},
   createMiniGame,hotspots,crowdRect,
   setKeys:value=>keys=value,
 };`,
    context,
  );
  await new Promise((resolve) => setImmediate(resolve));
  return {
    h: sandbox.harness,
    get,
    ctx,
    drawCalls,
    handlers,
    timers,
    runTransition() {
      const i = timers.findIndex((t) => t.delay === 400);
      assert.ok(i >= 0);
      timers.splice(i, 1)[0].callback();
    },
    stored: () => value,
  };
}
test('boot, discovery, character card and actual engine save work together', async () => {
  const e = await engine();
  assert.equal(e.h.loaderStatus().ready, true);
  assert.equal(e.h.loaderStatus().progress, 1);
  e.h.start();
  e.h.draw(1 / 60);
  e.h.mark('太陽');
  e.h.card(2);
  const saved = JSON.parse(e.stored());
  assert.deepEqual(saved.found, ['太陽']);
  assert.deepEqual(saved.met, [2]);
  assert.deepEqual(saved.best, { A: 0, B: 0, C: 0 });
  assert.equal(e.get('cn').textContent, '甄美人');
  assert.equal(e.get('bio').textContent, characters[2].biography);
});
test('a failed image gives a retry control instead of a stuck loading screen', async () => {
  const e = await engine({ brokenImage: true });
  assert.equal(e.get('lpct').textContent, '資源載入失敗');
  assert.equal(e.get('lgo').textContent, '重新載入');
});
test('ending preview preserves real collection progress', async () => {
  const e = await engine();
  e.h.start();
  e.get('skip').onclick();
  e.get('skip').onclick();
  assert.equal(e.h.state().found.length, 0);
  assert.equal(e.h.state().met.length, 0);
  assert.match(e.get('ecr').innerHTML, /16 個秘密，全數解鎖！/);
  assert.doesNotMatch(e.get('ecr').innerHTML, /這是結局預覽/);
});
test('all three mini-games enter, render, complete, save scores and leave', async () => {
  for (const scene of ['A', 'B', 'C']) {
    const e = await engine();
    e.h.start();
    e.h.enterShop(scene);
    e.runTransition();
    assert.equal(e.h.state().scene, scene);
    e.get('mgs').onclick();
    e.h.draw(1 / 60);
    if (scene === 'B') {
      for (let round = 0; round < 5; round++) {
        const game = e.h.state().miniGame;
        game.pointerPosition = game.zoneCenter;
        e.h.sceneTap(443, 900);
        e.h.sceneStep(1.4);
      }
    } else {
      e.h.state().miniGame.score = 25;
      e.h.sceneStep(31);
    }
    assert.equal(e.h.state().miniGame.phase, 'end');
    assert.equal(e.h.state().best[scene], scene === 'B' ? 15 : 25);
    assert.equal(JSON.parse(e.stored()).best[scene], scene === 'B' ? 15 : 25);
    e.get('mgq').onclick();
    e.runTransition();
    assert.equal(e.h.state().scene, null);
  }
});
test('store transitions cannot overlap and drink-catching keyboard movement works', async () => {
  const e = await engine();
  e.h.start();
  e.h.enterShop('C');
  e.h.enterShop('A');
  assert.equal(e.timers.filter((t) => t.delay === 400).length, 1);
  e.runTransition();
  e.get('mgs').onclick();
  const before = e.h.state().miniGame.basketX;
  e.h.setKeys({ arrowright: 1 });
  e.h.stepC(0.1);
  assert.ok(e.h.state().miniGame.basketX > before);
});
test('particle lifetimes are elapsed-time based at both 60 Hz and 120 Hz', async () => {
  for (const rate of [60, 120]) {
    const e = await engine();
    e.h.start();
    e.h.activateHotspot(e.h.hotspots[0]);
    for (let i = 0; i < rate * 2; i++) {
      e.h.step(1 / rate);
      e.h.draw(1 / rate);
    }
    assert.equal(e.h.effects().eggs, 0);
    assert.equal(e.h.effects().particles, 0);
    assert.ok(Math.abs(e.h.effects().jpTime - 1.4) < 0.001);
  }
});

test('restarting requires a second click and clears saved progress', async () => {
  const e = await engine();
  e.h.start();
  e.h.mark('太陽');
  e.h.card(0);
  e.get('reset').onclick();
  assert.equal(e.h.state().found.length, 1);
  e.get('reset').onclick();
  assert.equal(e.h.state().found.length, 0);
  assert.equal(e.h.state().met.length, 0);
  assert.deepEqual(JSON.parse(e.stored()).best, { A: 0, B: 0, C: 0 });
});

test('all seven mini-game character hitboxes fit inside the poster', async () => {
  const e = await engine();
  for (let i = 0; i < characters.length; i++) {
    const [x, y, width, height] = e.h.crowdRect(i);
    assert.ok(x >= 0);
    assert.ok(x + width <= 887);
    assert.ok(y >= 0);
    assert.ok(y + height <= 1774);
  }
});

test('scroll gestures do not discover secrets, while deliberate taps do', async () => {
  const e = await engine();
  e.h.start();
  const canvas = e.get('c');
  const event = { button: 0, pointerId: 1, clientX: 690, clientY: 215, preventDefault() {} };
  canvas.listeners.pointerdown(event);
  canvas.listeners.pointermove({ ...event, clientY: 260 });
  canvas.listeners.pointerup({ ...event, clientY: 260 });
  assert.equal(e.h.state().found.length, 0);
  canvas.listeners.pointerdown(event);
  canvas.listeners.pointerup(event);
  assert.ok(e.h.state().found.includes('J彩蛋'));
});

test('coffee accepts a space key and grocery accepts numbered shelf keys', async () => {
  for (const scene of ['A', 'B']) {
    const e = await engine();
    e.h.start();
    e.h.enterShop(scene);
    e.runTransition();
    e.get('mgs').onclick();
    const game = e.h.state().miniGame;
    if (scene === 'A') game.slots[0] = { k: 'good', e: '🍵', t: 0, d: 1 };
    else game.pointerPosition = game.zoneCenter;
    const event = {
      key: scene === 'A' ? '1' : ' ',
      repeat: false,
      code: '',
      preventDefault() {},
      target: { closest: () => null },
    };
    e.handlers.keydown(event);
    assert.equal(game.score, scene === 'A' ? 1 : 3);
  }
});

test('loading stays stable until its introductory animation finishes', async () => {
  const e = await engine();
  e.h.loaderFrame(0);
  assert.equal(e.get('lgo').style.visibility, 'hidden');
  for (let now = 16; now <= 3300; now += 16) e.h.loaderFrame(now);
  assert.equal(e.get('lpct').textContent, 'NOW LOADING… 100%');
  assert.equal(e.get('lgo').style.visibility, 'visible');
  assert.equal(e.get('lrow').children.length, 7);
});
test('ending credits pause, resume and replay without changing progress', async () => {
  const e = await engine();
  e.h.start();
  e.h.showEnd(true);
  assert.match(e.get('ecr').innerHTML, /cast-portrait/);
  assert.match(e.get('ecr').innerHTML, /itinerary-row/);
  e.get('endpause').onclick();
  assert.equal(e.get('ecr').style.animationPlayState, 'paused');
  e.get('endpause').onclick();
  assert.equal(e.get('ecr').style.animationPlayState, 'running');
  e.get('ecr').listeners.animationend({ animationName: 'credits-roll' });
  assert.equal(e.get('endpause').textContent, '重播字幕');
  assert.equal(e.get('memory-save-label').textContent, '回憶存檔完成。');
  assert.equal(e.get('memory-save-bar').textContent, '▮▮▮▮▮▮▮▮');
  e.get('endpause').onclick();
  assert.equal(e.get('endpause').dataset.finished, 'false');
  assert.equal(e.h.state().found.length, 0);
});
test('sound controls use a pixel SVG and still toggle mute', async () => {
  const e = await engine();
  assert.match(e.get('snd').innerHTML, /viewBox="0 0 16 16"/);
  const before = e.get('snd').innerHTML;
  e.get('snd').onclick();
  assert.notEqual(e.get('snd').innerHTML, before);
  assert.equal(JSON.parse(e.stored()).sound, false);
});

test('ending preserves the reference text and its two/three deliberate lines', async () => {
  const e = await engine();
  e.h.showEnd(true);
  const html = e.get('ecr').innerHTML;
  assert.match(
    html,
    /<span class="ending-line">恭喜各位玩家，<\/span><span class="ending-line">成功完成東京冒險的行前測驗！<\/span>/,
  );
  assert.match(
    html,
    /<span class="ending-line">真正的魔王任務——<\/span><span class="ending-line">七個女人一起出國，<\/span><span class="ending-line">現在才要開始 &lt;3<\/span>/,
  );
});

test('slow resource loading still plays each entrance before enabling START', async () => {
  const e = await engine();
  e.h.setLoaderReady(false);
  for (let now = 0; now <= 5000; now += 16) e.h.loaderFrame(now);
  assert.equal(e.get('lgo').style.visibility, 'hidden');
  assert.equal(e.get('lrow').children[6].style.opacity, '0');
  e.h.setLoaderReady(true);
  e.h.loaderFrame(5016);
  assert.equal(e.get('lrow').children[0].style.left, '-26cqw');
  assert.equal(e.get('lgo').style.visibility, 'hidden');
  for (let now = 5032; now <= 8400; now += 16) e.h.loaderFrame(now);
  assert.equal(e.get('lgo').style.visibility, 'visible');
});
