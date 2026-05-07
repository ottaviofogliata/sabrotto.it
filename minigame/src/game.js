/* GAME — world parsing, physics, enemies, render loop */

const E = window.ENGINE;
const A = window.AUDIO;
const GCTX = E.ctx;
const GCANVAS = E.canvas;
const _drawSprite = E.drawSprite;
const _drawSpriteHi = E.drawSpriteHi;
const _cameraScale = E.cameraScale;
const _Input = E.Input;

const State = {
  heroKey: 'otto',
  levelIndex: 0,
  lives: 3,
  coins: 0,
  totalCoinsRun: 0,
  time: 300,
  playerName: 'PLAYER',
  normalizedPlayerName: 'PLAYER',
  scoreToken: null,
  scoreSubmitted: false,
  scoreOffline: false,
  scoreRetryCount: 0,
  scoreRetryTimer: null,
  runStartedAt: 0,
  levelStartCoinsRun: 0,
  running: false,
  paused: false,
  startedAt: 0,
  banner: null,
  flash: 0,    // ms remaining of full-screen power-up flash
  shake: 0,    // ms remaining of camera shake
};

const SCORE_API_ROOT = '/api/minigame';
const SCORE_NAME_RE = /^[A-Z0-9][A-Z0-9 '-]*$/;
const SCORE_BASE = 10000;
const SCORE_RETRY_DELAYS = [1200, 3500, 8000];

function scoreApiEnabled() {
  return window.location.protocol !== 'file:';
}

function normalizePlayerName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function validatePlayerName(value) {
  const normalized = normalizePlayerName(value);
  if (normalized.length < 2 || normalized.length > 12) {
    return { ok: false, message: 'USE 2-12 CHARS' };
  }
  if (!SCORE_NAME_RE.test(normalized) || !/[A-Z0-9].*[A-Z0-9]/.test(normalized)) {
    return { ok: false, message: 'LETTERS NUMBERS SPACE - \'' };
  }
  return { ok: true, normalized };
}

function calculateFinalScore(stats) {
  return SCORE_BASE +
    Math.max(0, Math.floor(stats.coins || 0)) * 100 +
    Math.max(0, Math.ceil(stats.timeRemaining || 0)) * 10 +
    Math.max(0, Math.floor(stats.lives || 0)) * 1000;
}

function formatScore(score) {
  return String(Math.max(0, Math.floor(score || 0))).padStart(5, '0');
}

function setNameError(message) {
  const el = document.getElementById('name-error');
  if (!el) return;
  if (!message) {
    el.textContent = '';
    el.classList.add('hidden');
    return;
  }
  el.textContent = message;
  el.classList.remove('hidden');
}

function setStartButtonBusy(isBusy) {
  const btn = document.getElementById('btn-start-run');
  if (!btn) return;
  btn.disabled = !!isBusy;
  const name = btn.querySelector('.btn-name');
  if (name) name.textContent = isBusy ? 'WAIT' : 'START';
}

function setPlayerName(name, normalizedName) {
  const normalized = normalizePlayerName(normalizedName || name || 'PLAYER') || 'PLAYER';
  State.normalizedPlayerName = normalized;
  State.playerName = normalizePlayerName(name || normalized) || normalized;
  refreshHeroUi();
}

async function readErrorMessage(response, fallback) {
  try {
    const data = await response.json();
    return data.statusMessage || data.message || data.error || fallback;
  } catch (err) {
    return fallback;
  }
}

async function requestScoreSession(rawName, heroKey) {
  const checked = validatePlayerName(rawName);
  if (!checked.ok) throw new Error(checked.message);

  if (!scoreApiEnabled()) {
    return {
      playerName: checked.normalized,
      normalizedName: checked.normalized,
      token: null,
      expiresAt: 0,
      offline: true,
    };
  }

  let response;
  try {
    response = await fetch(SCORE_API_ROOT + '/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: checked.normalized,
        heroKey: heroKey || State.heroKey,
      }),
    });
  } catch (err) {
    return {
      playerName: checked.normalized,
      normalizedName: checked.normalized,
      token: null,
      expiresAt: 0,
      offline: true,
    };
  }

  if (response.status === 404) {
    return {
      playerName: checked.normalized,
      normalizedName: checked.normalized,
      token: null,
      expiresAt: 0,
      offline: true,
    };
  }

  if (!response.ok) {
    const message = response.status === 409
      ? 'NAME ALREADY TOP 50'
      : await readErrorMessage(response, 'SCORE SERVER ERROR');
    throw new Error(normalizePlayerName(message).slice(0, 28) || 'SCORE SERVER ERROR');
  }

  const data = await response.json();
  return {
    playerName: data.playerName || checked.normalized,
    normalizedName: data.normalizedName || checked.normalized,
    token: data.token || null,
    expiresAt: data.expiresAt || 0,
    offline: false,
  };
}

function showNameEntry() {
  const title = document.getElementById('title');
  const entry = document.getElementById('name-entry');
  const input = document.getElementById('player-name');
  const label = document.getElementById('name-hero');
  if (title) title.classList.add('hidden');
  if (entry) entry.classList.remove('hidden');
  if (label) {
    label.textContent = (State.heroKey === 'sabrina' ? '2P ' : '1P ') + currentHero().hudLabel + ' READY';
  }
  setNameError('');
  if (input) {
    input.value = State.playerName !== 'PLAYER' ? State.playerName : '';
    setTimeout(function () { input.focus(); }, 0);
  }
}

function showTitle() {
  clearScoreRetry();
  State.running = false;
  stopMusic();
  State.scoreToken = null;
  State.scoreSubmitted = false;
  State.scoreOffline = false;
  State.playerName = 'PLAYER';
  State.normalizedPlayerName = 'PLAYER';
  document.getElementById('name-entry').classList.add('hidden');
  document.getElementById('dead').classList.add('hidden');
  document.getElementById('win').classList.add('hidden');
  document.getElementById('title').classList.remove('hidden');
  applyTheme(LEVELS[0]);
  refreshHeroUi();
}

async function startRunFromName() {
  const input = document.getElementById('player-name');
  setNameError('');
  setStartButtonBusy(true);
  try {
    await unlockAudio();
    const session = await requestScoreSession(input ? input.value : '');
    clearScoreRetry();
    setPlayerName(session.playerName, session.normalizedName);
    State.scoreToken = session.token;
    State.scoreSubmitted = false;
    State.scoreOffline = !!session.offline;
    State.lives = 3;
    State.totalCoinsRun = 0;
    State.runStartedAt = performance.now();
    document.getElementById('name-entry').classList.add('hidden');
    startLevel(0);
  } catch (err) {
    setNameError(err && err.message ? err.message : 'NAME ERROR');
  } finally {
    setStartButtonBusy(false);
  }
}

function finalRunStats(outcome) {
  const rescued = outcome !== 'game-over';
  return {
    completed: true,
    outcome: rescued ? 'rescued' : 'game_over',
    heroKey: State.heroKey,
    coins: Math.max(0, Math.floor(State.totalCoinsRun)),
    timeRemaining: rescued ? Math.max(0, Math.ceil(State.time)) : 0,
    lives: rescued ? Math.max(0, Math.floor(State.lives)) : 0,
    durationMs: Math.max(0, Math.round(performance.now() - (State.runStartedAt || State.startedAt || performance.now()))),
    levelIndex: State.levelIndex,
    levelsCleared: rescued ? LEVELS.length : Math.max(1, Math.min(LEVELS.length, State.levelIndex)),
  };
}

function updateScoreUi(stats, saveText, prefix, statsId) {
  const idPrefix = prefix || 'win';
  const score = calculateFinalScore(stats);
  const scoreEl = document.getElementById(idPrefix + '-score');
  const subEl = document.getElementById(statsId || idPrefix + '-sub');
  const saveEl = document.getElementById(idPrefix + '-save');
  if (scoreEl) {
    scoreEl.textContent = State.playerName + ' · ' + formatScore(score) + ' PTS';
    scoreEl.classList.remove('hidden');
  }
  if (subEl) {
    subEl.textContent =
      'COINS ' + stats.coins + ' · TIME ' + stats.timeRemaining + ' · LIVES ' + stats.lives;
    subEl.classList.remove('hidden');
  }
  if (saveEl) {
    saveEl.textContent = saveText || 'SCORE READY';
    saveEl.classList.remove('hidden');
  }
}

async function submitFinalScore(stats, statusId, overlayId) {
  if (State.scoreSubmitted) return;
  State.scoreSubmitted = true;
  const scoreSave = document.getElementById(statusId || 'win-save');

  if (!scoreApiEnabled()) {
    if (scoreSave) scoreSave.textContent = 'SCORE LOCAL ONLY';
    return;
  }

  if (!State.scoreToken || State.scoreOffline) {
    if (scoreSave) scoreSave.textContent = 'CONNECTING SCORE...';
    try {
      const session = await requestScoreSession(State.normalizedPlayerName || State.playerName);
      setPlayerName(session.playerName, session.normalizedName);
      State.scoreToken = session.token;
      State.scoreOffline = !!session.offline;
    } catch (err) {}
  }

  if (!State.scoreToken || State.scoreOffline) {
    State.scoreSubmitted = false;
    retryFinalScore(stats, 'SCORE RETRY...', statusId, overlayId);
    return;
  }

  if (scoreSave) scoreSave.textContent = 'SAVING SCORE...';
  let response;
  try {
    response = await fetch(SCORE_API_ROOT + '/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        token: State.scoreToken,
        stats,
      }),
    });
  } catch (err) {
    State.scoreSubmitted = false;
    retryFinalScore(stats, 'SCORE RETRY...', statusId, overlayId);
    return;
  }

  if (!response.ok) {
    if (response.status === 401) {
      State.scoreToken = null;
      State.scoreOffline = false;
      State.scoreSubmitted = false;
      retryFinalScore(stats, 'SCORE RETRY...', statusId, overlayId);
      return;
    }
    const message = await readErrorMessage(response, 'SCORE NOT SAVED');
    if (scoreSave) scoreSave.textContent = normalizePlayerName(message).slice(0, 28) || 'SCORE NOT SAVED';
    return;
  }

  const data = await response.json();
  clearScoreRetry();
  if (scoreSave) {
    scoreSave.textContent = data.kept
      ? 'SCORE SAVED #' + data.rank
      : 'SCORE UNDER TOP 50';
  }
}

function retryFinalScore(stats, message, statusId, overlayId) {
  const scoreSave = document.getElementById(statusId || 'win-save');
  const overlay = document.getElementById(overlayId || 'win');
  if (!overlay || overlay.classList.contains('hidden')) return;
  const count = State.scoreRetryCount || 0;
  if (count >= SCORE_RETRY_DELAYS.length) {
    if (scoreSave) scoreSave.textContent = 'SCORE NOT SAVED';
    return;
  }
  State.scoreRetryCount = count + 1;
  if (scoreSave) scoreSave.textContent = message;
  State.scoreRetryTimer = setTimeout(function () {
    State.scoreRetryTimer = null;
    submitFinalScore(stats, statusId, overlayId);
  }, SCORE_RETRY_DELAYS[count]);
}

