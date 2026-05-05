/* ============================================================
   SPRITES — 16-bit era pixel art.
   Each sprite is a grid of single-character palette keys.
   Palette has highlights/shadows for proper 16-bit shading.

   Palette key reference is below in PALETTE.
============================================================ */

const PALETTE = {
  '.': null, ' ': null,

  // Outline + neutrals
  'K': '#241a2b',  // soft SNES-style outline
  'k': '#564660',  // inner outline / soft shadow
  'W': '#ffffff',
  'w': '#fff8e7',  // off-white

  // Skin (Otto + Sabrina) — 16-bit shaded
  's': '#f8cda5',  // skin midtone
  'S': '#ffe3c5',  // skin highlight
  'd': '#d49772',  // skin shadow
  'D': '#a86d4b',  // skin deep shadow

  // Otto: clothes
  't': '#242732',  // shirt black
  'T': '#474b57',  // shirt highlight
  'u': '#12151d',  // shirt deep shadow
  'j': '#4675be',  // jeans midtone
  'J': '#284d92',  // jeans shadow
  'i': '#739ddd',  // jeans highlight
  'r': '#f2f3f7',  // sneaker white
  'R': '#d0d1da',  // sneaker shadow
  'q': '#8f92a5',  // sneaker sole

  // Glasses (John Lennon round)
  'g': '#d9f5ff',  // lens shimmer
  'G': '#74c9f2',  // lens midtone

  // Bit — hi-res tabby cat
  '$': '#14110f',  // deepest fur / stripe
  ';': '#2b241f',  // dark tabby stripe
  ':': '#4b3f33',  // mid tabby stripe
  '[': '#66543f',  // fur shadow
  ']': '#8b7457',  // fur mid
  '{': '#b69a74',  // fur highlight
  '}': '#d3c0a0',  // cream shadow
  '=': '#b8c26a',  // Bit eye green-gold

  // Princess Sabrina — black hair, glasses, dress
  'h': '#1a1418',  // hair black
  'H': '#4a3848',  // hair highlight
  'b': '#2a1e2a',  // hair shadow
  // dress: magenta with shading
  'p': '#e25497',  // dress mid
  'P': '#a8336d',  // dress shadow
  'I': '#f78ab8',  // dress highlight
  'O': '#7a1e4a',  // dress deep
  // crown
  'c': '#FFCE3B',  // crown gold mid
  'C': '#ffe066',  // crown highlight
  'Z': '#a07820',  // crown shadow

  // Bloop (purple grumpy)
  'm': '#a058d4',  // body mid
  'M': '#c98aef',  // body highlight
  'n': '#6e3aa0',  // body shadow
  'N': '#3a1860',  // body deep
  'e': '#ffffff',  // eye white
  'E': '#cfd5e0',  // eye shadow

  // Sproink (green silly)
  'v': '#5fcc4f',  // body mid
  'V': '#9ae87a',  // body highlight
  'l': '#358a30',  // body shadow
  'L': '#1c5a18',  // body deep
  'y': '#e8f8a8',  // belly mid
  'Y': '#fcffd6',  // belly highlight

  // Chomper (orange boss-y)
  'o': '#f08a2a',  // body mid
  '0': '#ffb260',  // body highlight  (digit so it's distinct)
  'a': '#b45a10',  // body shadow
  'A': '#7a3a08',  // body deep

  // Coin
  'x': '#FFCE3B',  // coin mid
  'X': '#fff5b8',  // coin highlight
  'z': '#c89a1a',  // coin shadow

  // Tiles
  // Ground
  '1': '#e59a32',  // ground top highlight
  '2': '#c97722',  // ground mid
  '3': '#93501f',  // ground shadow
  '4': '#5c3118',  // ground deep
  '5': '#19b51f',  // grass body
  '6': '#6ded54',  // grass highlight
  // Brick
  '7': '#e89765',  // brick light
  '8': '#C66B3D',  // brick mid
  '9': '#8a3a1c',  // brick shadow
  // Question
  'Q': '#ffe066',  // q-block highlight
  '!': '#f4c33a',  // q-block mid
  '@': '#b8801a',  // q-block shadow
  '#': '#7a4a0a',  // q-block deep
  // Used
  'U': '#8a5a30',
  // Cloud
  'F': '#ffffff',
  'f': '#cfe6ff',
  // Hill / bush
  'V_': null,
  // Flag
  'l_': null,
  'D_': null,
  '~': '#dadada',  // flag pole light
  '`': '#7a7a7a',  // flag pole dark
  '!_': null,
  '*': '#f04a4a',  // flag red
  '+': '#a02020',  // flag red shadow
  // Sun
  'Y_': null,

  // Sky
  '/': '#7ec8ff',  // sky light
  '\\': '#5fa8e8', // sky mid
  '|': '#3f88c8',  // sky deep

  // Prince Charming additions
  'B': '#a0d8ff',  // cape light blue mid
  'b_': null,      // (placeholder, ignore)
  '<': '#dff0ff',  // cape light blue highlight
  '>': '#5fa8e8',  // cape light blue shadow
  '%': '#3f88c8',  // cape deep blue
  '^': '#ffe066',  // blonde mid (matches crown)
  '&': '#fff0a8',  // blonde highlight
  '*': '#f04a4a',  // (already flag red — reuse for cape clasp)

};

function S(rows) { return rows.map(r => r.split('')); }

/* ============================================================
   SUPEROTTO — 32x32 HI-RES (each cell = 0.5 logical pixel,
   so this sprite occupies 16x16 logical pixels = 1 tile).
   Bald, slim John Lennon glasses, black tee, jeans, sneakers.
============================================================ */
const SPR_OTTO_IDLE = S([
  '................',
  '.....KKKKKK.....',
  '....KSSSSSSK....',
  '...KSSSSSSSSK...',
  '...KSsssssssSK..',
  '..KsKgGKKGgKsK..',
  '..KsKGgKKgGKsK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  '..KKttttttttKK..',
  '..KstTTTTTttsK..',
  '...KstttttttK...',
  '....KttttttK....',
  '....KjjJJjjK....',
  '...KjjiJJijK....',
  '...KjjK..KjjK...',
  '..KrRqK..KqRrK..',
  '..KKKK....KKKK..',
  '................',
  '................',
]);

const SPR_OTTO_RUN1 = S([
  '................',
  '.....KKKKKK.....',
  '....KSSSSSSK....',
  '...KSSSSSSSSK...',
  '...KSsssssssSK..',
  '..KsKgGKKGgKsK..',
  '..KsKGgKKgGKsK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  '..KKttttttttKK..',
  '..KstTTTTTTttK..',
  '...KttttttttsK..',
  '....KttttttK....',
  '....KjjJJjjK....',
  '...KjjJJijjK....',
  '..KjjjK..KjjjK..',
  '..KrRjK...KjjK..',
  '..KKKK.....KrRK.',
  '.............KKK',
  '................',
]);

const SPR_OTTO_RUN2 = S([
  '................',
  '.....KKKKKK.....',
  '....KSSSSSSK....',
  '...KSSSSSSSSK...',
  '...KSsssssssSK..',
  '..KsKgGKKGgKsK..',
  '..KsKGgKKgGKsK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  '..KKttttttttKK..',
  '..KttTTTTTTtsK..',
  '...KsttttttttK..',
  '....KttttttK....',
  '....KjjJJjjK....',
  '....KjjiJJK.....',
  '...KjjK...KjjK..',
  '..KrRK.....KjjK.',
  '.KKKK.......KKKK',
  '................',
  '................',
]);

