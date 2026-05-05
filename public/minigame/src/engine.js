/* ============================================================
   ENGINE — canvas, sprite drawing, input, camera
============================================================ */

const PX = 3;          // canvas pixels per logical sprite pixel
const TILE = 16;       // logical pixels per tile side
const TILE_PX = TILE * PX;   // canvas pixels per tile
const VIEW_W_TILES = 16;     // logical viewport width in tiles
const VIEW_H_TILES = 14;     // logical viewport height in tiles

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
let resizeFrame = 0;
const spriteCache = new WeakMap();

/* Resize canvas to fit viewport while keeping fixed logical size */
function resize() {
  const stage = document.getElementById('game');
  const W = Math.max(1, Math.floor(canvas.clientWidth || stage.clientWidth));
  const H = Math.max(1, Math.floor(canvas.clientHeight || stage.clientHeight));

  if (canvas.width === W && canvas.height === H) return;

  // Internal canvas resolution = logical * PX. We then scale via CSS.
  // We want the camera to show a fixed number of tiles; pick PX so the
  // canvas fits cleanly. Use the rendered canvas size directly and
  // compute scale on the fly during draw.
  canvas.width  = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;
}

function scheduleResize() {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(function () {
    resizeFrame = 0;
    resize();
  });
}

window.addEventListener('resize', scheduleResize, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', scheduleResize, { passive: true });
}

/* ----- sprite drawing ----- */
/* Draw a sprite (2D char grid) at logical (x,y) in WORLD coordinates,
   given a camera. flip flips horizontally. scale = pixel size. */
function drawSprite(grid, wx, wy, camera, flip = false, scale = null) {
  if (!grid) return;
  const s = Math.max(1, Math.round(scale || cameraScale()));
  const sx = Math.round((wx - camera.x) * s);
  const sy = Math.round((wy - camera.y) * s);
  ctx.drawImage(spriteCanvas(grid, s, flip, false), sx, sy);
}

/* Hi-res sprite: each grid cell = 0.5 logical pixel.
   Use this for character/enemy sprites that want 2x detail
   inside the same world-space footprint as a normal sprite. */
function drawSpriteHi(grid, wx, wy, camera, flip = false) {
  if (!grid) return;
  const s = Math.max(1, Math.round(cameraScale()));
  const sx = Math.round((wx - camera.x) * s);
  const sy = Math.round((wy - camera.y) * s);
  ctx.drawImage(spriteCanvas(grid, s, flip, true), sx, sy);
}

/* Camera scale: how many canvas pixels per logical pixel.
   We size the world so the viewport shows ~VIEW_H_TILES tiles tall. */
function cameraScale() {
  // pick the largest integer scale that keeps the intended 14-tile-tall framing.
  return Math.max(2, Math.floor(canvas.height / (VIEW_H_TILES * TILE)));
}

/* Convert world tile coords to logical pixels */
function tilePx(t) { return t * TILE; }

function spriteCanvas(grid, scale, flip, hiRes) {
  let byGrid = spriteCache.get(grid);
  if (!byGrid) {
    byGrid = new Map();
    spriteCache.set(grid, byGrid);
  }

  const key = scale + ':' + (flip ? 1 : 0) + ':' + (hiRes ? 1 : 0);
  const cached = byGrid.get(key);
  if (cached) return cached;

  const h = grid.length;
  const w = grid[0].length;
  const cell = hiRes ? scale / 2 : scale;
  const px = hiRes ? Math.ceil(cell) : scale;
  const out = document.createElement('canvas');
  out.width = hiRes ? Math.ceil((w - 1) * cell + px) : w * scale;
  out.height = hiRes ? Math.ceil((h - 1) * cell + px) : h * scale;

  const outCtx = out.getContext('2d');
  outCtx.imageSmoothingEnabled = false;
  for (let r = 0; r < h; r++) {
    const row = grid[r];
    for (let c = 0; c < w; c++) {
      const color = PALETTE[row[c]];
      if (!color) continue;
      const cx = flip ? (w - 1 - c) : c;
      outCtx.fillStyle = color;
      if (hiRes) {
        outCtx.fillRect(Math.round(cx * cell), Math.round(r * cell), px, px);
      } else {
        outCtx.fillRect(cx * scale, r * scale, scale, scale);
      }
    }
  }

  byGrid.set(key, out);
  return out;
}