function clearScoreRetry() {
  if (State.scoreRetryTimer) {
    clearTimeout(State.scoreRetryTimer);
    State.scoreRetryTimer = null;
  }
  State.scoreRetryCount = 0;
}

const DEATH_MESSAGES = {
  otto: {
    enemy: [
      'Otto si è distratto a guardare gli occhiali!',
      'Un baule ha fregato Otto!',
      'Otto ha perso un round contro un nemico!',
      'Otto pensava fosse un amico…',
      'Hanno spettinato la calvizie di Otto!',
      'Otto ha dimenticato di schivare!',
    ],
    fall: [
      'Otto è inciampato nel vuoto!',
      'Otto cercava una scorciatoia… non era questa!',
      'Un buco nero ha ingoiato Otto!',
      'Otto non ha calcolato bene il salto!',
      'Otto, la gravità non perdona!',
    ],
    time: [
      'Otto ha guardato troppo l\'orologio!',
      'Tempo scaduto! Otto si è perso a chiacchierare!',
      'Otto stava cercando un altro limoncello…',
      'Otto è arrivato in ritardo!',
    ],
  },
  sabrina: {
    enemy: [
      'Sabri ha incontrato il nemico sbagliato!',
      'Hanno scompigliato i capelli a Sabri!',
      'Un nemico ha rubato il rossetto a Sabri!',
      'Sabri ha perso un combattimento di stile!',
      'Sabri si è impigliata nel vestito!',
      'Hanno fatto cadere la corona a Sabri!',
    ],
    fall: [
      'Sabri è caduta nel vuoto!',
      'Sabri cercava la scorciatoia di Otto!',
      'Nessuno ha avvisato Sabri della voragine!',
      'Sabri ha sbagliato passo da principessa!',
      'Sabri, anche le regine cadono!',
    ],
    time: [
      'Sabri si è truccata troppo a lungo!',
      'Tempo scaduto! Sabri si stava sistemando i capelli!',
      'Sabri ha perso tempo a sceglier la corona!',
      'Sabri è arrivata in ritardo come una vera diva!',
    ],
  },
};

function pickDeath(category) {
  const heroSet = DEATH_MESSAGES[State.heroKey] || DEATH_MESSAGES.otto;
  const arr = heroSet[category] || heroSet.enemy;
  return arr[Math.floor(Math.random() * arr.length)];
}

function gameOverMessage() {
  return State.heroKey === 'sabrina'
    ? 'Sabri non ha più vite. Riprova?'
    : 'Otto non ha più vite. Riprova?';
}

const THEMES = {
  sunrise: {
    bands: ['#79cfff', '#8ed9ff', '#bfe9ff', '#f6f1b2'],
    horizon: '#fff2c8',
    orb: '#ffe06f',
    glow: '#fff2bb',
    silhouette: {
      main: '#78c6d8',
      side: '#3f9dc1',
      light: '#a5e9ed',
      shade: '#267ba9',
    },
    orbX: 0.74,
    orbY: 0.2,
    stars: false,
  },
  sunset: {
    bands: ['#5260cc', '#8e64c2', '#f49a63', '#ffe0a3'],
    horizon: '#ffd79a',
    orb: '#ffe0a2',
    glow: '#ffb575',
    silhouette: {
      main: '#c9a07a',
      side: '#946e80',
      light: '#f0c99c',
      shade: '#6f5880',
    },
    orbX: 0.72,
    orbY: 0.24,
    stars: false,
  },
  moonlight: {
    bands: ['#132650', '#23457e', '#4f71ab', '#9db5e4'],
    horizon: '#b8c6ea',
    orb: '#f3f7ff',
    glow: '#d6e4ff',
    silhouette: {
      main: '#5a789b',
      side: '#344f7d',
      light: '#8fa8ca',
      shade: '#253866',
    },
    orbX: 0.78,
    orbY: 0.17,
    stars: true,
  },
};

const HEROES = {
  otto: {
    key: 'otto',
    name: 'Super Otto',
    hudLabel: 'OTTO',
    rescueName: 'Princess Sabri',
    rescueShort: 'Sabri',
    playerSprites: {
      idle: 'otto_idle',
      run1: 'otto_run1',
      run2: 'otto_run2',
      jump: 'otto_jump',
    },
    poweredSprites: {
      idle: 'prince_idle',
      run1: 'prince_run1',
      run2: 'prince_run2',
      jump: 'prince_jump',
    },
    goalSprite: 'sabrina',
    powerText: 'OTTO POWER!',
  },
  sabrina: {
    key: 'sabrina',
    name: 'Super Sabri',
    hudLabel: 'SABRI',
    rescueName: 'Princess Otto',
    rescueShort: 'Princess Otto',
    playerSprites: {
      idle: 'sabrina_idle',
      run1: 'sabrina_run1',
      run2: 'sabrina_run2',
      jump: 'sabrina_jump',
    },
    poweredSprites: {
      idle: 'princess_sabri_idle',
      run1: 'princess_sabri_run1',
      run2: 'princess_sabri_run2',
      jump: 'princess_sabri_jump',
    },
    goalSprite: 'princess_otto',
    powerText: 'SABRI POWER!',
  },
};

const BG_LAYOUT = {
  cloudsFar: [8, 104, 214, 330, 446],
  cloudsNear: [56, 172, 294, 414],
  bushes: [72, 312, 548],
  buildingsFar: [22, 178, 336, 514],
  buildingsNear: [96, 296, 472],
};

function unlockAudio(audible) {
  if (!A || typeof A.unlock !== 'function') return Promise.resolve(false);
  const pending = A.unlock(audible ? { audible: true } : undefined);
  if (pending && typeof pending.catch === 'function') {
    return pending.catch(function () { return false; });
  }
  return Promise.resolve(!!pending);
}

function playLevelMusic(levelIndex) {
  if (!A || typeof A.playLevelTrack !== 'function') return;
  A.playLevelTrack(levelIndex);
}

function ensureLevelMusic() {
  if (!State.running || !A || typeof A.playLevelTrack !== 'function') return;
  if (typeof A.getCurrentTrackId === 'function' && A.getCurrentTrackId() === State.levelIndex) return;
  playLevelMusic(State.levelIndex);
}

function shouldShowAudioButton() {
  if (!A || typeof A.isSupported !== 'function' || !A.isSupported()) return false;
  const isTouchLike = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
  if (!isTouchLike) return false;
  if (typeof A.getState === 'function' && A.getState() !== 'running') return true;
  return State.running &&
    typeof A.getCurrentTrackId === 'function' &&
    A.getCurrentTrackId() !== State.levelIndex;
}

function updateAudioButton() {
  const btn = document.getElementById('btn-audio');
  if (!btn) return;
  btn.classList.toggle('show', shouldShowAudioButton());
}

function requestAudioFromGesture(event) {
  if (event) event.preventDefault();
  unlockAudio(true);
  playSfx('coin');
  if (State.running) ensureLevelMusic();
  setTimeout(ensureLevelMusic, 80);
  setTimeout(ensureLevelMusic, 240);
  setTimeout(function () {
    if (State.running) ensureLevelMusic();
    updateAudioButton();
  }, 420);
}

function stopMusic() {
  if (!A || typeof A.stop !== 'function') return;
  A.stop();
}

function playSfx(name) {
  if (!A || typeof A.playSfx !== 'function') return;
  A.playSfx(name);
}

function currentLevelMeta() {
  return LEVELS[State.levelIndex] || LEVELS[0];
}

function currentHero() {
  return HEROES[State.heroKey] || HEROES.otto;
}

function currentTheme() {
  return THEMES[currentLevelMeta().theme] || THEMES.sunrise;
}