const SPR_OTTO_JUMP = S([
  '................',
  '.....KKKKKK.....',
  '....KSSSSSSK....',
  '...KSSSSSSSSK...',
  '...KSsssssssSK..',
  '..KsKgGKKGgKsK..',
  '..KsKGgKKgGKsK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  '..KstttttttttsK.',
  '..KsTTTTTTTTTsK.',
  '...KtttttttttK..',
  '....KttttttK....',
  '...KjjJJJJjjK...',
  '..KjjjK..KjjjK..',
  '.KjjjK....KjjjK.',
  '.KrRq......KqRr.',
  '..KKK......KKK..',
  '................',
  '................',
]);

/* ============================================================
   SUPER SABRINA — playable 16x20 sprite set.
   Bob haircut, round glasses, magenta top, jeans.
============================================================ */
const SPR_SABRINA_IDLE = S([
  '................',
  '.....KKKKKK.....',
  '....KhhhhhhK....',
  '...KhHhhhhHhK...',
  '...KhhsssssKh...',
  '..KhKgGKKGgKhK..',
  '..KhKGgKKgGKhK..',
  '...KhhddssssdK..',
  '....KhhKssKK....',
  '..KKppppppppKK..',
  '..KsIPPPPPppsK..',
  '...KspppppppK...',
  '....KppppppK....',
  '....KjjJJjjK....',
  '...KjjiJJijK....',
  '...KjjK..KjjK...',
  '..KrRqK..KqRrK..',
  '..KKKK....KKKK..',
  '................',
  '................',
]);

const SPR_SABRINA_RUN1 = S([
  '................',
  '.....KKKKKK.....',
  '....KhhhhhhK....',
  '...KhHhhhhHhK...',
  '...KhhsssssKh...',
  '..KhKgGKKGgKhK..',
  '..KhKGgKKgGKhK..',
  '...KhhddssssdK..',
  '....KhhKssKK....',
  '..KKppppppppKK..',
  '..KpIPPPPPpppK..',
  '...KppppppppK...',
  '....KppppppK....',
  '....KjjJJjjK....',
  '...KjjJJijjK....',
  '..KjjjK..KjjjK..',
  '..KrRjK...KjjK..',
  '..KKKK.....KrRK.',
  '.............KKK',
  '................',
]);

const SPR_SABRINA_RUN2 = S([
  '................',
  '.....KKKKKK.....',
  '....KhhhhhhK....',
  '...KhHhhhhHhK...',
  '...KhhsssssKh...',
  '..KhKgGKKGgKhK..',
  '..KhKGgKKgGKhK..',
  '...KhhddssssdK..',
  '....KhhKssKK....',
  '..KKppppppppKK..',
  '..KppPPPPPPIpK..',
  '...KppppppppK...',
  '....KppppppK....',
  '....KjjJJjjK....',
  '....KjjiJJK.....',
  '...KjjK...KjjK..',
  '..KrRK.....KjjK.',
  '.KKKK.......KKKK',
  '................',
  '................',
]);

const SPR_SABRINA_JUMP = S([
  '................',
  '.....KKKKKK.....',
  '....KhhhhhhK....',
  '...KhHhhhhHhK...',
  '...KhhsssssKh...',
  '..KhKgGKKGgKhK..',
  '..KhKGgKKgGKhK..',
  '...KhhddssssdK..',
  '....KhhKssKK....',
  '..KppppppppppK..',
  '..KpIPPPPPPppK..',
  '...KppppppppK...',
  '....KppppppK....',
  '...KjjJJJJjjK...',
  '..KjjjK..KjjjK..',
  '.KjjjK....KjjjK.',
  '.KrRq......KqRr.',
  '..KKK......KKK..',
  '................',
  '................',
]);

/* ============================================================
   PRINCESS SABRINA — 16-bit, 16w x 24h
   black bob, round glasses, magenta dress, gold crown
============================================================ */
const SPR_SABRINA = S([
  '....KKKKKKKK....',
  '...KCcCcCcCcK...',  // crown
  '..KZcCccCccCZK..',
  '..KKKKKKKKKKKK..',
  '..KhHhhhhhhhhK..',  // hair top
  '.KhHHhhhhhhhhhK.',
  '.KhHhSssssssShK.',  // forehead under bangs
  '.KhhKsssssssKhK.',
  '.KhhKgGKKGgKhhK.',  // round glasses
  '.KhhKGgKKgGKhhK.',
  '.KhhsssKsKssshK.',  // bridge
  '.KhbsssssssssbK.',
  '.KhbsdsssKsssdK.',  // mouth
  '..KhssssKsssbK..',
  '...KhhKKKKKbhK..',  // chin/neck
  '...KhhpsssKbhK..',
  '..KppppppppppK..',  // dress top
  '.KIpPpppppppPpK.',
  '.KppIpppppppppK.',
  '.KpppppppppppPK.',
  'KppppIppppppppK.',
  'KppOppppppppppK.',
  'KKpppppppppppKK.',
  '.KKKKKKKKKKKKK..',
]);

/* ============================================================
   PRINCESS OTTO — rescue target when playing as Sabrina.
   Bald head, Lennon glasses, small crown, royal magenta robe.
============================================================ */
const SPR_PRINCESS_OTTO = S([
  '....KKKKKKKK....',
  '...KCcCcCcCcK...',
  '..KZcCccCccCZK..',
  '..KKKKKKKKKKKK..',
  '..KSSSSSSSSSSK..',
  '.KSSSSSSSSSSSSK.',
  '.KSsKgGKKGgKsSK.',
  '.KSsKGgKKgGKsSK.',
  '.KSSddssssssdSK.',
  '.KSSdssssssssdK.',
  '.KSSssssKssssSK.',
  '.KSSddssKsssddK.',
  '..KssssKKssssK..',
  '...KtttssstttK..',
  '...KttppppttK...',
  '..KppppppppppK..',
  '.KIpPpppppppPpK.',
  '.KppIpppppppppK.',
  '.KpppppppppppPK.',
  'KppppIppppppppK.',
  'KppOppppppppppK.',
  'KKpppppppppppKK.',
  '.KKKKKKKKKKKKK..',
  '................',
]);

/* ============================================================
   BLOOP — grumpy purple patroller, 16x16, 16-bit shaded
============================================================ */
const SPR_BLOOP_1 = S([
  '....KKKKKKKK....',
  '...KMmmmmmmMK...',
  '..KMmmnmmmmMmK..',
  '..KmmmmmmmmmmK..',
  '.KmKKmmmmmmKKmK.',  // grumpy brows
  '.KmEeKnmmnKeemK.',  // angry eyes
  '.KmeKKmmmmKKemK.',
  '.KmmmnmmmmmmmmK.',
  '.KmnmKKKKKKKnmK.',  // frown
  '.KmnmKwwwwwKnmK.',
  '.KmmmnmmmmmnmmK.',
  '..KmmmmmmmmmmK..',
  '..KmnKmmmmKnmK..',
  '.KmnK..KK..KnmK.',
  '.KKK...KK...KKK.',
  '.......KK.......',
]);
const SPR_BLOOP_2 = S([
  '....KKKKKKKK....',
  '...KMmmmmmmMK...',
  '..KMmmnmmmmMmK..',
  '..KmmmmmmmmmmK..',
  '.KmKKmmmmmmKKmK.',
  '.KmEeKnmmnKeemK.',
  '.KmeKKmmmmKKemK.',
  '.KmmmnmmmmmmmmK.',
  '.KmnmKKKKKKKnmK.',
  '.KmnmKwwwwwKnmK.',
  '.KmmmnmmmmmnmmK.',
  '..KmmmmmmmmmmK..',
  '..KmnKmmmmKnmK..',
  'KmnK....KK....KK',
  'KmK.....KK.....K',
  'KKK......KK....K',
]);
const SPR_BLOOP_SQUASH = S([
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....KKKKKKKK....',
  '..KMmmmmmmmmmMK.',
  '.KmEeKnmmnKeemK.',
  '.KmKKKKKKKKKKmK.',
  '.KmnmnnnnnnnnmK.',
  '.KmnmmmmmmmmmnK.',
  '.KmmKmmmmmmKmmK.',
  '.KKKKKKKKKKKKKK.',
  '................',
]);