/* ----- Input ----- */
const Input = {
  left: false, right: false, jump: false, jumpPressed: false,
  _jumpWas: false,
};

function isTextEntryTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function bindKeys() {
  const onDown = (e) => {
    if (isTextEntryTarget(e.target)) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') Input.left = true;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') Input.right = true;
    else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'z' || k === 'Z') {
      if (!Input.jump) Input.jumpPressed = true;
      Input.jump = true;
      e.preventDefault();
    }
  };
  const onUp = (e) => {
    if (isTextEntryTarget(e.target)) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') Input.left = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') Input.right = false;
    else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'z' || k === 'Z') {
      Input.jump = false;
    }
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
}

/* Touch zones */
function bindTouch() {
  const game = document.getElementById('game');
  const touch = document.getElementById('touch');
  const moveZone = document.getElementById('zone-move');
  const jumpZone = document.getElementById('zone-jump');
  const leftButton = document.getElementById('btn-left');
  const rightButton = document.getElementById('btn-right');
  const jumpButton = document.getElementById('btn-jump');

  // show touch UI on coarse pointers OR small viewports
  const isTouch = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
  if (!isTouch || !game || !touch || !moveZone || !jumpZone || !leftButton || !rightButton || !jumpButton) return;
  touch.classList.add('show');

  const activePointers = new Map();

  const pointIn = (zone, x, y) => {
    const rect = zone.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const keyForPoint = (ev) => {
    if (pointIn(jumpZone, ev.clientX, ev.clientY)) return 'jump';
    if (!pointIn(moveZone, ev.clientX, ev.clientY)) return null;
    const rect = moveZone.getBoundingClientRect();
    return ev.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
  };

  const syncInput = () => {
    const wasJump = Input.jump;
    Input.left = false;
    Input.right = false;
    Input.jump = false;

    activePointers.forEach((key) => {
      Input[key] = true;
    });

    if (Input.jump && !wasJump) Input.jumpPressed = true;
    if (leftButton) leftButton.classList.toggle('active', Input.left);
    if (rightButton) rightButton.classList.toggle('active', Input.right);
    if (jumpButton) jumpButton.classList.toggle('active', Input.jump);
  };

  const clearPointer = (id) => {
    if (!activePointers.has(id)) return;
    activePointers.delete(id);
    syncInput();
  };

  const clearAll = () => {
    activePointers.clear();
    Input.left = false;
    Input.right = false;
    Input.jump = false;
    if (leftButton) leftButton.classList.remove('active');
    if (rightButton) rightButton.classList.remove('active');
    if (jumpButton) jumpButton.classList.remove('active');
  };

  game.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' || ev.target.closest('.overlay')) return;
    const key = keyForPoint(ev);
    if (!key) return;
    ev.preventDefault();
    activePointers.set(ev.pointerId, key);
    try { game.setPointerCapture(ev.pointerId); } catch (_) {}
    syncInput();
  }, { passive: false });

  game.addEventListener('pointermove', (ev) => {
    if (!activePointers.has(ev.pointerId)) return;
    ev.preventDefault();
    const key = keyForPoint(ev);
    if (key) activePointers.set(ev.pointerId, key);
    else activePointers.delete(ev.pointerId);
    syncInput();
  }, { passive: false });

  game.addEventListener('pointerup', (ev) => {
    if (!activePointers.has(ev.pointerId)) return;
    ev.preventDefault();
    clearPointer(ev.pointerId);
  }, { passive: false });

  game.addEventListener('pointercancel', (ev) => {
    if (!activePointers.has(ev.pointerId)) return;
    ev.preventDefault();
    clearPointer(ev.pointerId);
  }, { passive: false });

  window.addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearAll();
  });
}

window.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.tbtn')) e.preventDefault();
});

window.ENGINE = {
  canvas, ctx, PX, TILE, drawSprite, drawSpriteHi, cameraScale, tilePx,
  resize, Input, bindKeys, bindTouch, VIEW_W_TILES, VIEW_H_TILES,
};