function makeSeeded(seed) {
  let value = seed >>> 0;
  return function () {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const STAR_FIELD = (function () {
  const rnd = makeSeeded(1337);
  const stars = [];
  for (let i = 0; i < 38; i++) {
    stars.push({
      x: rnd(),
      y: rnd() * 0.55,
      size: rnd() > 0.72 ? 3 : 2,
      phase: rnd() * Math.PI * 2,
    });
  }
  return stars;
})();

function applyTheme(level) {
  document.body.dataset.theme = (level && level.theme) || 'sunrise';
}

function refreshHeroUi() {
  const hero = currentHero();
  const hudName = document.getElementById('hud-name');
  const titleText = document.getElementById('title-copy');
  const winHeadline = document.getElementById('win-headline');
  const nameHero = document.getElementById('name-hero');
  if (hudName) hudName.textContent = State.playerName !== 'PLAYER' ? State.playerName : hero.hudLabel;
  if (nameHero) {
    nameHero.textContent = (State.heroKey === 'sabrina' ? '2P ' : '1P ') + hero.hudLabel + ' READY';
  }
  if (titleText) {
    titleText.textContent =
      hero.name + ' starts from World 1-1 and must save ' + hero.rescueName + '.';
  }
  if (winHeadline) {
    winHeadline.textContent = hero.name + ' saved ' + hero.rescueName + '.';
  }
}

function setHero(heroKey) {
  State.heroKey = HEROES[heroKey] ? heroKey : 'otto';
  refreshHeroUi();
}

const camera = { x: 0, y: 0 };
let world = null;

function buildWorld(levelDef) {
  const rows = levelDef.rows;
  const H = rows.length;
  const W = rows[0].length;
  const tiles = [];
  const decor = [];
  const enemies = [];
  const coins = [];
  const flags = [];
  let start = { x: 32, y: (H - 4) * 16 };
  let princess = null;

  for (let y = 0; y < H; y++) {
    tiles[y] = new Array(W).fill(null);
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      switch (ch) {
        case '#': tiles[y][x] = '#'; break;
        case '=': tiles[y][x] = '='; break;
        case '?': tiles[y][x] = '?'; break;
        case 'U': tiles[y][x] = 'U'; break;
        case 'o': coins.push({ tx: x, ty: y, taken: false }); break;
        case '1': enemies.push(makeEnemy('bloop', x * 16, y * 16)); break;
        case '2': enemies.push(makeEnemy('sproink', x * 16, y * 16)); break;
        case '3': enemies.push(makeEnemy('chomper', x * 16, y * 16)); break;
        case 'S': start = { x: x * 16, y: y * 16 }; break;
        case 'P': princess = { x: x * 16, y: y * 16 - 8 }; break;
        case 'F': flags.push({ tx: x, ty: y }); break;
        case 'c': decor.push({ kind: 'cloud', tx: x, ty: y }); break;
        case 'b': decor.push({ kind: 'bush', tx: x, ty: y }); break;
        case 'h': decor.push({ kind: 'hill', tx: x, ty: y }); break;
      }
    }
  }
  return { W, H, tiles, decor, enemies, coins, flags, start, princess, levelDef };
}

function makeEnemy(kind, x, y) {
  const base = { kind, x, y, vx: 0, vy: 0, w: 16, h: 16, dir: -1, alive: true, squashedAt: 0 };
  if (kind === 'bloop')   { base.vx = -0.35; }
  if (kind === 'sproink') { base.vx = -0.55; base.jumpT = 0; }
  if (kind === 'chomper') { base.vx = -0.6; base.w = 24; base.h = 20; base.hp = 2; }
  return base;
}

function tileAt(tx, ty) {
  if (!world || ty < 0 || ty >= world.H || tx < 0 || tx >= world.W) return null;
  return world.tiles[ty][tx];
}
function isSolid(tx, ty) {
  const t = tileAt(tx, ty);
  if (t !== '#' && t !== '=' && t !== '?' && t !== 'U') return false;
  // I blocchi durante un "dispetto" sono temporaneamente non-solidi.
  if (isPranked(tx, ty)) return false;
  return true;
}

const Player = {
  x: 0, y: 0, vx: 0, vy: 0, w: 12, h: 14,
  onGround: false, dir: 1, anim: 0,
  prince: 0,  // ms remaining as Prince Charming (invincible)
  invuln: 0, dead: false, deadT: 0, won: false, winT: 0,
  finishingPole: false,
};

function resetPlayer() {
  Player.x = world.start.x + 2;
  Player.y = world.start.y - 6;
  Player.vx = 0; Player.vy = 0;
  Player.onGround = false; Player.dir = 1; Player.anim = 0;
  Player.invuln = 1500; Player.dead = false; Player.deadT = 0;
  Player.deadHandled = false;
  Player.winHandled = false;
  Player._lifeTaken = false;
  Player.prince = 0;
  Player.won = false; Player.winT = 0; Player.finishingPole = false;
}

/* Pickup items (limoncello + corno) */
const items = [];
function spawnLimoncello(x, y) {
  items.push({ kind: 'limoncello', x, y, vx: 0, vy: -3.4, w: 10, h: 14, t: 0, riseT: 600 });
}
function spawnCorno(x, y) {
  items.push({ kind: 'corno', x, y, vx: 0, vy: -3.4, w: 10, h: 12, t: 0, riseT: 600 });
}
function updateItems(dt) {
  for (const it of items) {
    it.t += dt;
    if (it.riseT > 0) {
      // pop up out of block
      it.y += it.vy;
      it.vy += 0.18;
      it.riseT -= dt;
      if (it.riseT <= 0) { it.vy = 0; it.vx = 0.6; }
    } else {
      // walk like an enemy
      it.vy += GRAVITY;
      if (it.vy > MAX_FALL) it.vy = MAX_FALL;
      // x
      it.x += it.vx;
      const dirX = it.vx > 0 ? 1 : -1;
      const probeX = dirX > 0 ? it.x + it.w : it.x;
      const tx = Math.floor(probeX / 16);
      const top = Math.floor(it.y / 16);
      const bot = Math.floor((it.y + it.h - 1) / 16);
      for (let ty = top; ty <= bot; ty++) {
        if (isSolid(tx, ty)) {
          if (dirX > 0) it.x = tx * 16 - it.w - 0.01;
          else it.x = (tx + 1) * 16 + 0.01;
          it.vx = -it.vx;
          break;
        }
      }
      // y
      it.y += it.vy;
      if (it.vy > 0) {
        const ty = Math.floor((it.y + it.h) / 16);
        const left = Math.floor((it.x + 1) / 16);
        const right = Math.floor((it.x + it.w - 1) / 16);
        for (let tx = left; tx <= right; tx++) {
          if (isSolid(tx, ty)) { it.y = ty * 16 - it.h - 0.01; it.vy = 0; break; }
        }
      }
    }
    // pickup
    if (rectsOverlap(Player, it)) {
      it._taken = true;
      if (it.kind === 'corno') {
        playSfx('powerup');
        spawnFloater('CORNO PORTAFORTUNA!', it.x - 30, it.y - 14);
        triggerCoinRain();
      } else {
        playSfx('powerup');
        becomePrince();
      }
    }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]._taken || items[i].t > 20000) items.splice(i, 1);
  }
}
const sparkles = [];
const SPARKLE_PALETTE = ['#fff5b8', '#ffd65d', '#ffffff', '#7ccfff', '#f78ab8', '#c1a1ff'];

/* ----------- Dispetti -----------------------------------------------------
   Quando il giocatore sta cadendo verso un blocco SOSPESO (= ? U con cielo
   sopra), 1 volta su 3 il blocco "scappa" verso l'alto un attimo prima
   dell'atterraggio: diventa non-solido e si sposta visivamente di alcuni
   pixel, così il giocatore lo attraversa e cade. Dopo ~700ms il blocco torna
   in posizione (riprende solidità).
--------------------------------------------------------------------------- */
const pranks = [];                       // { tx, ty, t, life, peak, ch }
const _prankIndex = new Map();           // "tx,ty" → prank (lookup O(1) per isSolid)
let prankCooldownUntil = 0;
let prankSeenTile = null;                // ultimo blocco già "valutato" (no doppio roll)

function isPranked(tx, ty) {
  return _prankIndex.has(tx + ',' + ty);
}

function isSuspendedBlock(tx, ty) {
  const ch = tileAt(tx, ty);
  if (ch !== '=' && ch !== '?' && ch !== 'U') return false;
  // sospeso = niente di solido sopra (così il giocatore può atterrarci)
  return !isSolid(tx, ty - 1);
}

function predictPlayerLandingTile() {
  // Simula la traiettoria del giocatore (x, y, vx, vy) finché non collide
  // con un tile solido sopra cui verrebbe a poggiare (vy > 0).
  if (Player.vy < 0.3) return null;        // ancora in salita o quasi fermo
  let px = Player.x, py = Player.y, pvx = Player.vx, pvy = Player.vy;
  const maxSteps = 60;                     // ~1s di simulazione a 60fps
  for (let i = 0; i < maxSteps; i++) {
    pvy = Math.min(MAX_FALL, pvy + GRAVITY);
    px += pvx;
    py += pvy;
    pvx *= FRICTION;
    if (Math.abs(pvx) < 0.05) pvx = 0;
    const ty = Math.floor((py + Player.h) / 16);
    const txL = Math.floor((px + 1) / 16);
    const txR = Math.floor((px + Player.w - 1) / 16);
    for (let tx = txL; tx <= txR; tx++) {
      if (isSolid(tx, ty)) {
        // ne ho trovata una. Restituisci la tile centrata sotto al
        // baricentro previsto del giocatore.
        const cxTile = Math.floor((px + Player.w / 2) / 16);
        return { tx: cxTile, ty: ty, distFrames: i };
      }
    }
    if (py > (world.H + 4) * 16) return null;
  }
  return null;
}

function tryPrank(now) {
  if (!world || !State.running || Player.dead || Player.won) return;
  if (Player.onGround) { prankSeenTile = null; return; }
  if (now < prankCooldownUntil) return;
  if (Player.vy < 0.3) return;             // solo durante la discesa

  const landing = predictPlayerLandingTile();
  if (!landing) return;
  // troppo lontano per "spaventarsi": serve un atterraggio imminente
  if (landing.distFrames > 18) return;
  if (landing.distFrames < 2) return;       // ormai è troppo tardi
  if (!isSuspendedBlock(landing.tx, landing.ty)) {
    prankSeenTile = null;
    return;
  }

  const key = landing.tx + ',' + landing.ty;
  if (prankSeenTile === key) return;        // già valutato, non ritirare un altro dado
  prankSeenTile = key;

  // 1 su 3
  if (Math.floor(Math.random() * 3) !== 0) {
    return;                                  // niente dispetto stavolta, ma niente cooldown
  }
  // GO! il blocco scappa.
  triggerPrank(landing.tx, landing.ty, now);
}

function triggerPrank(tx, ty, now) {
  const ch = tileAt(tx, ty);
  if (ch !== '=' && ch !== '?' && ch !== 'U') return;
  const p = {
    tx: tx, ty: ty,
    t: 0,
    riseT: 90,                 // 90ms per salire
    holdT: 460,                // 460ms in alto (passi attraverso)
    fallT: 140,                // 140ms per ricadere
    peak: 14,                  // px di sollevamento
    ch: ch,
    settled: false,
  };
  p.life = p.riseT + p.holdT + p.fallT;
  pranks.push(p);
  _prankIndex.set(tx + ',' + ty, p);
  prankCooldownUntil = now + 5500 + Math.random() * 4500;  // 5.5-10s
  // "DISPETTO!" grande e che resta circa 3s, sale lentamente
  spawnFloater('DISPETTO!', tx * 16 - 8, ty * 16 - 16, {
    life: 3000, vy: 0.018, size: 11, color: '#ff8f3a',
  });
  // 5 risatine "AH!" che salgono con delay scaglionato
  for (let i = 0; i < 5; i++) {
    const jx = tx * 16 + (Math.random() * 22 - 11);
    spawnFloater('AH!', jx, ty * 16 - 8, {
      delay: 220 * i,
      life: 2400 - i * 120,
      vy: 0.05 + Math.random() * 0.025,
      size: 8 + Math.floor(Math.random() * 3),
      color: i % 2 === 0 ? '#ffd65d' : '#ff8f3a',
    });
  }
  // piccolo "whoosh"
  playSfx('block');
}

function prankYOffset(p) {
  if (p.t <= p.riseT) {
    // ease-out cubic
    const u = p.t / p.riseT;
    return -p.peak * (1 - Math.pow(1 - u, 3));
  }
  if (p.t <= p.riseT + p.holdT) {
    // sospeso in alto con micro-bobbio
    return -p.peak + Math.sin(p.t * 0.04) * 0.6;
  }
  // ricaduta
  const u = (p.t - p.riseT - p.holdT) / p.fallT;
  return -p.peak * (1 - Math.pow(u, 2));
}

function updatePranks(dt) {
  for (const p of pranks) p.t += dt;
  // Rimuovi i finiti e libera la lookup map.
  for (let i = pranks.length - 1; i >= 0; i--) {
    const p = pranks[i];
    if (p.t > p.life) {
      _prankIndex.delete(p.tx + ',' + p.ty);
      pranks.splice(i, 1);
    }
  }
}

function drawPranks() {
  if (!pranks.length) return;
  for (const p of pranks) {
    const yOff = prankYOffset(p);
    let spr = null;
    if (p.ch === '=') spr = SPRITES.tile_brick;
    else if (p.ch === '?') spr = SPRITES.tile_question;
    else if (p.ch === 'U') spr = SPRITES.tile_used;
    else if (p.ch === '#') spr = isSolid(p.tx, p.ty - 1) ? SPRITES.tile_ground_fill : SPRITES.tile_ground;
    if (spr) _drawSprite(spr, p.tx * 16, p.ty * 16 + yOff, camera);
  }
}

/* ----------- Bit (il gatto): cameo che scaccia un mostriciattolo ----------- */
let cat = null;          // active cat instance: { x, y, vx, vy, dir, target, t, phase, onGround }
let nextCatAt = 0;       // performance.now() of next allowed spawn check
let catBubble = null;    // "MIAO!" speech bubble, fades out
const dustPoofs = [];    // small "poof" particles when a monster gets scared off
const BIT_SPEED = 2.2;   // più lento, leggibile

function scheduleNextCatVisit(now) {
  // 8-18 secondi tra un tentativo e l'altro (più frequente)
  nextCatAt = now + 8000 + Math.random() * 10000;
}