/* ============================================================
   SPROINK — silly green springer, 16x16, 16-bit shaded
============================================================ */
const SPR_SPROINK_1 = S([
  '.....KKKKKK.....',
  '....KVvvvvvVK...',
  '...KVvvLvvvvVK..',
  '..KvvvvvvvvvvK..',
  '..KvveeKKeevvK..',  // big silly eyes
  '..KvveKKKKevvK..',
  '..KvvvvvvvvvvK..',
  '.KvvyYyyyyyyvvK.',  // belly highlight
  '.KvyyKwwwwwKyvK.',  // grin teeth
  '.KvyyyyyyyyyyvK.',
  '.KvvyyyyyyyyvvK.',
  '..KvvvlvvvlvvK..',
  '..KvvKvvvvKvvK..',
  '.KvvK..KK..KvvK.',
  '.KKK...KK...KKK.',
  '.......KK.......',
]);
const SPR_SPROINK_JUMP = S([
  '.....KKKKKK.....',
  '....KVvvvvvVK...',
  '...KVvvLvvvvVK..',
  '..KvvvvvvvvvvK..',
  '..KvveeKKeevvK..',
  '..KvveKKKKevvK..',
  '..KvvvvvvvvvvK..',
  '.KvvyYyyyyyyvvK.',
  '.KvyyKwwwwwKyvK.',
  '.KvyyyyyyyyyyvK.',
  '.KvvyyyyyyyyvvK.',
  '..KvvvvvvvvvvK..',
  '...KvvKKKKvvK...',
  '....KK....KK....',
  '................',
  '................',
]);

/* ============================================================
   CHOMPER — orange grumpy mini-boss, 24x20, 16-bit shaded
============================================================ */
const SPR_CHOMPER_1 = S([
  '......KKKKKKKKKK........',
  '....KK00ooooooo0KKK.....',
  '...K00aoooooooooo0K.....',
  '..K0oooooooooooooooK....',
  '..KooKKoooooooooKKooK...',
  '.K0ooKKooooooooKKoooK...',
  '.KooeeKooKKooKKeeooK....',
  '.KooeKKKooKKooKKKeoK....',
  '.KoooooooooooooooooK....',
  '.KooKKKKKKKKKKKKKKooK...',
  '.KooKwwwwwwwwwwwwKooK...',
  '.KooKwKKwwKKwwKKwKooK...',
  '.KooKwwwwwwwwwwwwKooK...',
  '.KooKKKKKKKKKKKKKKooK...',
  '..KoooaaooooaaooooK.....',
  '..KooAoooooooooooooK....',
  '..KooKoooooKKoooooKooK..',
  '.KaoK..KKK..KKK..KaoK...',
  '.KaaK..KKK..KKK..KaaK...',
  '.KKKK...KK...KK...KKKK..',
]);
const SPR_CHOMPER_2 = S([
  '......KKKKKKKKKK........',
  '....KK00ooooooo0KKK.....',
  '...K00aoooooooooo0K.....',
  '..K0oooooooooooooooK....',
  '..KooKKoooooooooKKooK...',
  '.K0ooKKooooooooKKoooK...',
  '.KooeeKooKKooKKeeooK....',
  '.KooeKKKooKKooKKKeoK....',
  '.KoooooooooooooooooK....',
  '.KooKKKKKKKKKKKKKKooK...',
  '.KooKwwwwwwwwwwwwKooK...',
  '.KooKwKKwwKKwwKKwKooK...',
  '.KooKwwwwwwwwwwwwKooK...',
  '.KooKKKKKKKKKKKKKKooK...',
  '..KoooaaooooaaooooK.....',
  '..KooAoooooooooooooK....',
  '..KooKoooooKKoooooKooK..',
  'KaoK..KKK..KKK..KaoK....',
  'KaaK..KKK..KKK..KaaK....',
  'KKK....KK....KK....KKK..',
]);