function pickCatTarget() {
  if (!world) return null;
  const candidates = [];
  const left = camera.x - 24;
  const right = camera.x + E.VIEW_W_TILES * 16 + 24;
  for (const en of world.enemies) {
    if (!en.alive) continue;
    if (en.kind === 'chomper') continue;            // boss esce indenne
    if (en._scared) continue;
    if (en.x < left || en.x > right) continue;
    candidates.push(en);
  }
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function trySpawnCat(now) {
  if (cat) return;
  if (now < nextCatAt) return;
  if (!State.running || Player.dead || Player.won) return;
  const target = pickCatTarget();
  if (!target) {
    // riprova tra poco
    nextCatAt = now + 4000;
    return;
  }
  // Bit entra dal lato dello schermo opposto al nemico, alla stessa altezza-tile.
  const fromLeft = target.x > camera.x + E.VIEW_W_TILES * 8;
  const startX = fromLeft ? camera.x - 18 : camera.x + E.VIEW_W_TILES * 16 + 4;
  cat = {
    x: startX,
    y: target.y - 4,                // partirà cadendo a gravità
    vx: 0, vy: 0,
    dir: fromLeft ? 1 : -1,
    target: target,
    t: 0,
    phase: 'chase',                 // chase → leave
    onGround: false,
    w: 24, h: 18,                   // hitbox; Bit is drawn as a 56x40 hi-res sprite
  };
  target._scared = true;             // il mostriciattolo prova a scappare
  catBubble = { t: 0, life: 2400, text: 'MIAO!' };
  scheduleNextCatVisit(now);
}

function spawnDustPoof(x, y) {
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    dustPoofs.push({
      x, y,
      vx: Math.cos(angle) * (0.6 + Math.random() * 0.5),
      vy: Math.sin(angle) * (0.6 + Math.random() * 0.5) - 0.4,
      t: 0,
      life: 380 + Math.random() * 220,
      r: 1 + Math.random() * 1.4,
      hue: Math.random() < 0.5 ? '#fff5b8' : '#ffffff',
    });
  }
}

function updateCat(dt) {
  if (!cat) return;
  cat.t += dt;
  // gravità + collisione semplificata via moveAndCollide-like on Y
  cat.vy = Math.min(MAX_FALL, cat.vy + GRAVITY);

  // accelera orizzontalmente verso il target o verso l'uscita
  let targetVx;
  if (cat.phase === 'chase' && cat.target && cat.target.alive) {
    const tx = cat.target.x;
    cat.dir = tx > cat.x ? 1 : -1;
    targetVx = cat.dir * BIT_SPEED;
    // se il target è vicino, impennata finale
    if (Math.abs(tx - cat.x) < 14) targetVx = cat.dir * BIT_SPEED * 1.15;
  } else {
    // continua nella stessa direzione e esce di scena
    targetVx = cat.dir * BIT_SPEED * 0.95;
  }
  cat.vx += (targetVx - cat.vx) * 0.35;

  // Movimento + collisione
  cat.x += cat.vx;
  cat.y += cat.vy;

  // collisione col terreno: se i piedi attraversano un tile solido, si appoggia
  const feetTy = Math.floor((cat.y + cat.h) / 16);
  const cxL = Math.floor((cat.x + 2) / 16);
  const cxR = Math.floor((cat.x + cat.w - 2) / 16);
  cat.onGround = false;
  for (let tx = cxL; tx <= cxR; tx++) {
    if (isSolid(tx, feetTy)) {
      cat.y = feetTy * 16 - cat.h;
      cat.vy = 0;
      cat.onGround = true;
      break;
    }
  }

  // se davanti c'è un buco, salta
  if (cat.onGround && cat.phase === 'chase') {
    const aheadTx = Math.floor((cat.x + cat.w / 2 + cat.dir * 10) / 16);
    const groundTy = Math.floor((cat.y + cat.h + 4) / 16);
    if (!isSolid(aheadTx, groundTy)) {
      cat.vy = JUMP_V * 0.85;
      cat.onGround = false;
    }
  }

  // se overlap col target: scaccialo!
  if (cat.phase === 'chase' && cat.target && cat.target.alive) {
    const a = { x: cat.x, y: cat.y, w: cat.w, h: cat.h };
    const b = cat.target;
    if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
      // poof e via
      spawnDustPoof(b.x + (b.w || 12) / 2, b.y + (b.h || 12) / 2);
      spawnFloater('POOF!', b.x - 4, b.y - 6);
      b.alive = false;
      b.squashedAt = 9999;       // niente squash sprite
      cat.phase = 'leave';
      cat.target = null;
      playSfx('stomp');
    }
  }

  // se Bit esce dalla viewport o vive da troppo, scompare
  const offLeft  = cat.x + cat.w < camera.x - 24;
  const offRight = cat.x > camera.x + E.VIEW_W_TILES * 16 + 24;
  if ((cat.phase === 'leave' && (offLeft || offRight)) || cat.t > 9000) {
    cat = null;
  }
}

function updateDustPoofs(dt) {
  for (const p of dustPoofs) {
    p.t += dt;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.02;
    p.vx *= 0.95;
  }
  for (let i = dustPoofs.length - 1; i >= 0; i--) {
    if (dustPoofs[i].t > dustPoofs[i].life) dustPoofs.splice(i, 1);
  }
}

function drawDustPoofs() {
  if (!dustPoofs.length) return;
  const s = _cameraScale();
  for (const p of dustPoofs) {
    const fade = 1 - p.t / p.life;
    if (fade <= 0) continue;
    GCTX.globalAlpha = Math.max(0, fade) * 0.85;
    GCTX.fillStyle = p.hue;
    const sz = Math.max(1, Math.round(p.r * s));
    GCTX.fillRect(
      Math.round((p.x - camera.x) * s) - Math.floor(sz / 2),
      Math.round((p.y - camera.y) * s) - Math.floor(sz / 2),
      sz, sz
    );
  }
  GCTX.globalAlpha = 1;
}

function drawCat(now) {
  if (!cat) return;
  // anim alternata
  const f = Math.floor(now / 110) % 2;
  const spr = f ? SPRITES.bit_run2 : SPRITES.bit_run1;
  _drawSpriteHi(spr, cat.x - 2, cat.y - 2, camera, cat.dir < 0);
}

function drawCatBubble() {
  if (!cat || !catBubble) return;
  const fade = 1 - catBubble.t / catBubble.life;
  if (fade <= 0) return;
  const s = _cameraScale();
  // posizione del fumetto sopra Bit
  const text = catBubble.text;
  const fontPx = 8 * s;
  GCTX.font = fontPx + 'px "Press Start 2P","VT323",monospace';
  GCTX.textBaseline = 'top';
  const padX = 6 * s, padY = 4 * s;
  const tw = GCTX.measureText(text).width;
  const bx = Math.round((cat.x + cat.w / 2 - camera.x) * s) - Math.round(tw / 2) - padX;
  const by = Math.round((cat.y - 14) * s) - padY;
  const bw = Math.round(tw + padX * 2);
  const bh = Math.round(fontPx + padY * 2);
  GCTX.globalAlpha = Math.min(1, fade * 1.2);
  // ombra del fumetto
  GCTX.fillStyle = 'rgba(0,0,0,0.35)';
  GCTX.fillRect(bx + 2, by + 3, bw, bh);
  // fumetto bianco
  GCTX.fillStyle = '#ffffff';
  GCTX.fillRect(bx, by, bw, bh);
  // bordo nero pixel
  GCTX.fillStyle = '#171220';
  GCTX.fillRect(bx, by - 1, bw, 1);
  GCTX.fillRect(bx, by + bh, bw, 1);
  GCTX.fillRect(bx - 1, by, 1, bh);
  GCTX.fillRect(bx + bw, by, 1, bh);
  // codina del fumetto verso il gatto
  const tipX = bx + Math.round(bw / 2);
  const tipY = by + bh;
  GCTX.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    GCTX.fillRect(tipX - 2 + i, tipY + i, 4 - i, 1);
  }
  GCTX.fillStyle = '#171220';
  GCTX.fillRect(tipX - 2, tipY + 4, 1, 1);
  GCTX.fillRect(tipX + 1, tipY + 4, 1, 1);
  // testo
  GCTX.fillStyle = '#171220';
  GCTX.fillText(text, bx + padX, by + padY);
  GCTX.globalAlpha = 1;
}

const coinRain = [];
function triggerCoinRain() {
  // Sudden burst of coins from above the visible viewport, scattered across width.
  const viewW = E.VIEW_W_TILES * 16;
  const left = camera.x - 16;
  const right = camera.x + viewW + 16;
  const skyY = camera.y - 24;
  const N = 32;
  for (let i = 0; i < N; i++) {
    coinRain.push({
      x: left + (right - left) * (i / N) + (Math.random() - 0.5) * 12,
      y: skyY - Math.random() * 80,    // staggered start heights
      vx: (Math.random() - 0.5) * 0.4,
      vy: 1.4 + Math.random() * 1.2,   // already moving fast on spawn
      landed: false,
      taken: false,
      t: 0,
      restAfter: 7000 + Math.random() * 2500,
      animOff: Math.floor(Math.random() * 4),
    });
  }
  State.flash = 220;
  State.shake = 180;
  playSfx('powerup_spawn');
}

const PRINCE_DURATION_MS = 8000;
function becomePrince() {
  Player.prince = PRINCE_DURATION_MS;

  // La musica accelera per la durata del power-up
  if (A && typeof A.setTempoMultiplier === 'function') A.setTempoMultiplier(1.4);

  // Full-screen lightning flash + camera shake
  State.flash = 520;
  State.shake = 460;

  // Radiating starburst of multicolored sparkles
  const cx = Player.x + 6;
  const cy = Player.y + 4;
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.2;
    const speed = 1.6 + Math.random() * 2.0;
    sparkles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      t: 0,
      life: 700 + Math.random() * 500,
      size: 1 + Math.random() * 1.5,
      hue: SPARKLE_PALETTE[Math.floor(Math.random() * SPARKLE_PALETTE.length)],
      twinkle: Math.random() * Math.PI * 2,
    });
  }
  // Concentric ring sparkles for extra flash
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    sparkles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * 0.6,
      vy: Math.sin(angle) * 0.6,
      t: 0,
      life: 380 + Math.random() * 220,
      size: 2,
      hue: '#ffffff',
      twinkle: 0,
    });
  }
  // Big fanfare burst of hearts!
  for (let i = 0; i < 14; i++) {
    hearts.push({
      x: cx + (Math.random() * 14 - 7),
      y: Player.y - 4,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -1.4 - Math.random() * 0.7,
      t: 0, delay: i * 40,
      life: 1700 + Math.random() * 400,
    });
  }
  spawnFloater(currentHero().powerText, Player.x - 22, Player.y - 18);
}

const GRAVITY = 0.42;
const MAX_FALL = 10;
const ACCEL = 0.35;
const FRICTION = 0.78;
const RUN_MAX = 3.4;
const JUMP_V = -8.6;
const JUMP_HOLD = -0.32;

function moveAndCollide(ent, dt) {
  ent.x += ent.vx;
  if (ent.vx !== 0) {
    const dirX = ent.vx > 0 ? 1 : -1;
    const probe = dirX > 0 ? ent.x + ent.w : ent.x;
    const tx = Math.floor(probe / 16);
    const top = Math.floor(ent.y / 16);
    const bot = Math.floor((ent.y + ent.h - 1) / 16);
    for (let ty = top; ty <= bot; ty++) {
      if (isSolid(tx, ty)) {
        if (dirX > 0) ent.x = tx * 16 - ent.w - 0.01;
        else ent.x = (tx + 1) * 16 + 0.01;
        ent.vx = 0;
        ent._hitX = true;
        break;
      }
    }
  }
  ent.vy += GRAVITY;
  if (ent.vy > MAX_FALL) ent.vy = MAX_FALL;
  ent.y += ent.vy;
  ent.onGround = false;
  if (ent.vy !== 0) {
    const dirY = ent.vy > 0 ? 1 : -1;
    const probe = dirY > 0 ? ent.y + ent.h : ent.y;
    const ty = Math.floor(probe / 16);
    const left = Math.floor((ent.x + 1) / 16);
    const right = Math.floor((ent.x + ent.w - 1) / 16);
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tx, ty)) {
        if (dirY > 0) {
          ent.y = ty * 16 - ent.h - 0.01;
          ent.vy = 0;
          ent.onGround = true;
        } else {
          ent.y = (ty + 1) * 16 + 0.01;
          ent.vy = 0.5;
          if (ent === Player) {
            const tch = tileAt(tx, ty);
            if (tch === '?') {
              world.tiles[ty][tx] = 'U';
              playSfx('block');
              // Drop roll: 18% corno (lucky horn → coin rain), 22% limoncello, 60% coin.
              const r = Math.random();
              if (r < 0.18) {
                spawnCorno(tx * 16 + 2, ty * 16 - 14);
                playSfx('powerup_spawn');
                spawnFloater('CORNO!', tx * 16 + 2, ty * 16 - 14);
              } else if (r < 0.40) {
                spawnLimoncello(tx * 16 + 2, ty * 16 - 16);
                playSfx('powerup_spawn');
                spawnFloater('LIMONCELLO!', tx * 16 - 8, ty * 16 - 14);
              } else {
                State.coins++;
                State.totalCoinsRun++;
                playSfx('coin');
                spawnFloater('+1', tx * 16 + 4, ty * 16 - 4);
              }
            }
          }
        }
        break;
      }
    }
  }
  if (ent.y > (world.H + 4) * 16) {
    if (ent === Player) killPlayer(pickDeath('fall'));
    else ent.alive = false;
  }
}

const floaters = [];
function spawnFloater(text, x, y, opts) {
  const f = { text, x, y, t: 0, life: 700, vy: 0.04, delay: 0, color: null };
  if (opts) Object.assign(f, opts);
  floaters.push(f);
}

/* Hearts: random love-emission every 5-15 seconds */
const hearts = [];
let nextHeartAt = 0;
function scheduleNextHeart(now) {
  nextHeartAt = now + (5000 + Math.random() * 10000);
}
function emitHeartBurst() {
  // 3-5 hearts in a small burst, slight horizontal jitter
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    hearts.push({
      x: Player.x + 2 + (Math.random() * 8 - 4),
      y: Player.y - 4,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.6 - Math.random() * 0.3,
      t: 0,
      delay: i * 120,
      life: 1400 + Math.random() * 400,
    });
  }
}

function updateEnemy(en, dt) {
  if (!en.alive) {
    en.squashedAt += dt;
    return;
  }
  en.vy += GRAVITY;
  if (en.vy > MAX_FALL) en.vy = MAX_FALL;
  en._hitX = false;
  // Mostriciattolo spaventato da Bit: corre più veloce, sempre nel verso opposto al gatto.
  if (en._scared && cat) {
    const fleeDir = en.x > cat.x ? 1 : -1;
    if ((en.vx > 0) !== (fleeDir > 0)) en.vx = fleeDir * Math.abs(en.vx || 1);
    const baseSpeed = en.kind === 'sproink' ? 1.6 : 1.3;
    en.vx = fleeDir * baseSpeed * 1.7;
  }
  moveAndCollideEnemy(en);
  if (en._hitX) en.vx = -en.vx;
  if (en.onGround && en.kind !== 'chomper') {
    const ahead = en.vx > 0 ? en.x + en.w + 1 : en.x - 1;
    const tx = Math.floor(ahead / 16);
    const ty = Math.floor((en.y + en.h + 2) / 16);
    if (!isSolid(tx, ty)) en.vx = -en.vx;
  }
  if (en.kind === 'sproink') {
    en.jumpT = (en.jumpT || 0) + dt;
    if (en.onGround && en.jumpT > 1100) {
      en.vy = -5.6;
      en.jumpT = 0;
    }
  }
}

function moveAndCollideEnemy(en) {
  en.x += en.vx;
  const dirX = en.vx > 0 ? 1 : -1;
  if (en.vx !== 0) {
    const probe = dirX > 0 ? en.x + en.w : en.x;
    const tx = Math.floor(probe / 16);
    const top = Math.floor(en.y / 16);
    const bot = Math.floor((en.y + en.h - 1) / 16);
    for (let ty = top; ty <= bot; ty++) {
      if (isSolid(tx, ty)) {
        if (dirX > 0) en.x = tx * 16 - en.w - 0.01;
        else en.x = (tx + 1) * 16 + 0.01;
        en._hitX = true;
        break;
      }
    }
  }
  en.y += en.vy;
  en.onGround = false;
  if (en.vy !== 0) {
    const dirY = en.vy > 0 ? 1 : -1;
    const probe = dirY > 0 ? en.y + en.h : en.y;
    const ty = Math.floor(probe / 16);
    const left = Math.floor((en.x + 1) / 16);
    const right = Math.floor((en.x + en.w - 1) / 16);
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tx, ty)) {
        if (dirY > 0) {
          en.y = ty * 16 - en.h - 0.01;
          en.vy = 0;
          en.onGround = true;
        } else {
          en.y = (ty + 1) * 16 + 0.01;
          en.vy = 0.5;
        }
        break;
      }
    }
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function handleCollisions() {
  for (const c of world.coins) {
    if (c.taken) continue;
    const cb = { x: c.tx * 16 + 2, y: c.ty * 16 + 2, w: 12, h: 14 };
    if (rectsOverlap(Player, cb)) {
      c.taken = true;
      State.coins++;
      State.totalCoinsRun++;
      playSfx('coin');
      spawnFloater('+1', cb.x, cb.y - 4);
    }
  }
  for (const en of world.enemies) {
    if (!en.alive) continue;
    if (!rectsOverlap(Player, en)) continue;
    const stomp = Player.vy > 1.4 && (Player.y + Player.h) - en.y < 10;
    if (stomp) {
      if (en.kind === 'chomper') {
        en.hp = (en.hp || 1) - 1;
        Player.vy = JUMP_V * 0.7;
        if (en.hp <= 0) {
          en.alive = false; en.squashedAt = 0;
          State.coins += 5; State.totalCoinsRun += 5;
          playSfx('stomp');
          spawnFloater('+5', en.x, en.y - 4);
        } else {
          playSfx('enemy_hit');
          spawnFloater('OW!', en.x + 4, en.y - 4);
        }
      } else {
        en.alive = false; en.squashedAt = 0;
        Player.vy = JUMP_V * 0.6;
        State.coins += 1; State.totalCoinsRun += 1;
        playSfx('stomp');
        spawnFloater('+1', en.x + 4, en.y - 4);
      }
    } else if (Player.prince > 0) {
      // invincible — knock the enemy out and earn coins
      en.alive = false; en.squashedAt = 0;
      State.coins += 1; State.totalCoinsRun += 1;
      playSfx('stomp');
      spawnFloater('+1', en.x + 4, en.y - 4);
    } else if (Player.invuln <= 0) {
      killPlayer(pickDeath('enemy'));
    }
  }
  for (const f of world.flags) {
    const fb = { x: f.tx * 16 + 6, y: f.ty * 16 - 64, w: 6, h: 80 };
    if (rectsOverlap(Player, fb) && !Player.won) {
      Player.won = true; Player.winT = 0;
      Player.finishingPole = true;
      playSfx('flag');
      _Input.left = _Input.right = false;
      break;
    }
  }
  if (world.princess) {
    const p = world.princess;
    const pb = { x: p.x, y: p.y, w: 16, h: 24 };
    if (rectsOverlap(Player, pb) && !Player.won) {
      Player.won = true; Player.winT = 0;
      playSfx('rescue');
    }
  }
}

function killPlayer(reason) {
  if (Player.dead) return;
  Player.dead = true;
  Player.deadT = 0;
  Player.vy = -7;
  Player.vx = 0;
  // Doppia salvaguardia: la vita scende UNA sola volta per ciclo di morte.
  if (!Player._lifeTaken) {
    State.lives--;
    State.totalCoinsRun = State.levelStartCoinsRun;
    Player._lifeTaken = true;
  }
  State._deathReason = reason;
  playSfx('hurt');
}

function updateCamera() {
  const viewW = VIEW_W_LOGICAL();
  const viewH = VIEW_H_LOGICAL();
  const worldW = world.W * 16;
  const worldH = world.H * 16;
  const target = Player.x - viewW / 2;
  camera.x = Math.max(0, Math.min(target, worldW - viewW));
  camera.y = worldH > viewH
    ? Math.max(0, worldH - viewH)
    : Math.floor((worldH - viewH) / 2);
  if (worldW < viewW) camera.x = 0;
}

const VIEW_W_LOGICAL = () => Math.ceil(GCANVAS.width / _cameraScale());
const VIEW_H_LOGICAL = () => Math.ceil(GCANVAS.height / _cameraScale());

function drawSky(theme) {
  const sky = GCTX.createLinearGradient(0, 0, 0, GCANVAS.height);
  sky.addColorStop(0, theme.bands[0]);
  sky.addColorStop(0.36, theme.bands[1]);
  sky.addColorStop(0.72, theme.bands[2]);
  sky.addColorStop(1, theme.bands[3]);
  GCTX.fillStyle = sky;
  GCTX.fillRect(0, 0, GCANVAS.width, GCANVAS.height);

  GCTX.globalAlpha = 0.26;
  GCTX.fillStyle = theme.horizon;
  GCTX.fillRect(0, Math.floor(GCANVAS.height * 0.7), GCANVAS.width, Math.ceil(GCANVAS.height * 0.18));
  GCTX.globalAlpha = 1;
}

function drawOrbDisk(cx, cy, radius, step, color) {
  GCTX.fillStyle = color;
  for (let y = -radius; y <= radius; y += step) {
    const half = Math.sqrt(Math.max(0, radius * radius - y * y));
    const w = Math.max(step, Math.round((half * 2) / step) * step);
    GCTX.fillRect(Math.round(cx - w / 2), Math.round(cy + y), w, step);
  }
}

function drawOrb(theme) {
  const step = Math.max(4, _cameraScale());
  const radius = Math.max(step * 5, Math.floor(GCANVAS.height * 0.1));
  const cx = Math.floor(GCANVAS.width * theme.orbX);
  const cy = Math.floor(GCANVAS.height * theme.orbY);

  GCTX.globalAlpha = theme.stars ? 0.16 : 0.22;
  drawOrbDisk(cx, cy, radius + step * 4, step, theme.glow);
  GCTX.globalAlpha = theme.stars ? 0.28 : 0.4;
  drawOrbDisk(cx, cy, radius + step * 2, step, theme.glow);
  GCTX.globalAlpha = 1;
  drawOrbDisk(cx, cy, radius, step, theme.orb);

  if (!theme.stars) {
    GCTX.globalAlpha = 0.18;
    GCTX.fillStyle = theme.bands[2];
    GCTX.fillRect(0, cy + Math.floor(radius * 0.3), GCANVAS.width, step * 2);
    GCTX.globalAlpha = 1;
  }
}