/* ============================================================
   BIT — unico sprite hi-res (52x36, disegnato con drawSpriteHi).
   Gatto tabby laterale in corsa: tozzo, paffuto, leggibile come
   cameo platform alla Super Mario. Niente fiocco.
============================================================ */
function makeBitCatFrame(frame) {
  const W = 52;
  const H = 36;
  const rows = Array.from({ length: H }, function () { return Array(W).fill('.'); });

  function set(x, y, c) {
    if (x >= 0 && x < W && y >= 0 && y < H) rows[y][x] = c;
  }
  function fillEllipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(x, y, c);
      }
    }
  }
  function outlineEllipse(cx, cy, rx, ry, c = 'K') {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 0.76 && d <= 1.18) set(x, y, c);
      }
    }
  }
  function thickLine(x1, y1, x2, y2, r, c) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      fillEllipse(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, r, r, c);
    }
  }
  function strokeLine(x1, y1, x2, y2, r, c = 'K') {
    thickLine(x1, y1, x2, y2, r + 1, c);
  }
  function polygon(points, c) {
    const minX = Math.floor(Math.min.apply(null, points.map(p => p[0])));
    const maxX = Math.ceil(Math.max.apply(null, points.map(p => p[0])));
    const minY = Math.floor(Math.min.apply(null, points.map(p => p[1])));
    const maxY = Math.ceil(Math.max.apply(null, points.map(p => p[1])));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const xi = points[i][0], yi = points[i][1];
          const xj = points[j][0], yj = points[j][1];
          const hit = (yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1) + xi;
          if (hit) inside = !inside;
        }
        if (inside) set(x, y, c);
      }
    }
  }
  function outlinedPolygon(points, fill) {
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      thickLine(a[0], a[1], b[0], b[1], 1.2, 'K');
    }
    polygon(points, fill);
  }
  function paw(x, y, c) {
    fillEllipse(x, y, 4, 2, 'K');
    fillEllipse(x, y - 1, 3, 1.4, c);
  }
  function whisker(x1, y1, x2, y2) {
    thickLine(x1, y1, x2, y2, 0.45, 'E');
  }

  const run = frame === 0 ? 0 : 1;

  // Coda corta e grossa, alla platformer, tutta tabby senza punta bianca.
  const tailY = run ? 19 : 17;
  strokeLine(19, 23, 11, tailY, 3.6);
  strokeLine(11, tailY, 5, tailY - 2, 3);
  thickLine(19, 23, 11, tailY, 2.4, '[');
  thickLine(11, tailY, 5, tailY - 2, 2, '[');
  fillEllipse(4, tailY - 3, 3.4, 2.5, 'K');
  fillEllipse(4, tailY - 3, 2.5, 1.6, ']');
  thickLine(4, tailY - 5, 4, tailY - 1, 0.8, ';');
  thickLine(13, tailY, 9, tailY - 1, 0.8, ';');

  // Zampe in secondo piano, disegnate prima del corpo.
  if (run) {
    strokeLine(21, 28, 16, 33, 1.7);
    thickLine(21, 28, 16, 33, 0.9, ';');
    paw(14, 34, '[');
    strokeLine(34, 28, 34, 34, 1.7);
    thickLine(34, 28, 34, 34, 0.9, ';');
    paw(34, 35, '[');
  } else {
    strokeLine(21, 28, 23, 34, 1.7);
    thickLine(21, 28, 23, 34, 0.9, ';');
    paw(23, 35, '[');
    strokeLine(34, 28, 30, 33, 1.7);
    thickLine(34, 28, 30, 33, 0.9, ';');
    paw(28, 34, '[');
  }

  // Corpo compatto e paffuto.
  outlineEllipse(26, 24, 15, 8);
  fillEllipse(26, 24, 14, 7, ']');
  fillEllipse(24, 21, 12, 4, '[');
  fillEllipse(29, 27, 12, 4.5, '{');
  fillEllipse(29, 29, 9, 3.5, 'w');
  fillEllipse(18, 25, 5, 5, '[');

  // Strisce tabby grosse, poche e leggibili.
  thickLine(17, 18, 20, 25, 1, ';');
  thickLine(24, 17, 26, 25, 1.1, ';');
  thickLine(31, 18, 31, 25, 1, '$');
  thickLine(36, 20, 34, 26, 1, ';');
  thickLine(17, 27, 22, 30, 1, ':');
  fillEllipse(29, 29, 9, 3.5, 'w');

  // Testa grande e tonda, muso bianco e orecchie piccole.
  strokeLine(36, 22, 39, 20, 2.4);
  thickLine(36, 22, 39, 20, 1.5, '[');
  outlineEllipse(41, 16, 8, 7);
  fillEllipse(41, 16, 7, 6, ']');
  fillEllipse(38, 14, 5, 3.5, '{');
  fillEllipse(47, 18, 4, 2.8, 'w');
  fillEllipse(42, 22, 5, 2.8, 'w');
  outlinedPolygon([[34, 11], [37, 5], [39, 12]], '[');
  outlinedPolygon([[42, 11], [46, 5], [47, 13]], '[');
  polygon([[36, 11], [37, 8], [38, 12]], 'd');
  polygon([[44, 11], [46, 8], [46, 13]], 'd');
  thickLine(38, 13, 41, 17, 0.55, ';');
  thickLine(43, 12, 43, 18, 0.6, '$');
  fillEllipse(44, 16, 1.4, 1.4, 'W');
  fillEllipse(45, 16, 0.9, 1.1, '=');
  set(46, 16, '$');
  set(49, 18, '*');
  set(50, 18, '+');
  whisker(47, 17, 51, 16);
  whisker(47, 19, 51, 20);
  set(46, 20, 'k');

  // Zampe chiare in primo piano.
  if (run) {
    strokeLine(23, 29, 19, 34, 2);
    thickLine(23, 29, 19, 34, 1.1, '}');
    paw(17, 35, 'w');
    strokeLine(35, 29, 42, 31, 2);
    thickLine(35, 29, 42, 31, 1.1, '}');
    paw(45, 31, 'w');
  } else {
    strokeLine(23, 29, 30, 32, 2);
    thickLine(23, 29, 30, 32, 1.1, '}');
    paw(33, 33, 'w');
    strokeLine(35, 29, 37, 34, 2);
    thickLine(35, 29, 37, 34, 1.1, '}');
    paw(37, 35, 'w');
  }

  // Pixel d'ombra nella gallery/su terreno, appena sotto le zampe.
  for (let x = 12; x < 44; x += 6) set(x, 35, 'k');
  return rows;
}

const SPR_BIT_RUN1 = makeBitCatFrame(0);
const SPR_BIT_RUN2 = makeBitCatFrame(1);

/* ============================================================
   COIN — animated 4 frames, 12x14
============================================================ */
const SPR_COIN_1 = S([
  '...KKKKKKKK.',
  '..KxXXXXXXxK',
  '.KxXXzXXXXXxK',
  'KxXXzXXXXXXxK',
  'KxXXzXXXXXXxK',
  'KxXXzXXXXXXxK',
  'KxXXzXXXXXXxK',
  'KxXXzXXXXXXxK',
  'KxXXzXXXXXXxK',
  'KxXXzXXXXXXxK',
  'KxxXzXXXXxzxK',
  '.KxxXXXXXxzxK',
  '..KxxxxxxxzK',
  '...KKKKKKKK.',
]);
const SPR_COIN_2 = S([
  '....KKKKKK..',
  '...KxXXXXxK.',
  '...KxXzXXxK.',
  '...KxXzXXxK.',
  '...KxXzXXxK.',
  '...KxXzXXxK.',
  '...KxXzXXxK.',
  '...KxXzXXxK.',
  '...KxXzXXxK.',
  '...KxXzXXxK.',
  '...KxXzXXxK.',
  '...KxXzXXxK.',
  '...KxxzxxK..',
  '....KKKKKK..',
]);
const SPR_COIN_3 = S([
  '.....KKKK...',
  '....KxXXxK..',
  '....KxzXxK..',
  '....KxzXxK..',
  '....KxzXxK..',
  '....KxzXxK..',
  '....KxzXxK..',
  '....KxzXxK..',
  '....KxzXxK..',
  '....KxzXxK..',
  '....KxzXxK..',
  '....KxzXxK..',
  '....KxzxK...',
  '.....KKKK...',
]);
const SPR_COIN_4 = S([
  '....KKKKKK..',
  '...KxXXXXxK.',
  '...KxzXXXxK.',
  '...KxzXXXxK.',
  '...KxzXXXxK.',
  '...KxzXXXxK.',
  '...KxzXXXxK.',
  '...KxzXXXxK.',
  '...KxzXXXxK.',
  '...KxzXXXxK.',
  '...KxzXXXxK.',
  '...KxzXXXxK.',
  '...KxxzxxK..',
  '....KKKKKK..',
]);

/* ============================================================
   TILES — 16x16, 16-bit shaded with grass tops, brick mortar, etc.
============================================================ */
const TILE_GROUND = S([
  '6666666666666666',
  '5555555555555555',
  '555K55555K5555K5',
  '55KK55K55KK555K5',
  '1111111111111111',
  '1222222122222221',
  '2221222222212222',
  '2222222222221222',
  '2232222232222222',
  '2222322222232322',
  '3322232233222322',
  '3332332332333233',
  '3333333333333333',
  '3343333334333343',
  '4334343344333433',
  '4444344444443444',
]);

const TILE_GROUND_FILL = S([
  '2222222222222222',
  '2221222222212222',
  '2232222232222222',
  '2222322222232322',
  '3322232233222322',
  '3332332332333233',
  '3333333333333333',
  '3343333334333343',
  '4334343344333433',
  '4444344444443444',
  '4434443344434434',
  '4444444443444444',
  '4344443444444443',
  '4434443344434434',
  '4444344444443444',
  '4444444444444444',
]);

const TILE_BRICK = S([
  '7777777777777777',  // top hi
  '8888888888888888',
  '8888888888888888',
  '7777777K77777777',  // mortar split
  '8888888K88888888',
  '8898988K88989889',
  '9999999K99999999',
  'KKKKKKKKKKKKKKKK',  // mortar row
  '8888K7777888K888',
  '8888K8888888K888',
  '8889K8888988K888',
  '9999K8898999K999',
  'KKKKK99999999KKK',
  '7777777777K77777',
  '8888888888K88888',
  '9999999999K99999',
]);