function drawStars(now) {
  for (const star of STAR_FIELD) {
    const twinkle = 0.28 + 0.72 * ((Math.sin(now * 0.002 + star.phase) + 1) * 0.5);
    GCTX.globalAlpha = twinkle;
    GCTX.fillStyle = '#ffffff';
    GCTX.fillRect(
      Math.floor(star.x * GCANVAS.width),
      Math.floor(star.y * GCANVAS.height),
      star.size,
      star.size
    );
  }
  GCTX.globalAlpha = 1;
}

function parallaxWorldX(fixedX, ratio) {
  return fixedX + camera.x * (1 - ratio);
}

function drawParallaxSprites(sprite, positions, y, ratio, now, wobble, flipEvery) {
  const patternWidth = positions[positions.length - 1] + 140;
  const reps = Math.ceil((VIEW_W_LOGICAL() + patternWidth * 2) / patternWidth) + 2;
  const baseRep = Math.floor((camera.x * ratio) / patternWidth) - 1;

  for (let rep = baseRep; rep < baseRep + reps; rep++) {
    for (let i = 0; i < positions.length; i++) {
      const fixedX = positions[i] + rep * patternWidth;
      const bob = wobble ? Math.sin(now * 0.0015 + fixedX * 0.04) * wobble : 0;
      const flip = flipEvery ? ((rep + i) % 2 === 1) : false;
      _drawSprite(sprite, parallaxWorldX(fixedX, ratio), y + bob, camera, flip);
    }
  }
}

function drawParallaxSpriteVariants(sprites, positions, y, ratio, now, wobble, flipEvery) {
  const patternWidth = positions[positions.length - 1] + 140;
  const reps = Math.ceil((VIEW_W_LOGICAL() + patternWidth * 2) / patternWidth) + 2;
  const baseRep = Math.floor((camera.x * ratio) / patternWidth) - 1;

  for (let rep = baseRep; rep < baseRep + reps; rep++) {
    for (let i = 0; i < positions.length; i++) {
      const sprite = sprites[Math.abs(rep + i) % sprites.length];
      const fixedX = positions[i] + rep * patternWidth;
      const bob = wobble ? Math.sin(now * 0.0015 + fixedX * 0.04) * wobble : 0;
      const flip = flipEvery ? ((rep + i) % 2 === 1) : false;
      _drawSprite(sprite, parallaxWorldX(fixedX, ratio), y + bob, camera, flip);
    }
  }
}

function fillWorldRect(wx, wy, ww, wh) {
  const s = _cameraScale();
  GCTX.fillRect(
    Math.round((wx - camera.x) * s),
    Math.round((wy - camera.y) * s),
    Math.max(1, Math.round(ww * s)),
    Math.max(1, Math.round(wh * s))
  );
}

function drawWorldPoly(points) {
  const s = _cameraScale();
  GCTX.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const sx = Math.round((p[0] - camera.x) * s);
    const sy = Math.round((p[1] - camera.y) * s);
    if (i === 0) GCTX.moveTo(sx, sy);
    else GCTX.lineTo(sx, sy);
  }
  GCTX.closePath();
  GCTX.fill();
}

function drawMartinaBlock(wx, baseY, w, h, depth, palette, flip) {
  const side = flip ? -depth : depth;
  GCTX.fillStyle = palette.side;
  drawWorldPoly([
    [wx + (flip ? 0 : w), baseY - h + depth],
    [wx + (flip ? side : w + side), baseY - h],
    [wx + (flip ? side : w + side), baseY],
    [wx + (flip ? 0 : w), baseY],
  ]);
  GCTX.fillStyle = palette.main;
  fillWorldRect(wx, baseY - h + depth, w, h - depth);
  GCTX.fillStyle = palette.light;
  fillWorldRect(wx + 2, baseY - h + depth, w - 4, 2);
  GCTX.fillStyle = palette.shade;
  fillWorldRect(wx + Math.floor(w * 0.18), baseY - 11, 5, 9);
  fillWorldRect(wx + Math.floor(w * 0.58), baseY - 13, 4, 7);
}

function drawMasseriaSilhouette(wx, baseY, scale, flip, palette) {
  const unit = scale || 1;
  const sx = (v) => Math.round(v * unit);
  drawMartinaBlock(wx, baseY, sx(50), sx(22), sx(5), palette, flip);
  drawMartinaBlock(wx + sx(42), baseY - sx(2), sx(26), sx(17), sx(4), palette, flip);
  drawMartinaBlock(wx + sx(10), baseY - sx(18), sx(14), sx(24), sx(3), palette, flip);

  GCTX.fillStyle = palette.light;
  fillWorldRect(wx + sx(7), baseY - sx(25), sx(21), sx(3));
  fillWorldRect(wx + sx(40), baseY - sx(22), sx(31), sx(3));
  fillWorldRect(wx + sx(18), baseY - sx(45), sx(12), sx(3));

  GCTX.fillStyle = palette.shade;
  fillWorldRect(wx + sx(8), baseY - sx(12), sx(7), sx(10));
  fillWorldRect(wx + sx(30), baseY - sx(10), sx(9), sx(8));
  fillWorldRect(wx + sx(52), baseY - sx(11), sx(8), sx(7));
}

function drawHouseSilhouette(wx, baseY, scale, flip, palette) {
  const unit = scale || 1;
  const sx = (v) => Math.round(v * unit);
  drawMartinaBlock(wx, baseY, sx(25), sx(20), sx(4), palette, flip);
  drawMartinaBlock(wx + sx(20), baseY + sx(1), sx(23), sx(16), sx(4), palette, flip);
  drawMartinaBlock(wx + sx(36), baseY - sx(7), sx(15), sx(25), sx(3), palette, flip);

  GCTX.fillStyle = palette.light;
  fillWorldRect(wx + sx(3), baseY - sx(22), sx(24), sx(3));
  fillWorldRect(wx + sx(19), baseY - sx(17), sx(25), sx(3));
  fillWorldRect(wx + sx(35), baseY - sx(32), sx(18), sx(3));

  GCTX.fillStyle = palette.shade;
  fillWorldRect(wx + sx(8), baseY - sx(12), sx(5), sx(8));
  fillWorldRect(wx + sx(27), baseY - sx(9), sx(5), sx(6));
  fillWorldRect(wx + sx(41), baseY - sx(20), sx(4), sx(7));
}

function drawMartinaSilhouettes(theme, positions, baseY, ratio, scale, alpha, variantOffset) {
  const palette = theme.silhouette;
  if (!palette) return;
  const patternWidth = positions[positions.length - 1] + 190;
  const reps = Math.ceil((VIEW_W_LOGICAL() + patternWidth * 2) / patternWidth) + 2;
  const baseRep = Math.floor((camera.x * ratio) / patternWidth) - 1;

  GCTX.save();
  GCTX.globalAlpha = alpha;
  for (let rep = baseRep; rep < baseRep + reps; rep++) {
    for (let i = 0; i < positions.length; i++) {
      const fixedX = positions[i] + rep * patternWidth;
      const wx = parallaxWorldX(fixedX, ratio);
      const flip = ((rep + i + variantOffset) % 2) === 1;
      if ((i + variantOffset) % 2 === 0) {
        drawMasseriaSilhouette(wx, baseY, scale, flip, palette);
      } else {
        drawHouseSilhouette(wx, baseY + 2, scale, flip, palette);
      }
    }
  }
  GCTX.restore();
  GCTX.globalAlpha = 1;
}

function drawBackground(now) {
  const theme = currentTheme();
  drawSky(theme);
  if (theme.stars) drawStars(now);
  drawOrb(theme);

  const cloudSet = [SPRITES.cloud, SPRITES.cloud_2, SPRITES.cloud_3];
  drawParallaxSpriteVariants(cloudSet, BG_LAYOUT.cloudsFar, 20, 0.12, now, 0.8, true);
  drawParallaxSpriteVariants(cloudSet, BG_LAYOUT.cloudsNear, 44, 0.22, now, 1.2, false);
  drawMartinaSilhouettes(theme, BG_LAYOUT.buildingsFar, (world.H - 2) * 16, 0.18, 1.12, 0.24, 0);
  drawMartinaSilhouettes(theme, BG_LAYOUT.buildingsNear, (world.H - 2) * 16, 0.30, 1.26, 0.34, 1);
  drawParallaxSprites(SPRITES.bush, BG_LAYOUT.bushes, (world.H - 3) * 16 + 1, 0.58, now, 0, true);

  GCTX.globalAlpha = 0.08;
  GCTX.fillStyle = '#ffffff';
  GCTX.fillRect(0, Math.floor(GCANVAS.height * 0.66), GCANVAS.width, Math.max(6, _cameraScale() * 2));
  GCTX.globalAlpha = 1;
}

function drawTiles() {
  const left = Math.max(0, Math.floor(camera.x / 16) - 1);
  const right = Math.min(world.W, Math.ceil((camera.x + VIEW_W_LOGICAL()) / 16) + 1);
  for (let y = 0; y < world.H; y++) {
    for (let x = left; x < right; x++) {
      const t = world.tiles[y][x];
      if (!t) continue;
      if (isPranked(x, y)) continue;     // disegnato spostato da drawPranks
      let spr = null;
      if (t === '#') spr = isSolid(x, y - 1) ? SPRITES.tile_ground_fill : SPRITES.tile_ground;
      else if (t === '=') spr = SPRITES.tile_brick;
      else if (t === '?') spr = SPRITES.tile_question;
      else if (t === 'U') spr = SPRITES.tile_used;
      if (spr) _drawSprite(spr, x * 16, y * 16, camera);
    }
  }
}

function drawCoins(now) {
  const frame = Math.floor(now / 110) % 4;
  const sprName = ['coin_1','coin_2','coin_3','coin_4'][frame];
  for (const c of world.coins) {
    if (c.taken) continue;
    _drawSprite(SPRITES[sprName], c.tx * 16 + 2, c.ty * 16 + 1, camera);
  }
}

function shadowSurfaceY(ent) {
  const center = ent.x + ent.w * 0.5;
  const left = Math.floor((center - 2) / 16);
  const right = Math.floor((center + 2) / 16);
  const startTy = Math.max(0, Math.floor((ent.y + ent.h) / 16));
  for (let ty = startTy; ty < world.H; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tx, ty)) return ty * 16;
    }
  }
  return ent.y + ent.h + 6;
}