const TILE_QUESTION = S([
  'KKKKKKKKKKKKKKKK',
  'KQQ!!!!!!!!!!QQK',
  'KQ!!!!!!!!!!!!QK',
  'KQ!!!@@@@@@!!!QK',
  'KQ!!@@QQQQ@@!!QK',
  'KQ!!@@!!!!@@@!QK',
  'KQ!!!!!!!!@@@!QK',
  'KQ!!!!!!!@@@!!QK',
  'KQ!!!!!!@@@!!!QK',
  'KQ!!!!!!@@!!!!QK',
  'KQ!!!!!!@@!!!!QK',
  'KQ!!!!!!!!!!!!QK',
  'KQ!!!!!!@@!!!!QK',
  'KQ!!!!!!@@!!!!QK',
  'KQQ@@@@@@@@@@QQK',
  'KKKKKKKKKKKKKKKK',
]);

const TILE_USED = S([
  'KKKKKKKKKKKKKKKK',
  'KU3UUUUUUUUUUU3K',
  'K3UU3UUUUU3UUU3K',
  'KUUUUUUU3UUUUUUK',
  'KUUUUUUUUUUUUUUK',
  'KUUUUUU3UUUUUUUK',
  'KU3UUUUUUUUU3UUK',
  'KUUUUUUUUUUUUUUK',
  'KUUUUU3UUUUU3UUK',
  'KUUUUUUUUUUUUU3K',
  'KU3UUUUUUUU3UUUK',
  'KUUU3UUU3UUUUUUK',
  'KUUUUUUUUUUUUU3K',
  'K3UUUUUUUUUUUUUK',
  'KUUUUUUUUUUUUUUK',
  'KKKKKKKKKKKKKKKK',
]);

/* Decorative cloud (32x16) — fluffier, with shading */
const SPR_CLOUD = S([
  '..........KKKKKK................',
  '........KKFFFFFFKK..............',
  '......KKFFFFFFFFFFK....KKKK.....',
  '....KKFFFFFFFFFFFFFK.KKFFFFKK...',
  '..KKFFFFFFFFFFFFFFFFKFFFFFFFFK..',
  '.KFFFFFFFFFFffFFFFFFFFFFFFFFFFK.',
  'KFFFFFFffFFFFFFFFFFFFFFFFFFFFFFK',
  'KFffFFFFFFFFFFFFFFFFffFFFFFFFFFK',
  'KFFFffFFFFFFFFffFFFFFFFFFffFFFFK',
  '.KFFFFFFFFFFFFFFFFFFFFFFFFFFFFK.',
  '..KKfFFFFFFFFFFFFFFFFFFFFFFFKK..',
  '....KKffFFFFFFFFFFFFFFFFFFKK....',
  '......KKffffFFFFFFFFFFffKK......',
  '........KKffffffffffffKK........',
  '..........KKKKKKKKKKKK..........',
  '................................',
]);

const SPR_CLOUD_2 = S([
  '....................................',
  '..............KKKK..................',
  '............KKFFFFKK................',
  '.......KKKKKFFFFFFFFK...............',
  '.....KKFFFFFFFFFFFFFFK....KKK.......',
  '...KKFFFFFFffFFFFFFFFFK.KKFFFKK.....',
  '..KFFFFFffFFFFFFFFFFFFFKFFFFFFFK....',
  '.KFFFFFFFFFFFFFFFFffFFFFFFFFFFFFK...',
  'KFFFFffFFFFFFFFFFFFFFFFFFFFFffFFFK..',
  'KFFFFFFFFFFffFFFFFFFFFFFFFFFFFFFFK..',
  '.KFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFK...',
  '..KKfFFFFFFFFFFFFFFFFFFFFFFFfKKK....',
  '....KKffffFFFFFFFFFFFFFFffffKK......',
  '......KKKKffffffffffffffKKKK........',
  '....................................',
  '....................................',
]);

const SPR_CLOUD_3 = S([
  '............................',
  '...........KKKKKK...........',
  '.........KKFFFFFFKK.........',
  '.......KKFFFFFFFFFFK........',
  '.....KKFFFFFFFFFFFFFK.......',
  '....KFFFFffFFFFFFFFFFKK.....',
  '..KKFFFFFFFFFFFFFFFFFFFFK...',
  '.KFFFFFFFFffFFFFFFffFFFFFK..',
  'KFFFffFFFFFFFFFFFFFFFFFFFFK.',
  'KFFFFFFFFFFFFFFFFFFFFFFffFK.',
  '.KFFFFFFFFFFFFFFFFFFFFFFFK..',
  '..KKffFFFFFFFFFFFFFFFFKKK...',
  '....KKffffFFFFFFffffKK.....',
  '......KKKKKKKKKKKKKK.......',
  '............................',
  '............................',
]);

/* Decorative bush (32x16) — uses sproink greens for unity */
const SPR_BUSH = S([
  '................................',
  '................................',
  '................................',
  '............KKKK................',
  '..........KKVvvKK......KKKK.....',
  '.....KKKKKVvvvvvvKKKKKKVvvKK....',
  '...KKvvvvvvLvvvvvvvvvvvvvvvKK...',
  '..KvvvvLvvvvvvLvvvLvvvvLvvvvK...',
  '.KvvLvvvvLvvvvvvvvvvvLvvvvvvvK..',
  '.KvvvvvvvvvvLvvvvLvvvvvvvvvLvK..',
  'KvLvvvvvvvvvvvvvvvvvvvvvvvvvvvK.',
  'KvvvvLvvvvLvvvvLvvvvLvvvvvLvvvK.',
  'KKvvvVvvvVvvvVvvvvVvvvvvvVvvKK..',
  '.KKvvvvvvvvvvvvvvvvvvvvvvvKK....',
  '...KKKKKKKKKKKKKKKKKKKKKKK......',
  '................................',
]);

/* Hill silhouette (48x24) — 16-bit shading */
const SPR_HILL = S([
  '...............KKKKKKKKKKKK.....................',
  '............KKKvvvvvvvvvvvKKK...................',
  '..........KKvvvvVvvvvvVvvvvvKK..................',
  '........KKvvvvvvvvvLvvvvvvvvvKK.................',
  '......KKvvvvvvvvvvvvvvvvvvvvvvKK................',
  '.....KvvvvvvvLvvvvvvvvvvvvvvLvvK................',
  '....KvvvvvvvvvvvvvvvvLvvvvvvvvvvK...............',
  '...KvvvvLvvvvvvvvvvvvvvvvvvvLvvvK...............',
  '..KvvvvvvvvvvvvvvLvvvvvvvvvvvvvvvK..............',
  '..KvvvvvvvvLvvvvvvvvvvvvvvLvvvvvvK..............',
  '.KvvvvvvvvvvvvvvvvvvvvLvvvvvvvvvvvK.............',
  '.KvvvvLvvvvvvvvvvLvvvvvvvvvvvvvvvvK.............',
  'KvvvvvvvvvvvLvvvvvvvvvvvvvvLvvvvvvvK............',
  'KvvvvvvvvvvvvvvvvvvvvvLvvvvvvvvvvvvK............',
  'KvvLvvvvvvvvvvvvLvvvvvvvvvvvvvvvvvvK............',
  'KvvvvvvvvvvvvvvvvvvvvvvvvvvLvvvvvvvK............',
  'KvvvvvvvvvLvvvvvvvvvvLvvvvvvvvvvvvvK............',
  'KvvvvLvvvvvvvvvvvvvvvvvvvvvvLvvvvvvK............',
  'KvvvvvvvvvvvvvLvvvvvvvvvvvvvvvvvvvvK............',
  'KvvvvvvvvvvvvvvvvvvLvvvvvvvvvvvvvvvK............',
  'KvvvvvvLvvvvvvvvvvvvvvvvvvLvvvvvvvvK............',
  'KvvvvvvvvvvvLvvvvvvvvvvvvvvvvvvvvvvK............',
  'KvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvK............',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK............',
]);