function drawShadow(ent, widthPad) {
  const groundY = shadowSurfaceY(ent);
  const distance = Math.max(0, groundY - (ent.y + ent.h));
  if (distance > 28) return;

  const isPlayer = ent === Player;
  const s = _cameraScale();
  const cx = Math.round((ent.x + ent.w * 0.5 - camera.x) * s);
  const cy = Math.round((groundY - camera.y) * s);
  const w = Math.max(6, Math.round((ent.w + widthPad - distance * (isPlayer ? 0.22 : 0.28)) * s));
  const px = Math.max(1, Math.round(s));

  GCTX.globalAlpha = isPlayer
    ? Math.max(0.18, 0.42 - distance * 0.012)
    : Math.max(0.12, 0.32 - distance * 0.010);
  GCTX.fillStyle = '#1c1530';
  // Flat chiaroscuro shadow sitting ON the ground surface (not lifted).
  const halfW = Math.floor(w / 2);
  const midW = Math.max(2, Math.floor(w * 0.7));
  const halfMid = Math.floor(midW / 2);
  GCTX.fillRect(cx - halfW, cy, w, px);
  GCTX.fillRect(cx - halfMid, cy + px, midW, px);
  GCTX.globalAlpha = 1;
}

function drawShadows() {
  for (const it of items) {
    if (it._taken) continue;
    drawShadow(it, 2);
  }
  for (const en of world.enemies) {
    if (!en.alive) continue;
    drawShadow(en, en.kind === 'chomper' ? 10 : 4);
  }
  if (!Player.dead) drawShadow(Player, 6);
}

function drawEnemies(now) {
  for (const en of world.enemies) {
    if (!en.alive) {
      if (en.squashedAt < 600 && en.kind === 'bloop') {
        _drawSprite(SPRITES.bloop_squash, en.x, en.y, camera);
      }
      continue;
    }
    const flip = en.vx > 0;
    if (en.kind === 'bloop') {
      const f = Math.floor(now / 220) % 2;
      _drawSprite(f ? SPRITES.bloop_2 : SPRITES.bloop_1, en.x, en.y, camera, flip);
    } else if (en.kind === 'sproink') {
      _drawSprite(en.onGround ? SPRITES.sproink_1 : SPRITES.sproink_jump, en.x, en.y, camera, flip);
    } else if (en.kind === 'chomper') {
      const f = Math.floor(now / 200) % 2;
      _drawSprite(f ? SPRITES.chomper_2 : SPRITES.chomper_1, en.x, en.y, camera, flip);
    }
  }
}

function drawFlags() {
  for (const f of world.flags) {
    const baseY = f.ty * 16;
    _drawSprite(SPRITES.flag_top,  f.tx * 16, baseY - 64, camera);
    _drawSprite(SPRITES.flag_pole, f.tx * 16, baseY - 48, camera);
    _drawSprite(SPRITES.flag_pole, f.tx * 16, baseY - 32, camera);
    _drawSprite(SPRITES.flag_base, f.tx * 16, baseY - 16, camera);
  }
  if (world.princess) {
    _drawSprite(SPRITES[currentHero().goalSprite], world.princess.x, world.princess.y, camera);
  }
}

function drawPlayer(now) {
  const hero = currentHero();
  const isPrince = Player.prince > 0 && !!hero.poweredSprites;
  // Sprite is 16w x 20h; collision is 12w x 14h, but the art reads better slightly lower.
  const ox = -2, oy = -4;
  if (Player.dead) {
    const deadSpriteKey = isPrince ? hero.poweredSprites.jump : hero.playerSprites.jump;
    _drawSprite(SPRITES[deadSpriteKey], Player.x + ox, Player.y + oy, camera, false);
    return;
  }
  const flip = Player.dir < 0;
  const activeSet = isPrince ? hero.poweredSprites : hero.playerSprites;
  let spriteKey;
  if (isPrince) {
    if (!Player.onGround) spriteKey = activeSet.jump;
    else if (Math.abs(Player.vx) > 0.4) {
      spriteKey = (Math.floor(Player.anim / 6) % 2) ? activeSet.run2 : activeSet.run1;
    } else spriteKey = activeSet.idle;
    if (Player.prince < 3000 && Math.floor(Player.prince / 100) % 2) {
      GCTX.globalAlpha = 0.55;
    }
    _drawSprite(SPRITES[spriteKey], Player.x + ox, Player.y + oy, camera, flip);
    GCTX.globalAlpha = 1;
  } else {
    if (!Player.onGround) spriteKey = activeSet.jump;
    else if (Math.abs(Player.vx) > 0.4) {
      spriteKey = (Math.floor(Player.anim / 6) % 2) ? activeSet.run2 : activeSet.run1;
    } else spriteKey = activeSet.idle;
    if (Player.invuln > 0 && Math.floor(Player.invuln / 60) % 2) return;
    _drawSprite(SPRITES[spriteKey], Player.x + ox, Player.y + oy, camera, flip);
  }
}

function drawItems(now) {
  for (const it of items) {
    if (it._taken) continue;
    const bob = Math.sin(it.t / 200) * 1;
    if (it.kind === 'limoncello') {
      _drawSprite(SPRITES.limoncello, it.x - 1, it.y + bob, camera);
    } else if (it.kind === 'corno') {
      _drawSprite(SPRITES.corno, it.x - 1, it.y + bob, camera);
    }
  }
}

function updateCoinRain(dt) {
  for (const c of coinRain) {
    if (c.taken) continue;
    if (!c.landed) {
      c.vy = Math.min(6.5, c.vy + 0.42); // fast gravity
      c.y += c.vy;
      c.x += c.vx;
      // Landing check: compare against ground tile
      const tx = Math.floor((c.x + 5) / 16);
      const ty = Math.floor((c.y + 12) / 16);
      if (isSolid(tx, ty)) {
        c.y = ty * 16 - 12;
        c.landed = true;
        c.vx = 0; c.vy = 0;
        c.t = 0;
      } else if (c.y > (world.H + 4) * 16) {
        c.taken = true; // off-bottom
      }
    } else {
      c.t += dt;
      if (c.t > c.restAfter) c.taken = true;
    }
    if (!c.taken) {
      const cb = { x: c.x, y: c.y, w: 8, h: 12 };
      if (rectsOverlap(Player, cb)) {
        c.taken = true;
        State.coins++;
        State.totalCoinsRun++;
        playSfx('coin');
      }
    }
  }
  for (let i = coinRain.length - 1; i >= 0; i--) {
    if (coinRain[i].taken) coinRain.splice(i, 1);
  }
}

function drawCoinRain(now) {
  if (!coinRain.length) return;
  const frame = Math.floor(now / 110) % 4;
  const sprName = ['coin_1','coin_2','coin_3','coin_4'][frame];
  const spr = SPRITES[sprName];
  for (const c of coinRain) {
    if (c.taken) continue;
    let y = c.y;
    if (c.landed) {
      // Coin sits with a gentle hover and blinks out near end of life.
      const remain = c.restAfter - c.t;
      if (remain < 1500 && Math.floor(remain / 120) % 2) continue;
      y += Math.sin((c.t + c.animOff * 250) / 220) * 0.6;
    }
    _drawSprite(spr, c.x, y, camera);
  }
}

function drawFloaters() {
  const s = _cameraScale();
  // Hearts first, behind floaters
  for (const h of hearts) {
    if (h.delay > 0) continue;
    const fade = Math.min(1, 1 - (h.t / h.life));
    GCTX.globalAlpha = Math.max(0, fade);
    _drawSprite(SPRITES.heart, h.x, h.y, camera);
    GCTX.globalAlpha = 1;
  }
  GCTX.textBaseline = 'top';
  for (const f of floaters) {
    if (f.delay > 0) continue;
    const fade = Math.max(0, 1 - f.t / f.life);
    if (fade <= 0) continue;
    const fontSize = (f.size || 9);
    GCTX.font = (fontSize * s) + 'px "VT323", "Courier New", monospace';
    const x = (f.x - camera.x) * s;
    const y = (f.y - camera.y - f.t * f.vy) * s;
    GCTX.globalAlpha = fade;
    GCTX.fillStyle = '#1a1418';
    GCTX.fillText(f.text, x + 2, y + 2);
    GCTX.fillStyle = f.color || '#FFCE3B';
    GCTX.fillText(f.text, x, y);
    GCTX.globalAlpha = 1;
  }
}

function updateHud() {
  const level = currentLevelMeta();
  document.getElementById('hud-name').textContent =
    State.playerName !== 'PLAYER' ? State.playerName : currentHero().hudLabel;
  document.getElementById('lives').textContent = 'x' + State.lives;
  document.getElementById('coins').textContent = String(State.coins).padStart(2, '0');
  document.getElementById('world').textContent = level.code || '1-1';
  document.getElementById('time').textContent = Math.max(0, Math.ceil(State.time));

  const pt = document.getElementById('prince-timer');
  if (Player.prince > 0) {
    const sec = Math.max(1, Math.ceil(Player.prince / 1000));
    const isSabri = State.heroKey === 'sabrina';
    document.getElementById('prince-timer-label').textContent = isSabri ? 'PRINCESS' : 'PRINCE';
    document.getElementById('prince-timer-clock').textContent = String(sec);
    pt.classList.remove('hidden');
    pt.classList.toggle('warn', Player.prince <= 3000);
  } else if (!pt.classList.contains('hidden')) {
    pt.classList.add('hidden');
    pt.classList.remove('warn');
  }
}

function showBanner(t, s, ms) {
  ms = ms || 1500;
  const b = document.getElementById('banner');
  document.getElementById('banner-t').textContent = t;
  document.getElementById('banner-s').textContent = s;
  b.classList.remove('hidden');
  State.banner = { until: performance.now() + ms };
}
function tickBanner() {
  if (!State.banner) return;
  if (performance.now() > State.banner.until) {
    document.getElementById('banner').classList.add('hidden');
    State.banner = null;
  }
}

function startLevel(idx) {
  State.levelIndex = idx;
  State.coins = 0;
  State.levelStartCoinsRun = State.totalCoinsRun;
  State.time = LEVELS[idx].timeLimit;
  world = buildWorld(LEVELS[idx]);
  applyTheme(LEVELS[idx]);
  playLevelMusic(idx);
  resetPlayer();
  camera.x = 0;
  floaters.length = 0;
  items.length = 0;
  hearts.length = 0;
  sparkles.length = 0;
  coinRain.length = 0;
  dustPoofs.length = 0;
  cat = null;
  catBubble = null;
  pranks.length = 0;
  _prankIndex.clear();
  prankCooldownUntil = performance.now() + 4000;     // primo dispetto possibile dopo 4s
  prankSeenTile = null;
  scheduleNextCatVisit(performance.now());
  State.flash = 0;
  State.shake = 0;
  if (A && typeof A.setTempoMultiplier === 'function') A.setTempoMultiplier(1.0);
  document.getElementById('title').classList.add('hidden');
  document.getElementById('name-entry').classList.add('hidden');
  document.getElementById('dead').classList.add('hidden');
  document.getElementById('win').classList.add('hidden');
  showBanner(
    LEVELS[idx].code + ' - ' + LEVELS[idx].name.toUpperCase(),
    idx === 2 ? 'Reach ' + currentHero().rescueName + ' at the end of the run.' : LEVELS[idx].subtitle
  );
  State.running = true;
  State.startedAt = performance.now();
  if (!State.runStartedAt) State.runStartedAt = State.startedAt;
  setTimeout(ensureLevelMusic, 250);
}