/* Flag pole + flag — 3 stacked tiles (16w x 16h each) */
const SPR_FLAG_TOP = S([
  '.......KKK......',
  '......KxXXK.....',
  '.....KxzXXxK....',
  '......KxxxK.....',
  '.......KK.......',
  '......K~`K......',
  '.****K~`K.......',
  '.****K~`K.......',
  '.*+++K~`K.......',
  '.+++*K~`K.......',
  '.KKKKK~`K.......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
]);
const SPR_FLAG_POLE = S([
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
]);
const SPR_FLAG_BASE = S([
  '......K~`K......',
  '......K~`K......',
  '......K~`K......',
  '....KKK~`KKK....',
  '...K1111111K....',
  '..K1111111111K..',
  '..K1212222121K..',
  '.K2122222221K2K.',
  '.K3222222232K3K.',
  'K3333333333333K3',
  'K333333333333333',
  '................',
  '................',
  '................',
  '................',
  '................',
]);

/* SUN decorative (32x32) */
const SPR_SUN = S([
  '............KKKKKKKK............',
  '..........KKxXXXXXXKKK..........',
  '........KKxXXXXXXXXXXxKK........',
  '......KKxXXXXXXXXXXXXxxKK.......',
  '.....KxXXXXXXXXXXXXXXXXxxK......',
  '....KxXXXXXXXXXXXXXXXXXXxxK.....',
  '...KxXXXXXXXXXXXXXXXXXXXxxxK....',
  '..KxXXXXXXXXXXXXXXXXXXXxxxxxK...',
  '..KxXXXXXXXXXXXXXXXXXXXxxxxxK...',
  '.KxXXXXXXXXXXXXXXXXXXXxxxxxxxK..',
  '.KxXXXXXXXXXXXXXXXXXXxxxxxxxxK..',
  'KxXXXXXXXXXXXXXXXXXXxxxxxxxxxxK.',
  'KxXXXXXXXXXXXXXXXXXxxxxxxxxxxxK.',
  'KxXXXXXXXXXXXXXXXXxxxxxxxxxxxxK.',
  'KxXXXXXXXXXXXXXXXxxxxxxxxxxxxxK.',
  'KxXXXXXXXXXXXXXXxxxxxxxxxxxxxxK.',
  'KxXXXXXXXXXXXXXxxxxxxxxxxxxxxxK.',
  'KxXXXXXXXXXXXXxxxxxxxxxxxxxxxxK.',
  'KxXXXXXXXXXXXxxxxxxxxxxxxxxxxxK.',
  'KxXXXXXXXXXXxxxxxxxxxxxxxxxxxxK.',
  'KxXXXXXXXXXxxxxxxxxxxxxxxxxxxxK.',
  '.KxXXXXXXXxxxxxxxxxxxxxxxxxxxK..',
  '.KxXXXXXXxxxxxxxxxxxxxxxxxxxxK..',
  '..KxXXXXxxxxxxxxxxxxxxxxxxxxK...',
  '..KxXXXxxxxxxxxxxxxxxxxxxxxxK...',
  '...KxXxxxxxxxxxxxxxxxxxxxxxK....',
  '....KxxxxxxxxxxxxxxxxxxxxxK.....',
  '.....KxxxxxxxxxxxxxxxxxxxxK.....',
  '......KKxxxxxxxxxxxxxxxxKK......',
  '........KKxxxxxxxxxxxxKK........',
  '..........KKxxxxxxxxKKK.........',
  '............KKKKKKKK............',
]);

/* ============================================================
   Export
============================================================ */
/* Corno portafortuna napoletano (12x14) — red lucky horn with gold cap */
const SPR_CORNO = S([
  '....KKKK....',
  '...KxXXK....',
  '...KXxxXK...',
  '...KKKKK....',
  '...K**+K....',
  '....K**K....',
  '....K*+K....',
  '....K**K....',
  '....K*+K....',
  '.....K*K....',
  '.....K+K....',
  '.....KK.....',
  '............',
  '............',
]);

/* Limoncello bottle (12x16) — yellow lemon liqueur in clear glass */
const SPR_LIMONCELLO = S([
  '....KKKK....',
  '....K!!K....',
  '....K!!K....',
  '...KK!!KK...',
  '...K!!!!K...',
  '..KKQQQQKK..',
  '..K!!QQ!!K..',
  '..K!QQQQ!K..',
  '..K!QQQQ!K..',
  '..K!QQQQ!K..',
  '..K!QQQQ!K..',
  '..K!QQQQ!K..',
  '..K!QQQQ!K..',
  '..KQQQQQQK..',
  '..KKKKKKKK..',
  '............',
]);

/* ============================================================
   PRINCE OTTO — Super Otto powered up: gold crown, Lennon glasses,
   royal-blue cavalier tunic with gold buttons, light-blue cape,
   royal blue trousers, white silver boots.
============================================================ */
const SPR_PRINCE_IDLE = S([
  '...KCcCcCcCcK...',
  '..KZcCccCccCZK..',
  '..KKKKKKKKKKKK..',
  '...KSSSSSSSSK...',
  '...KSsssssssSK..',
  '..KsKgGKKGgKsK..',
  '..KsKGgKKgGKsK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  '%KKK<<<<<<<<KKK%',
  'B%K>>x>>>>x>>K%B',
  'BBK>>>>>>>>>>KBB',
  '.BK>>>>>>>>>>KB.',
  '..KKKKKKKKKKKK..',
  '...K>>JJJJ>>K...',
  '...K>>i%%i>>K...',
  '...K>>K..K>>K...',
  '..KrRwK..KwRrK..',
  '..KKKK....KKKK..',
  '................',
]);

const SPR_PRINCE_RUN1 = S([
  '...KCcCcCcCcK...',
  '..KZcCccCccCZK..',
  '..KKKKKKKKKKKK..',
  '...KSSSSSSSSK...',
  '...KSsssssssSK..',
  '..KsKgGKKGgKsK..',
  '..KsKGgKKgGKsK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  '.%KK<<<<<<<<KKKK',
  'BB%K>>x>>>>x>>%K',
  'BBBK>>>>>>>>>>>K',
  '.BBK>>>>>>>>>>K.',
  '..KKKKKKKKKKKK..',
  '..K>>iJJ>>>>>K..',
  '.K>>iJJ>>>>>>>K.',
  'KrRw>K....K>>>K.',
  'KKKK......K>>>K.',
  '..........KrRwK.',
  '..........KKKK..',
]);

const SPR_PRINCE_RUN2 = S([
  '...KCcCcCcCcK...',
  '..KZcCccCccCZK..',
  '..KKKKKKKKKKKK..',
  '...KSSSSSSSSK...',
  '...KSsssssssSK..',
  '..KsKgGKKGgKsK..',
  '..KsKGgKKgGKsK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  'KKKK<<<<<<<<KK%.',
  'K%>>x>>>>>x>K%BB',
  'K>>>>>>>>>>>>KBB',
  '.K>>>>>>>>>>KBB.',
  '..KKKKKKKKKKKK..',
  '..K>>>>>>JJi>K..',
  '.K>>>>>>JJi>>>K.',
  '.K>>>K....K>>iK.',
  'K>>>K......KKKKK',
  'K>>iK...........',
  'KrRwK...........',
]);

const SPR_PRINCE_JUMP = S([
  '...KCcCcCcCcK...',
  '..KZcCccCccCZK..',
  '..KKKKKKKKKKKK..',
  '...KSSSSSSSSK...',
  '...KSsssssssSK..',
  '..KsKgGKKGgKsK..',
  '..KsKGgKKgGKsK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  'KKKK<<<<<<<<KKKK',
  'B%K>>x>>>>x>>K%B',
  'BB%K>>>>>>>>>K%B',
  '.BBK>>>>>>>>K.B.',
  '..KKKKKKKKKKKK..',
  '..K>>JJJJJJJ>K..',
  '.K>>K....K>>>K..',
  'K>>iK......K>>K.',
  'KrRwK......KrRwK',
  'KKKK........KKKK',
  '................',
]);

/* ============================================================
   PRINCESS SABRI — Super Sabri powered up: gold crown, pink hair,
   Lennon glasses, royal blue noble gown with gold trim, white slippers.
============================================================ */
const SPR_PRINCESS_SABRI_IDLE = S([
  '...KCcCcCcCcK...',
  '..KZcCccCccCZK..',
  '..KKKKKKKKKKKK..',
  '...KIppppppIK...',
  '...KppsssssspK..',
  '..KpKgGKKGgKpK..',
  '..KpKGgKKgGKpK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  '..KK<>>>>>>>>KK.',
  '..K<>>x>>>>x><K.',
  '...K>>>>>>>>>K..',
  '....K%>>>>%>K...',
  '...K>>>>>>>>K...',
  '..K>>>>>>>>>>K..',
  '.K>>x>>>>>>x>>K.',
  '.K>>>>>>>>>>>>K.',
  '..KKKKKKKKKKKKK.',
  '...KrRrwwwwrRK..',
  '...KKKKKKKKKKK..',
]);

const SPR_PRINCESS_SABRI_RUN1 = S([
  '...KCcCcCcCcK...',
  '..KZcCccCccCZK..',
  '..KKKKKKKKKKKK..',
  '...KIppppppIK...',
  '...KppsssssspK..',
  '..KpKgGKKGgKpK..',
  '..KpKGgKKgGKpK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  '..KK<>>>>>>>>KK.',
  '..K<>>x>>>>x><K.',
  '...K>>>>>>>>>K..',
  '....K%>>>>%>K...',
  '...K>>>>>>>>K...',
  '..K>>%>>>>>%>K..',
  '.K>>x>>>>>>x>>K.',
  '.K>%>>>>>>>>>>K.',
  '..KKKKKKKKKKKKK.',
  '..KrRrK...KrRwK.',
  '..KKKK....KKKK..',
]);

const SPR_PRINCESS_SABRI_RUN2 = S([
  '...KCcCcCcCcK...',
  '..KZcCccCccCZK..',
  '..KKKKKKKKKKKK..',
  '...KIppppppIK...',
  '...KppsssssspK..',
  '..KpKgGKKGgKpK..',
  '..KpKGgKKgGKpK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  '..KK<>>>>>>>>KK.',
  '..K<>>x>>>>x><K.',
  '...K>>>>>>>>>K..',
  '....K%>>>>%>K...',
  '...K>>>>>>>>K...',
  '..K>>>%>>>%>>K..',
  '.K>>x>>>>>>x>>K.',
  '.K>>>>>>>>>>%>K.',
  '..KKKKKKKKKKKKK.',
  '..KrRwK...KrRrK.',
  '..KKKK....KKKK..',
]);

const SPR_PRINCESS_SABRI_JUMP = S([
  '...KCcCcCcCcK...',
  '..KZcCccCccCZK..',
  '..KKKKKKKKKKKK..',
  '...KIppppppIK...',
  '...KppsssssspK..',
  '..KpKgGKKGgKpK..',
  '..KpKGgKKgGKpK..',
  '...KsddsssssdK..',
  '....KKKsssKKK...',
  '..KK<>>>>>>>>KK.',
  '..K<>>x>>>>x><K.',
  '...K>>>>>>>>>K..',
  '....K%>>>>%>K...',
  '...K>>>>>>>>K...',
  '..K>>>>>>>>>>K..',
  '.K>>x>>>>>>x>>K.',
  '.K>>>>>>>>>>>>K.',
  '..KKKKKKKKKKKKK.',
  '...KrRrK..KrRwK.',
  '...KKKK...KKKK..',
]);

/* Heart particle (8x8) — pinkish red */
const SPR_HEART = S([
  '.KK..KK.',
  'KppKKppK',
  'KpIppIpK',
  'KppppppK',
  '.KppppK.',
  '..KppK..',
  '...KK...',
  '........',
]);

const SPRITES = {
  heart: SPR_HEART,
  limoncello: SPR_LIMONCELLO,
  corno: SPR_CORNO,
  prince_idle: SPR_PRINCE_IDLE,
  prince_run1: SPR_PRINCE_RUN1,
  prince_run2: SPR_PRINCE_RUN2,
  prince_jump: SPR_PRINCE_JUMP,
  princess_sabri_idle: SPR_PRINCESS_SABRI_IDLE,
  princess_sabri_run1: SPR_PRINCESS_SABRI_RUN1,
  princess_sabri_run2: SPR_PRINCESS_SABRI_RUN2,
  princess_sabri_jump: SPR_PRINCESS_SABRI_JUMP,
  otto_idle: SPR_OTTO_IDLE,
  otto_run1: SPR_OTTO_RUN1,
  otto_run2: SPR_OTTO_RUN2,
  otto_jump: SPR_OTTO_JUMP,
  sabrina_idle: SPR_SABRINA_IDLE,
  sabrina_run1: SPR_SABRINA_RUN1,
  sabrina_run2: SPR_SABRINA_RUN2,
  sabrina_jump: SPR_SABRINA_JUMP,

  sabrina:   SPR_SABRINA,
  princess_otto: SPR_PRINCESS_OTTO,

  bloop_1: SPR_BLOOP_1,
  bloop_2: SPR_BLOOP_2,
  bloop_squash: SPR_BLOOP_SQUASH,

  sproink_1: SPR_SPROINK_1,
  sproink_jump: SPR_SPROINK_JUMP,

  chomper_1: SPR_CHOMPER_1,
  chomper_2: SPR_CHOMPER_2,

  bit_run1: SPR_BIT_RUN1,
  bit_run2: SPR_BIT_RUN2,

  coin_1: SPR_COIN_1,
  coin_2: SPR_COIN_2,
  coin_3: SPR_COIN_3,
  coin_4: SPR_COIN_4,

  tile_ground:   TILE_GROUND,
  tile_ground_fill: TILE_GROUND_FILL,
  tile_brick:    TILE_BRICK,
  tile_question: TILE_QUESTION,
  tile_used:     TILE_USED,

  cloud: SPR_CLOUD,
  cloud_2: SPR_CLOUD_2,
  cloud_3: SPR_CLOUD_3,
  bush:  SPR_BUSH,
  hill:  SPR_HILL,
  sun:   SPR_SUN,

  flag_top:  SPR_FLAG_TOP,
  flag_pole: SPR_FLAG_POLE,
  flag_base: SPR_FLAG_BASE,
};

function makeFrame(id, label, sprite) {
  return {
    id,
    label,
    sprite,
    width: sprite[0].length,
    height: sprite.length,
  };
}