function onPlayerWin() {
  if (Player.winHandled) return;
  Player.winHandled = true;
  if (State.levelIndex < LEVELS.length - 1) {
    // Jingle di vittoria al flag → poi carica il prossimo livello.
    if (A && typeof A.playVictoryJingle === 'function') A.playVictoryJingle();
    setTimeout(function () { startLevel(State.levelIndex + 1); }, 2200);
  } else {
    // Finale: principe/principessa salvati. Pioggia di cuori + jingle.
    if (A && typeof A.playVictoryJingle === 'function') A.playVictoryJingle();
    spawnHeartShower();
    setTimeout(function () {
      State.running = false;
      stopMusic();
      const stats = finalRunStats();
      document.getElementById('win-headline').textContent =
        currentHero().name + ' ha salvato ' + currentHero().rescueName + '!';
      document.getElementById('win').classList.remove('hidden');
      updateScoreUi(stats, 'SCORE READY', 'win');
      submitFinalScore(stats);
    }, 2400);
  }
}

function spawnHeartShower() {
  // Pioggia di ~30 cuori che cadono dal cielo lentamente
  const left = camera.x - 24;
  const right = camera.x + E.VIEW_W_TILES * 16 + 24;
  for (let i = 0; i < 32; i++) {
    hearts.push({
      x: left + (right - left) * (i / 32) + (Math.random() - 0.5) * 18,
      y: camera.y - 8 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 0.2,
      vy: 0.4 + Math.random() * 0.6,
      t: 0,
      delay: i * 60 + Math.random() * 200,
      life: 4500 + Math.random() * 800,
    });
  }
  // Anche un grande floater di vittoria
  spawnFloater('VITTORIA!', Player.x - 22, Player.y - 28, {
    life: 3200, vy: 0.012, size: 14, color: '#ffd65d',
  });
  State.flash = 360;
  State.shake = 280;
}

function onPlayerDie() {
  if (Player.deadHandled) return;
  Player.deadHandled = true;
  State.running = false;
  stopMusic();
  if (State.lives <= 0) {
    const stats = finalRunStats('game-over');
    document.getElementById('dead-sub').textContent = gameOverMessage();
    updateScoreUi(stats, 'SCORE READY', 'dead', 'dead-stats');
    submitFinalScore(stats, 'dead-save', 'dead');
  } else {
    document.getElementById('dead-sub').textContent = State._deathReason || pickDeath('enemy');
    document.getElementById('dead-score').classList.add('hidden');
    document.getElementById('dead-stats').classList.add('hidden');
    document.getElementById('dead-save').classList.add('hidden');
  }
  document.getElementById('dead').classList.remove('hidden');
}

let lastT = performance.now();
function loop(now) {
  const dt = Math.min(40, now - lastT);
  lastT = now;

  if (State.running && !State.paused) {
    if (!Player.dead && !Player.won) {
      if (_Input.left)  { Player.vx -= ACCEL; Player.dir = -1; }
      if (_Input.right) { Player.vx += ACCEL; Player.dir =  1; }
      if (!_Input.left && !_Input.right) Player.vx *= FRICTION;
      if (Player.vx >  RUN_MAX) Player.vx =  RUN_MAX;
      if (Player.vx < -RUN_MAX) Player.vx = -RUN_MAX;
      if (Math.abs(Player.vx) < 0.05) Player.vx = 0;
      if (_Input.jumpPressed && Player.onGround) {
        Player.vy = JUMP_V;
        Player.onGround = false;
        playSfx('jump');
      }
      if (_Input.jump && Player.vy < 0) Player.vy += JUMP_HOLD;
    }
    _Input.jumpPressed = false;

    if (Player.dead) {
      Player.deadT += dt;
      Player.y += Player.vy;
      Player.vy += GRAVITY;
      if (Player.deadT > 1500) onPlayerDie();
    } else if (Player.won && world.flags.length && Player.finishingPole) {
      Player.winT += dt;
      Player.vx = 0;
      if (Player.winT < 700) {
        Player.y += 1.6;
        const fy = world.flags[0].ty * 16 - 24;
        if (Player.y > fy) Player.y = fy;
      } else {
        Player.vx = 1.5;
        Player.x += Player.vx;
        if (Player.winT > 1500) onPlayerWin();
      }
    } else if (Player.won) {
      Player.winT += dt;
      if (Player.winT > 1200) onPlayerWin();
    } else {
      moveAndCollide(Player, dt);
      Player.anim += Math.abs(Player.vx);
      if (Player.invuln > 0) Player.invuln -= dt;
    }

    for (const en of world.enemies) updateEnemy(en, dt);
    updateItems(dt);
    updateCoinRain(dt);
    trySpawnCat(now);
    updateCat(dt);
    updateDustPoofs(dt);
    tryPrank(now);
    updatePranks(dt);
    if (catBubble) {
      catBubble.t += dt;
      if (catBubble.t > catBubble.life) catBubble = null;
    }

    if (Player.prince > 0) {
      Player.prince -= dt;
      if (Player.prince <= 0 && A && typeof A.setTempoMultiplier === 'function') {
        A.setTempoMultiplier(1.0);
      }
    }
    if (!Player.dead && !Player.won) handleCollisions();

    for (const f of floaters) {
      if (f.delay > 0) { f.delay -= dt; continue; }
      f.t += dt;
    }
    for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].t > floaters[i].life) floaters.splice(i, 1);

    for (const h of hearts) {
      h.delay -= dt;
      if (h.delay > 0) continue;
      h.t += dt;
      h.x += h.vx;
      h.y += h.vy;
      h.vy += 0.005; // very gentle gravity
    }
    for (let i = hearts.length - 1; i >= 0; i--) {
      if (hearts[i].t > hearts[i].life) hearts.splice(i, 1);
    }

    for (const sp of sparkles) {
      sp.t += dt;
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.vy += 0.06;     // gentle gravity for sparkles
      sp.vx *= 0.985;
      sp.twinkle += dt * 0.02;
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      if (sparkles[i].t > sparkles[i].life) sparkles.splice(i, 1);
    }

    if (State.flash > 0) State.flash = Math.max(0, State.flash - dt);
    if (State.shake > 0) State.shake = Math.max(0, State.shake - dt);

    State.time -= dt / 1000;
    if (State.time <= 0 && !Player.dead && !Player.won) killPlayer(pickDeath('time'));

    updateCamera();
  }

  GCTX.clearRect(0, 0, GCANVAS.width, GCANVAS.height);
  if (world) {
    GCTX.save();
    if (State.shake > 0) {
      const mag = Math.min(6, State.shake / 60);
      GCTX.translate(
        Math.round((Math.random() - 0.5) * mag * 2),
        Math.round((Math.random() - 0.5) * mag * 2)
      );
    }
    drawBackground(now);
    drawTiles();
    drawPranks();
    drawShadows();
    drawCoins(now);
    drawFlags();
    drawEnemies(now);
    drawItems(now);
    drawCoinRain(now);
    drawCat(now);
    drawPlayer(now);
    drawDustPoofs();
    drawSparkles();
    drawFloaters();
    drawCatBubble();
    GCTX.restore();

    if (State.flash > 0) {
      const a = Math.min(1, State.flash / 260);
      GCTX.globalAlpha = a;
      GCTX.fillStyle = '#ffffff';
      GCTX.fillRect(0, 0, GCANVAS.width, GCANVAS.height);
      GCTX.globalAlpha = 1;
    }
  }

  tickBanner();
  updateHud();
  updateAudioButton();
  requestAnimationFrame(loop);
}

function drawSparkles() {
  if (!sparkles.length) return;
  const s = _cameraScale();
  for (const sp of sparkles) {
    const fade = 1 - sp.t / sp.life;
    if (fade <= 0) continue;
    const flicker = 0.6 + 0.4 * Math.sin(sp.twinkle);
    GCTX.globalAlpha = Math.max(0, fade) * flicker;
    GCTX.fillStyle = sp.hue;
    const px = Math.round((sp.x - camera.x) * s);
    const py = Math.round((sp.y - camera.y) * s);
    const sz = Math.max(1, Math.round(sp.size * s));
    // 4-point star: center + 4 cardinal blocks
    GCTX.fillRect(px - Math.floor(sz / 2), py - Math.floor(sz / 2), sz, sz);
    GCTX.fillRect(px - sz, py, Math.max(1, sz / 2), 1);
    GCTX.fillRect(px + Math.ceil(sz / 2), py, Math.max(1, sz / 2), 1);
    GCTX.fillRect(px, py - sz, 1, Math.max(1, sz / 2));
    GCTX.fillRect(px, py + Math.ceil(sz / 2), 1, Math.max(1, sz / 2));
  }
  GCTX.globalAlpha = 1;
}

function init() {
  E.resize();
  E.bindKeys();
  E.bindTouch();
  applyTheme(LEVELS[0]);
  setHero('otto');

  const tryUnlockAudio = function () {
    unlockAudio().then(ensureLevelMusic);
  };
  window.addEventListener('pointerdown', tryUnlockAudio, { passive: true });
  window.addEventListener('touchstart', tryUnlockAudio, { passive: true });
  window.addEventListener('mousedown', tryUnlockAudio, { passive: true });
  window.addEventListener('keydown', tryUnlockAudio);

  const audioButton = document.getElementById('btn-audio');
  if (audioButton) {
    audioButton.addEventListener('pointerdown', requestAudioFromGesture, { passive: false });
    audioButton.addEventListener('touchend', requestAudioFromGesture, { passive: false });
    audioButton.addEventListener('click', requestAudioFromGesture);
  }

  document.querySelectorAll('#title .btn[data-hero]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      unlockAudio();
      setHero(btn.dataset.hero || 'otto');
      showNameEntry();
    });
  });
  document.getElementById('name-form').addEventListener('submit', function (event) {
    event.preventDefault();
    unlockAudio();
    startRunFromName();
  });
  document.getElementById('btn-name-back').addEventListener('click', function () {
    document.getElementById('name-entry').classList.add('hidden');
    document.getElementById('title').classList.remove('hidden');
    setNameError('');
  });
  document.getElementById('btn-retry').addEventListener('click', function () {
    unlockAudio();
    if (State.lives <= 0) {
      State.lives = 3;
      State.totalCoinsRun = 0;
      State.scoreSubmitted = false;
      State.runStartedAt = performance.now();
      startLevel(0);
    } else {
      startLevel(State.levelIndex);
    }
  });
  document.getElementById('btn-again').addEventListener('click', function () {
    unlockAudio();
    showTitle();
  });

  const params = new URLSearchParams(window.location.search);
  if (params.has('hero')) {
    setHero(params.get('hero'));
  }
  if (params.has('autostart')) {
    setPlayerName(normalizePlayerName(params.get('name') || 'TEST PLAYER'), normalizePlayerName(params.get('name') || 'TEST PLAYER'));
    State.scoreToken = null;
    State.scoreSubmitted = false;
    State.scoreOffline = true;
    State.lives = 3;
    State.totalCoinsRun = 0;
    State.runStartedAt = performance.now();
    startLevel(Math.min(LEVELS.length - 1, Math.max(0, parseInt(params.get('level') || '0', 10) || 0)));
  }

  requestAnimationFrame(loop);
}

window.addEventListener('load', init);