const SPRITE_LIBRARY = {
  groups: [
    {
      id: 'playable',
      title: 'Playable Heroes',
      description: 'Main controllable characters and their frame-by-frame animations.',
      entries: [
        {
          id: 'hero-otto',
          label: 'Super Otto',
          animate: true,
          fps: 5,
          frames: [
            makeFrame('otto_idle', 'Idle', SPR_OTTO_IDLE),
            makeFrame('otto_run1', 'Run 1', SPR_OTTO_RUN1),
            makeFrame('otto_run2', 'Run 2', SPR_OTTO_RUN2),
            makeFrame('otto_jump', 'Jump', SPR_OTTO_JUMP),
          ],
        },
        {
          id: 'hero-sabrina',
          label: 'Super Sabri',
          animate: true,
          fps: 5,
          frames: [
            makeFrame('sabrina_idle', 'Idle', SPR_SABRINA_IDLE),
            makeFrame('sabrina_run1', 'Run 1', SPR_SABRINA_RUN1),
            makeFrame('sabrina_run2', 'Run 2', SPR_SABRINA_RUN2),
            makeFrame('sabrina_jump', 'Jump', SPR_SABRINA_JUMP),
          ],
        },
        {
          id: 'hero-prince',
          label: 'Prince Otto Power-Up',
          animate: true,
          fps: 5,
          frames: [
            makeFrame('prince_idle', 'Idle', SPR_PRINCE_IDLE),
            makeFrame('prince_run1', 'Run 1', SPR_PRINCE_RUN1),
            makeFrame('prince_run2', 'Run 2', SPR_PRINCE_RUN2),
            makeFrame('prince_jump', 'Jump', SPR_PRINCE_JUMP),
          ],
        },
        {
          id: 'hero-princess-sabri',
          label: 'Princess Sabri Power-Up',
          animate: true,
          fps: 5,
          frames: [
            makeFrame('princess_sabri_idle', 'Idle', SPR_PRINCESS_SABRI_IDLE),
            makeFrame('princess_sabri_run1', 'Run 1', SPR_PRINCESS_SABRI_RUN1),
            makeFrame('princess_sabri_run2', 'Run 2', SPR_PRINCESS_SABRI_RUN2),
            makeFrame('princess_sabri_jump', 'Jump', SPR_PRINCESS_SABRI_JUMP),
          ],
        },
      ],
    },
    {
      id: 'goals',
      title: 'Rescue Targets',
      description: 'Characters used as end-of-level rescue goals.',
      entries: [
        {
          id: 'goal-sabrina',
          label: 'Princess Sabri',
          animate: false,
          frames: [makeFrame('sabrina_princess', 'Princess', SPR_SABRINA)],
        },
        {
          id: 'goal-otto',
          label: 'Princess Otto',
          animate: false,
          frames: [makeFrame('princess_otto', 'Princess', SPR_PRINCESS_OTTO)],
        },
      ],
    },
    {
      id: 'enemies',
      title: 'Enemies',
      description: 'Enemy animation cycles and squash states.',
      entries: [
        {
          id: 'enemy-bloop',
          label: 'Bloop',
          animate: true,
          fps: 4,
          frames: [
            makeFrame('bloop_1', 'Walk 1', SPR_BLOOP_1),
            makeFrame('bloop_2', 'Walk 2', SPR_BLOOP_2),
            makeFrame('bloop_squash', 'Squash', SPR_BLOOP_SQUASH),
          ],
        },
        {
          id: 'enemy-sproink',
          label: 'Sproink',
          animate: true,
          fps: 4,
          frames: [
            makeFrame('sproink_1', 'Idle', SPR_SPROINK_1),
            makeFrame('sproink_jump', 'Jump', SPR_SPROINK_JUMP),
          ],
        },
        {
          id: 'enemy-chomper',
          label: 'Chomper',
          animate: true,
          fps: 4,
          frames: [
            makeFrame('chomper_1', 'Walk 1', SPR_CHOMPER_1),
            makeFrame('chomper_2', 'Walk 2', SPR_CHOMPER_2),
          ],
        },
        {
          id: 'cameo-bit',
          label: 'Bit (gatto tabby)',
          animate: true,
          fps: 8,
          frames: [
            makeFrame('bit_run1', 'Corsa 1', SPR_BIT_RUN1),
            makeFrame('bit_run2', 'Corsa 2', SPR_BIT_RUN2),
          ],
        },
      ],
    },
    {
      id: 'items',
      title: 'Items and Pickups',
      description: 'Collectibles, power-ups, and particles.',
      entries: [
        {
          id: 'item-coin',
          label: 'Coin Spin',
          animate: true,
          fps: 7,
          frames: [
            makeFrame('coin_1', 'Frame 1', SPR_COIN_1),
            makeFrame('coin_2', 'Frame 2', SPR_COIN_2),
            makeFrame('coin_3', 'Frame 3', SPR_COIN_3),
            makeFrame('coin_4', 'Frame 4', SPR_COIN_4),
          ],
        },
        {
          id: 'item-limoncello',
          label: 'Limoncello',
          animate: false,
          frames: [makeFrame('limoncello', 'Bottle', SPR_LIMONCELLO)],
        },
        {
          id: 'item-corno',
          label: 'Corno Portafortuna',
          animate: false,
          frames: [makeFrame('corno', 'Horn', SPR_CORNO)],
        },
        {
          id: 'item-heart',
          label: 'Heart Particle',
          animate: false,
          frames: [makeFrame('heart', 'Heart', SPR_HEART)],
        },
      ],
    },
    {
      id: 'tiles',
      title: 'Terrain and Blocks',
      description: 'Atomic world tiles used to assemble levels.',
      entries: [
        {
          id: 'tile-ground',
          label: 'Ground Top',
          animate: false,
          frames: [makeFrame('tile_ground', 'Ground Top', TILE_GROUND)],
        },
        {
          id: 'tile-ground-fill',
          label: 'Ground Fill',
          animate: false,
          frames: [makeFrame('tile_ground_fill', 'Ground Fill', TILE_GROUND_FILL)],
        },
        {
          id: 'tile-brick',
          label: 'Brick',
          animate: false,
          frames: [makeFrame('tile_brick', 'Brick', TILE_BRICK)],
        },
        {
          id: 'tile-question',
          label: 'Question Block',
          animate: false,
          frames: [makeFrame('tile_question', 'Question', TILE_QUESTION)],
        },
        {
          id: 'tile-used',
          label: 'Used Block',
          animate: false,
          frames: [makeFrame('tile_used', 'Used', TILE_USED)],
        },
      ],
    },
    {
      id: 'props',
      title: 'Environment Props',
      description: 'Background elements and goal pieces.',
      entries: [
        {
          id: 'prop-cloud',
          label: 'Clouds',
          animate: false,
          frames: [
            makeFrame('cloud', 'Cloud 1', SPR_CLOUD),
            makeFrame('cloud_2', 'Cloud 2', SPR_CLOUD_2),
            makeFrame('cloud_3', 'Cloud 3', SPR_CLOUD_3),
          ],
        },
        {
          id: 'prop-bush',
          label: 'Bush',
          animate: false,
          frames: [makeFrame('bush', 'Bush', SPR_BUSH)],
        },
        {
          id: 'prop-hill',
          label: 'Hill',
          animate: false,
          frames: [makeFrame('hill', 'Hill', SPR_HILL)],
        },
        {
          id: 'prop-sun',
          label: 'Sun',
          animate: false,
          frames: [makeFrame('sun', 'Sun', SPR_SUN)],
        },
        {
          id: 'prop-flag',
          label: 'Flag Kit',
          animate: false,
          frames: [
            makeFrame('flag_top', 'Top', SPR_FLAG_TOP),
            makeFrame('flag_pole', 'Pole', SPR_FLAG_POLE),
            makeFrame('flag_base', 'Base', SPR_FLAG_BASE),
          ],
        },
      ],
    },
  ],
};

window.PALETTE = PALETTE;
window.SPRITES = SPRITES;
window.SPRITE_LIBRARY = SPRITE_LIBRARY;
