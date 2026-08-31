<script setup lang="ts">
import SectionLabel from '~/components/ui/SectionLabel.vue'

type ControlKey = 'left' | 'right' | 'jump'
type CollectibleKind = 'lemon' | 'cornicello'

interface Platform {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly tone: 'stone' | 'tile' | 'ground'
}

interface Pad {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  pulse: number
}

interface Collectible {
  readonly x: number
  readonly y: number
  readonly kind: CollectibleKind
  readonly phase: number
  collected: boolean
}

interface Hazard {
  x: number
  readonly y: number
  readonly radius: number
  readonly minX: number
  readonly maxX: number
  readonly speed: number
  direction: -1 | 1
  rotation: number
  disabled: boolean
}

interface Player {
  x: number
  y: number
  width: number
  height: number
  vx: number
  vy: number
  grounded: boolean
  direction: -1 | 1
  invulnerable: number
}

const LOGICAL_WIDTH = 960
const LOGICAL_HEIGHT = 540
const WORLD_WIDTH = 3560
const GROUND_Y = 452
const GRAVITY = 1650
const ACCELERATION = 2300
const MAX_SPEED = 285
const FRICTION = 1850
const JUMP_SPEED = -640

const sectionRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const statusText = ref('Pronto sulla pietra bianca')
const collectedCount = ref(0)
const score = ref(0)
const timeLabel = ref('0.0s')
const progressPercent = ref(0)

const controls: Record<ControlKey, boolean> = {
  left: false,
  right: false,
  jump: false,
}

const platforms: readonly Platform[] = [
  { x: 0, y: GROUND_Y, width: WORLD_WIDTH, height: 88, tone: 'ground' },
  { x: 365, y: 370, width: 190, height: 28, tone: 'stone' },
  { x: 680, y: 315, width: 170, height: 28, tone: 'tile' },
  { x: 1035, y: 362, width: 260, height: 28, tone: 'stone' },
  { x: 1455, y: 303, width: 190, height: 28, tone: 'tile' },
  { x: 1860, y: 372, width: 255, height: 28, tone: 'stone' },
  { x: 2260, y: 324, width: 220, height: 28, tone: 'tile' },
  { x: 2680, y: 352, width: 260, height: 28, tone: 'stone' },
  { x: 3095, y: 294, width: 180, height: 28, tone: 'tile' },
]

const pads: Pad[] = [
  { x: 565, y: GROUND_Y - 13, width: 76, height: 16, pulse: 0 },
  { x: 1335, y: GROUND_Y - 13, width: 80, height: 16, pulse: 0 },
  { x: 2520, y: GROUND_Y - 13, width: 80, height: 16, pulse: 0 },
]

const totalCollectibles = 18
let collectibles: Collectible[] = createCollectibles()
let hazards: Hazard[] = createHazards()
let animationFrame = 0
let cameraX = 0
let elapsed = 0
let context: CanvasRenderingContext2D | null = null
let pixelRatio = 1
let jumpQueued = false
let finishReached = false
let lastTime = 0
let keyboardActive = false
let sectionObserver: IntersectionObserver | null = null

const player: Player = {
  x: 78,
  y: GROUND_Y - 64,
  width: 42,
  height: 64,
  vx: 0,
  vy: 0,
  grounded: false,
  direction: 1,
  invulnerable: 0,
}

function createCollectibles(): Collectible[] {
  return [
    { x: 255, y: 394, kind: 'lemon', phase: 0.2, collected: false },
    { x: 425, y: 326, kind: 'lemon', phase: 1.0, collected: false },
    { x: 515, y: 326, kind: 'cornicello', phase: 1.9, collected: false },
    { x: 730, y: 271, kind: 'lemon', phase: 0.4, collected: false },
    { x: 817, y: 271, kind: 'lemon', phase: 1.4, collected: false },
    { x: 1105, y: 318, kind: 'cornicello', phase: 2.2, collected: false },
    { x: 1194, y: 318, kind: 'lemon', phase: 1.1, collected: false },
    { x: 1514, y: 259, kind: 'lemon', phase: 0.5, collected: false },
    { x: 1606, y: 259, kind: 'lemon', phase: 2.4, collected: false },
    { x: 1930, y: 328, kind: 'lemon', phase: 1.5, collected: false },
    { x: 2050, y: 328, kind: 'cornicello', phase: 2.6, collected: false },
    { x: 2325, y: 280, kind: 'lemon', phase: 0.7, collected: false },
    { x: 2422, y: 280, kind: 'lemon', phase: 1.7, collected: false },
    { x: 2745, y: 308, kind: 'cornicello', phase: 2.8, collected: false },
    { x: 2852, y: 308, kind: 'lemon', phase: 0.9, collected: false },
    { x: 3150, y: 250, kind: 'lemon', phase: 1.2, collected: false },
    { x: 3220, y: 250, kind: 'lemon', phase: 2.0, collected: false },
    { x: 3400, y: 388, kind: 'cornicello', phase: 2.7, collected: false },
  ]
}

function createHazards(): Hazard[] {
  return [
    { x: 900, y: GROUND_Y - 20, radius: 21, minX: 870, maxX: 1040, speed: 72, direction: 1, rotation: 0, disabled: false },
    { x: 1710, y: GROUND_Y - 20, radius: 21, minX: 1660, maxX: 1840, speed: 86, direction: -1, rotation: 0, disabled: false },
    { x: 2960, y: GROUND_Y - 20, radius: 21, minX: 2950, maxX: 3120, speed: 78, direction: 1, rotation: 0, disabled: false },
  ]
}

function resetGame() {
  player.x = 78
  player.y = GROUND_Y - player.height
  player.vx = 0
  player.vy = 0
  player.grounded = false
  player.direction = 1
  player.invulnerable = 0
  collectibles = createCollectibles()
  hazards = createHazards()
  pads.forEach((pad) => {
    pad.pulse = 0
  })
  controls.left = false
  controls.right = false
  controls.jump = false
  jumpQueued = false
  finishReached = false
  cameraX = 0
  elapsed = 0
  score.value = 0
  collectedCount.value = 0
  progressPercent.value = 0
  timeLabel.value = '0.0s'
  statusText.value = 'Pronto sulla pietra bianca'
}

function fitCanvas() {
  const canvas = canvasRef.value

  if (!canvas || !context) {
    return
  }

  pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(LOGICAL_WIDTH * pixelRatio)
  canvas.height = Math.round(LOGICAL_HEIGHT * pixelRatio)
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
}

function queueJump() {
  jumpQueued = true
}

function pressControl(control: ControlKey, event: PointerEvent) {
  event.preventDefault()

  if (control === 'jump' && !controls.jump) {
    queueJump()
  }

  controls[control] = true
}

function releaseControl(control: ControlKey, event?: PointerEvent) {
  event?.preventDefault()
  controls[control] = false
}

function releaseAllControls() {
  controls.left = false
  controls.right = false
  controls.jump = false
}

function setKey(event: KeyboardEvent, active: boolean) {
  if (!keyboardActive) {
    return
  }

  const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(event.code)

  if (!handled) {
    return
  }

  event.preventDefault()

  if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
    controls.left = active
    return
  }

  if (event.code === 'ArrowRight' || event.code === 'KeyD') {
    controls.right = active
    return
  }

  if (active && !controls.jump) {
    queueJump()
  }

  controls.jump = active
}

function handleKeyDown(event: KeyboardEvent) {
  setKey(event, true)
}

function handleKeyUp(event: KeyboardEvent) {
  setKey(event, false)
}

function tick(time: number) {
  const delta = Math.min((time - lastTime) / 1000 || 0, 1 / 28)
  lastTime = time

  update(delta)
  draw()
  animationFrame = requestAnimationFrame(tick)
}

function update(delta: number) {
  elapsed += delta
  player.invulnerable = Math.max(0, player.invulnerable - delta)

  if (!finishReached) {
    if (controls.left) {
      player.vx -= ACCELERATION * delta
    }

    if (controls.right) {
      player.vx += ACCELERATION * delta
    }
  }

  if (!controls.left && !controls.right) {
    const friction = FRICTION * delta
    player.vx = Math.abs(player.vx) <= friction ? 0 : player.vx - Math.sign(player.vx) * friction
  }

  player.vx = clamp(player.vx, -MAX_SPEED, MAX_SPEED)

  if (player.vx < -4) {
    player.direction = -1
  } else if (player.vx > 4) {
    player.direction = 1
  }

  if (jumpQueued && player.grounded && !finishReached) {
    player.vy = JUMP_SPEED
    player.grounded = false
    statusText.value = 'Salto tra i trulli'
  }

  jumpQueued = false
  player.vy += GRAVITY * delta

  const previousX = player.x
  const previousY = player.y
  player.x = clamp(player.x + player.vx * delta, 24, WORLD_WIDTH - player.width - 28)
  player.y += player.vy * delta
  player.grounded = false

  resolvePlatformCollisions(previousY)
  resolveTambourines(previousY)
  updateHazards(delta, previousX, previousY)
  collectItems()
  resolveFinish()

  if (player.y > LOGICAL_HEIGHT + 120) {
    player.x = Math.max(78, cameraX + 60)
    player.y = GROUND_Y - player.height
    player.vx = 0
    player.vy = 0
    statusText.value = 'Di nuovo sulla strada'
  }

  cameraX = clamp(player.x - LOGICAL_WIDTH * 0.38, 0, WORLD_WIDTH - LOGICAL_WIDTH)
  progressPercent.value = Math.round((player.x / (WORLD_WIDTH - player.width)) * 100)
  timeLabel.value = `${elapsed.toFixed(1)}s`
}

function resolvePlatformCollisions(previousY: number) {
  const previousBottom = previousY + player.height
  const playerBottom = player.y + player.height

  for (const platform of platforms) {
    const overlapsX = player.x + player.width > platform.x && player.x < platform.x + platform.width
    const landsOnTop = previousBottom <= platform.y && playerBottom >= platform.y && player.vy >= 0

    if (overlapsX && landsOnTop) {
      player.y = platform.y - player.height
      player.vy = 0
      player.grounded = true
    }
  }
}

function resolveTambourines(previousY: number) {
  const previousBottom = previousY + player.height
  const playerBottom = player.y + player.height

  for (const pad of pads) {
    const overlapsX = player.x + player.width > pad.x && player.x < pad.x + pad.width
    const landsOnTop = previousBottom <= pad.y && playerBottom >= pad.y && player.vy >= 0

    if (overlapsX && landsOnTop) {
      player.y = pad.y - player.height
      player.vy = -820
      player.grounded = false
      pad.pulse = 1
      statusText.value = 'Tamburello!'
    }

    pad.pulse = Math.max(0, pad.pulse - 0.045)
  }
}

function updateHazards(delta: number, previousX: number, previousY: number) {
  for (const hazard of hazards) {
    if (hazard.disabled) {
      continue
    }

    hazard.x += hazard.speed * hazard.direction * delta
    hazard.rotation += hazard.direction * delta * 3.6

    if (hazard.x <= hazard.minX || hazard.x >= hazard.maxX) {
      hazard.direction *= -1
    }

    if (!circleIntersectsRect(hazard.x, hazard.y, hazard.radius, player.x, player.y, player.width, player.height)) {
      continue
    }

    const previousBottom = previousY + player.height
    const cameFromAbove = previousBottom < hazard.y - hazard.radius * 0.35 && player.vy > 0

    if (cameFromAbove) {
      hazard.disabled = true
      player.vy = -460
      player.y = hazard.y - hazard.radius - player.height - 2
      score.value += 80
      statusText.value = 'Tarallo saltato'
      continue
    }

    if (player.invulnerable > 0) {
      continue
    }

    player.x = Math.max(70, previousX - player.direction * 110)
    player.y = Math.min(previousY, GROUND_Y - player.height)
    player.vx = -player.direction * 155
    player.vy = -285
    player.invulnerable = 1.2
    score.value = Math.max(0, score.value - 120)
    statusText.value = 'Occhio al tarallo'
  }
}

function collectItems() {
  for (const collectible of collectibles) {
    if (collectible.collected) {
      continue
    }

    const radius = collectible.kind === 'lemon' ? 17 : 19

    if (!circleIntersectsRect(collectible.x, collectible.y, radius, player.x, player.y, player.width, player.height)) {
      continue
    }

    collectible.collected = true
    collectedCount.value += 1
    score.value += collectible.kind === 'lemon' ? 100 : 180
    statusText.value = collectible.kind === 'lemon' ? 'Limone preso' : 'Corno portafortuna'
  }
}

function resolveFinish() {
  if (finishReached || player.x < WORLD_WIDTH - 185) {
    return
  }

  finishReached = true
  player.vx = 0
  statusText.value = collectedCount.value === totalCollectibles
    ? 'Ricevimento perfetto'
    : 'Arrivato alla masseria'
}

function draw() {
  if (!context) {
    return
  }

  const ctx = context
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)

  drawSky(ctx)
  drawDistantScenery(ctx)
  drawVillage(ctx)
  drawGround(ctx)
  drawPlatforms(ctx)
  drawPads(ctx)
  drawCollectibles(ctx)
  drawHazards(ctx)
  drawFinish(ctx)
  drawPlayer(ctx)
  drawForegroundTiles(ctx)
}

function drawSky(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT)
  gradient.addColorStop(0, '#f7dcae')
  gradient.addColorStop(0.46, '#f9f1d6')
  gradient.addColorStop(1, '#d7dcc1')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)

  ctx.fillStyle = 'rgba(255, 248, 237, 0.7)'
  drawCloud(ctx, 96 - cameraX * 0.08, 80, 1.1)
  drawCloud(ctx, 640 - cameraX * 0.06, 58, 0.86)
  drawCloud(ctx, 1000 - cameraX * 0.07, 112, 0.94)

  ctx.fillStyle = '#d2b767'
  for (let i = 0; i < 9; i += 1) {
    const x = 84 + i * 98 - (cameraX * 0.1) % 98
    drawLemonIcon(ctx, x, 38 + Math.sin(i) * 6, 0.52, 0)
  }
}

function drawDistantScenery(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#87a8ac'
  ctx.fillRect(0, 280, LOGICAL_WIDTH, 42)

  ctx.fillStyle = '#6d8d94'
  ctx.beginPath()
  ctx.moveTo(0, 302)
  ctx.bezierCurveTo(150, 250, 330, 326, 495, 284)
  ctx.bezierCurveTo(650, 244, 785, 300, 960, 258)
  ctx.lineTo(960, 352)
  ctx.lineTo(0, 352)
  ctx.closePath()
  ctx.fill()

  const vesuvioX = 1740 - cameraX * 0.22
  drawVesuvio(ctx, vesuvioX, 142, 1.15)

  ctx.fillStyle = '#798f5a'
  ctx.beginPath()
  ctx.moveTo(0, 348)
  ctx.bezierCurveTo(185, 318, 320, 370, 498, 338)
  ctx.bezierCurveTo(690, 304, 806, 362, 960, 330)
  ctx.lineTo(960, 424)
  ctx.lineTo(0, 424)
  ctx.closePath()
  ctx.fill()
}

function drawVillage(ctx: CanvasRenderingContext2D) {
  const items = [
    { kind: 'trullo', x: 290, y: GROUND_Y, scale: 1.5 },
    { kind: 'olive', x: 560, y: GROUND_Y, scale: 0.95 },
    { kind: 'masseria', x: 900, y: GROUND_Y, scale: 0.82 },
    { kind: 'olive', x: 1240, y: GROUND_Y, scale: 1.04 },
    { kind: 'tambourine', x: 1540, y: GROUND_Y - 28, scale: 0.64 },
    { kind: 'masseria', x: 2060, y: GROUND_Y, scale: 0.9 },
    { kind: 'olive', x: 2400, y: GROUND_Y, scale: 0.96 },
    { kind: 'trullo', x: 2780, y: GROUND_Y, scale: 1.2 },
    { kind: 'tambourine', x: 3060, y: GROUND_Y - 34, scale: 0.7 },
    { kind: 'olive', x: 3360, y: GROUND_Y, scale: 1.1 },
  ] as const

  for (const item of items) {
    const x = item.x - cameraX * 0.64

    if (x < -180 || x > LOGICAL_WIDTH + 180) {
      continue
    }

    if (item.kind === 'trullo') {
      drawTrullo(ctx, x, item.y - 9, item.scale)
    } else if (item.kind === 'olive') {
      drawOliveTree(ctx, x, item.y, item.scale)
    } else if (item.kind === 'masseria') {
      drawMasseria(ctx, x, item.y, item.scale)
    } else {
      drawTambourine(ctx, x, item.y, item.scale, 0)
    }
  }
}

function drawGround(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#d5ba83'
  ctx.fillRect(0, GROUND_Y, LOGICAL_WIDTH, LOGICAL_HEIGHT - GROUND_Y)
  ctx.fillStyle = '#f4eadb'
  ctx.fillRect(0, GROUND_Y, LOGICAL_WIDTH, 12)
  ctx.fillStyle = '#1f4d63'
  ctx.fillRect(0, GROUND_Y + 12, LOGICAL_WIDTH, 5)

  const tileOffset = -((cameraX % 54) + 54)

  for (let x = tileOffset; x < LOGICAL_WIDTH + 54; x += 54) {
    ctx.fillStyle = '#fbf4e7'
    ctx.fillRect(x, GROUND_Y + 22, 48, 40)
    ctx.strokeStyle = '#bc994b'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, GROUND_Y + 22, 48, 40)
    ctx.strokeStyle = x % 108 === 0 ? '#1f4d63' : '#7f9b62'
    ctx.beginPath()
    ctx.moveTo(x + 8, GROUND_Y + 42)
    ctx.quadraticCurveTo(x + 24, GROUND_Y + 28, x + 40, GROUND_Y + 42)
    ctx.quadraticCurveTo(x + 24, GROUND_Y + 56, x + 8, GROUND_Y + 42)
    ctx.stroke()
  }
}

function drawPlatforms(ctx: CanvasRenderingContext2D) {
  for (const platform of platforms) {
    if (platform.tone === 'ground') {
      continue
    }

    const x = platform.x - cameraX

    if (x + platform.width < -40 || x > LOGICAL_WIDTH + 40) {
      continue
    }

    ctx.fillStyle = platform.tone === 'tile' ? '#1f4d63' : '#efe3d0'
    ctx.fillRect(x, platform.y, platform.width, platform.height)
    ctx.fillStyle = platform.tone === 'tile' ? '#f3c84f' : '#b89a4f'
    ctx.fillRect(x, platform.y, platform.width, 7)
    ctx.fillStyle = platform.tone === 'tile' ? '#f9f0df' : '#fff8ed'
    ctx.fillRect(x + 5, platform.y + 8, platform.width - 10, platform.height - 13)

    ctx.strokeStyle = platform.tone === 'tile' ? '#17354a' : '#bd9f64'
    ctx.lineWidth = 1.5
    for (let tx = x + 16; tx < x + platform.width; tx += 34) {
      ctx.beginPath()
      ctx.moveTo(tx, platform.y + 10)
      ctx.lineTo(tx + 14, platform.y + platform.height - 5)
      ctx.stroke()
    }
  }
}

function drawPads(ctx: CanvasRenderingContext2D) {
  for (const pad of pads) {
    const x = pad.x - cameraX

    if (x + pad.width < -50 || x > LOGICAL_WIDTH + 50) {
      continue
    }

    const pulse = 1 + pad.pulse * 0.18
    ctx.save()
    ctx.translate(x + pad.width / 2, pad.y + pad.height / 2)
    ctx.scale(pulse, pulse)
    drawTambourine(ctx, 0, 0, 0.62, -0.08)
    ctx.restore()
  }
}

function drawCollectibles(ctx: CanvasRenderingContext2D) {
  for (const collectible of collectibles) {
    if (collectible.collected) {
      continue
    }

    const screenX = collectible.x - cameraX

    if (screenX < -35 || screenX > LOGICAL_WIDTH + 35) {
      continue
    }

    const bob = Math.sin(elapsed * 4 + collectible.phase) * 6

    if (collectible.kind === 'lemon') {
      drawLemonIcon(ctx, screenX, collectible.y + bob, 0.78, elapsed + collectible.phase)
    } else {
      drawCornicello(ctx, screenX, collectible.y + bob, 0.72, elapsed + collectible.phase)
    }
  }
}

function drawHazards(ctx: CanvasRenderingContext2D) {
  for (const hazard of hazards) {
    if (hazard.disabled) {
      continue
    }

    const x = hazard.x - cameraX

    if (x < -50 || x > LOGICAL_WIDTH + 50) {
      continue
    }

    drawTarallo(ctx, x, hazard.y, hazard.radius, hazard.rotation)
  }
}

function drawFinish(ctx: CanvasRenderingContext2D) {
  const x = WORLD_WIDTH - 190 - cameraX

  if (x < -170 || x > LOGICAL_WIDTH + 80) {
    return
  }

  ctx.save()
  ctx.translate(x, GROUND_Y - 132)
  ctx.fillStyle = '#f8efe0'
  ctx.fillRect(8, 34, 138, 132)
  ctx.fillStyle = '#d8c189'
  ctx.fillRect(0, 18, 154, 18)
  ctx.fillStyle = '#7a3f35'
  ctx.fillRect(0, 0, 154, 18)
  ctx.fillStyle = '#24384d'
  ctx.font = '700 18px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('MASSERIA', 77, 70)
  ctx.fillStyle = '#cf9a42'
  ctx.beginPath()
  ctx.arc(77, 137, 35, Math.PI, 0)
  ctx.lineTo(112, 166)
  ctx.lineTo(42, 166)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff8ed'
  ctx.beginPath()
  ctx.arc(77, 142, 22, Math.PI, 0)
  ctx.lineTo(99, 166)
  ctx.lineTo(55, 166)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawPlayer(ctx: CanvasRenderingContext2D) {
  const x = player.x - cameraX
  const blink = player.invulnerable > 0 && Math.floor(elapsed * 14) % 2 === 0

  if (blink) {
    return
  }

  ctx.save()
  ctx.translate(x + player.width / 2, player.y + player.height / 2)
  ctx.scale(player.direction, 1)
  ctx.translate(-player.width / 2, -player.height / 2)

  const walk = Math.sin(elapsed * 14) * (Math.abs(player.vx) > 20 && player.grounded ? 1 : 0)

  ctx.fillStyle = '#5a3328'
  ctx.fillRect(10, 55, 11, 8)
  ctx.fillRect(24, 55, 13, 8)

  ctx.fillStyle = '#1f4d63'
  ctx.fillRect(11, 31, 22, 27)
  ctx.fillStyle = '#b43d2f'
  ctx.fillRect(6, 25, 30, 24)
  ctx.fillStyle = '#f6b88d'
  ctx.fillRect(2, 30 + walk, 9, 18)
  ctx.fillRect(33, 30 - walk, 8, 18)
  ctx.fillStyle = '#d8c189'
  ctx.fillRect(15, 34, 5, 5)
  ctx.fillRect(25, 34, 5, 5)

  ctx.fillStyle = '#f6b88d'
  ctx.beginPath()
  ctx.arc(22, 16, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 248, 237, 0.75)'
  ctx.beginPath()
  ctx.ellipse(16, 8, 5, 3, -0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3c251d'
  ctx.fillRect(21, 16, 3, 2)
  ctx.beginPath()
  ctx.ellipse(27, 23, 9, 4, 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawForegroundTiles(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(36, 56, 77, 0.08)'
  ctx.fillRect(0, LOGICAL_HEIGHT - 12, LOGICAL_WIDTH, 12)
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.beginPath()
  ctx.ellipse(0, 18, 34, 18, 0, 0, Math.PI * 2)
  ctx.ellipse(30, 13, 30, 22, 0, 0, Math.PI * 2)
  ctx.ellipse(66, 20, 36, 18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawVesuvio(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#5a6450'
  ctx.beginPath()
  ctx.moveTo(-190, 178)
  ctx.lineTo(-42, 48)
  ctx.lineTo(18, 92)
  ctx.lineTo(70, 55)
  ctx.lineTo(224, 178)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#7a3f35'
  ctx.beginPath()
  ctx.moveTo(-22, 78)
  ctx.quadraticCurveTo(22, 60, 62, 82)
  ctx.lineTo(42, 96)
  ctx.quadraticCurveTo(16, 86, -8, 98)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 248, 237, 0.56)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(18, 54)
  ctx.bezierCurveTo(45, 20, 14, 0, 50, -24)
  ctx.moveTo(55, 66)
  ctx.bezierCurveTo(92, 30, 48, 10, 84, -18)
  ctx.stroke()
  ctx.restore()
}

const TRULLO_W = 140
const TRULLO_H = 252
const TRULLO_AX = 70
const TRULLO_AY = 248
const trulloSpriteCache = new Map<number, HTMLCanvasElement>()

function getTrulloSprite(scale: number): HTMLCanvasElement | null {
  const key = Math.round(scale * 100)
  const cached = trulloSpriteCache.get(key)
  if (cached) {
    return cached
  }

  const sw = Math.ceil(TRULLO_W * scale)
  const sh = Math.ceil(TRULLO_H * scale)
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const sctx = canvas.getContext('2d')

  if (!sctx) {
    return null
  }

  sctx.translate(TRULLO_AX * scale, TRULLO_AY * scale)
  sctx.scale(scale, scale)
  paintTrullo(sctx)
  trulloSpriteCache.set(key, canvas)
  return canvas
}

function drawTrullo(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const sprite = getTrulloSprite(scale)

  if (!sprite) {
    return
  }

  ctx.drawImage(sprite, Math.round(x - TRULLO_AX * scale), Math.round(y - TRULLO_AY * scale))
}

function paintTrullo(ctx: CanvasRenderingContext2D) {
  const wallHalf = 38
  const wallTop = -100
  const wallBottom = -10
  const wallH = wallBottom - wallTop
  const baseHalf = 60
  const roofH = 122
  const tipY = wallTop - roofH

  paintTrulloFoundation(ctx, wallBottom)
  paintTrulloWall(ctx, wallHalf, wallTop, wallBottom, wallH)
  paintTrulloDoor(ctx, wallBottom)
  paintTrulloWindow(ctx)
  paintTrulloCone(ctx, wallTop, baseHalf, roofH, tipY)
  paintTrulloSymbol(ctx, wallTop)
  paintTrulloChimney(ctx)
  paintTrulloPinnacle(ctx, tipY)
  paintTrulloPot(ctx)
  paintTrulloIvy(ctx, wallHalf, wallTop)
  paintTrulloGreenery(ctx)
}

function paintTrulloFoundation(ctx: CanvasRenderingContext2D, wallBottom: number) {
  const grad = ctx.createLinearGradient(0, wallBottom, 0, 0)
  grad.addColorStop(0, '#a89070')
  grad.addColorStop(0.45, '#806a4c')
  grad.addColorStop(1, '#4a3c28')
  ctx.fillStyle = grad
  ctx.fillRect(-52, wallBottom, 104, -wallBottom)

  ctx.fillStyle = 'rgba(192, 168, 120, 0.55)'
  ctx.fillRect(-52, wallBottom, 104, 1)

  ctx.strokeStyle = 'rgba(34, 24, 12, 0.6)'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  for (const sx of [-44, -32, -19, -8, 5, 18, 30, 42]) {
    ctx.moveTo(sx, wallBottom + 1)
    ctx.lineTo(sx, -5)
  }
  ctx.moveTo(-52, -5)
  ctx.lineTo(52, -5)
  for (const sx of [-46, -36, -25, -13, 0, 12, 24, 36, 47]) {
    ctx.moveTo(sx, -5)
    ctx.lineTo(sx, -1)
  }
  ctx.stroke()

  ctx.fillStyle = 'rgba(255, 245, 220, 0.18)'
  ctx.fillRect(-44, wallBottom + 1, 1, 4)
  ctx.fillRect(-19, wallBottom + 1, 1, 4)
  ctx.fillRect(18, wallBottom + 1, 1, 4)

  ctx.fillStyle = 'rgba(20, 14, 8, 0.45)'
  ctx.fillRect(-54, -1, 108, 2)
  ctx.fillStyle = 'rgba(20, 14, 8, 0.18)'
  ctx.fillRect(-58, 0, 116, 1)
}

function paintTrulloWall(ctx: CanvasRenderingContext2D, wallHalf: number, wallTop: number, wallBottom: number, wallH: number) {
  const wallGrad = ctx.createLinearGradient(-wallHalf, 0, wallHalf, 0)
  wallGrad.addColorStop(0, '#fff8e8')
  wallGrad.addColorStop(0.16, '#fbf2dc')
  wallGrad.addColorStop(0.42, '#f4e8cd')
  wallGrad.addColorStop(0.72, '#dec9a0')
  wallGrad.addColorStop(0.93, '#a8966e')
  wallGrad.addColorStop(1, '#7a6648')
  ctx.fillStyle = wallGrad
  ctx.fillRect(-wallHalf, wallTop, wallHalf * 2, wallH)

  const eaveGrad = ctx.createLinearGradient(0, wallTop, 0, wallTop + 16)
  eaveGrad.addColorStop(0, 'rgba(35, 25, 14, 0.65)')
  eaveGrad.addColorStop(0.4, 'rgba(35, 25, 14, 0.28)')
  eaveGrad.addColorStop(1, 'rgba(35, 25, 14, 0)')
  ctx.fillStyle = eaveGrad
  ctx.fillRect(-wallHalf, wallTop, wallHalf * 2, 16)

  const baseShadow = ctx.createLinearGradient(0, wallBottom - 12, 0, wallBottom)
  baseShadow.addColorStop(0, 'rgba(35, 25, 14, 0)')
  baseShadow.addColorStop(1, 'rgba(35, 25, 14, 0.32)')
  ctx.fillStyle = baseShadow
  ctx.fillRect(-wallHalf, wallBottom - 12, wallHalf * 2, 12)

  ctx.fillStyle = 'rgba(168, 144, 96, 0.22)'
  ctx.beginPath()
  ctx.ellipse(-wallHalf + 14, wallTop + 30, 7, 4, 0.3, 0, Math.PI * 2)
  ctx.ellipse(-wallHalf + 24, wallTop + 60, 5, 3, -0.2, 0, Math.PI * 2)
  ctx.ellipse(wallHalf - 20, wallTop + 22, 4, 3, 0.5, 0, Math.PI * 2)
  ctx.ellipse(0, wallTop + 78, 8, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(40, 30, 18, 0.18)'
  ctx.fillRect(-wallHalf + 6, wallTop + 44, 1, 22)
  ctx.fillRect(-wallHalf + 18, wallTop + 8, 1, 14)
}

function paintTrulloDoor(ctx: CanvasRenderingContext2D, wallBottom: number) {
  ctx.fillStyle = '#cbb98e'
  ctx.beginPath()
  ctx.moveTo(-16, wallBottom)
  ctx.lineTo(-16, -52)
  ctx.arc(0, -52, 16, Math.PI, 0, false)
  ctx.lineTo(16, wallBottom)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#0a1a14'
  ctx.beginPath()
  ctx.moveTo(-12, wallBottom + 1)
  ctx.lineTo(-12, -52)
  ctx.arc(0, -52, 12, Math.PI, 0, false)
  ctx.lineTo(12, wallBottom + 1)
  ctx.closePath()
  ctx.fill()

  const doorGrad = ctx.createLinearGradient(-12, 0, 12, 0)
  doorGrad.addColorStop(0, '#3a6e5a')
  doorGrad.addColorStop(0.4, '#22463a')
  doorGrad.addColorStop(1, '#0e2a22')
  ctx.fillStyle = doorGrad
  ctx.beginPath()
  ctx.moveTo(-11, wallBottom)
  ctx.lineTo(-11, -51)
  ctx.arc(0, -51, 11, Math.PI, 0, false)
  ctx.lineTo(11, wallBottom)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(8, 24, 18, 0.85)'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(-3.5, -50)
  ctx.lineTo(-3.5, wallBottom)
  ctx.moveTo(3.5, -50)
  ctx.lineTo(3.5, wallBottom)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(110, 180, 150, 0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-10, wallBottom)
  ctx.lineTo(-10, -51)
  ctx.arc(0, -51, 10, Math.PI, Math.PI * 1.4, false)
  ctx.stroke()

  ctx.fillStyle = '#cdb787'
  ctx.beginPath()
  ctx.arc(7, -28, 1.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(40, 30, 18, 0.7)'
  ctx.beginPath()
  ctx.arc(7.3, -27.6, 0.5, 0, Math.PI * 2)
  ctx.fill()

  const stepGrad = ctx.createLinearGradient(0, wallBottom - 2, 0, wallBottom + 3)
  stepGrad.addColorStop(0, '#d4b88a')
  stepGrad.addColorStop(0.6, '#a08866')
  stepGrad.addColorStop(1, '#6a5638')
  ctx.fillStyle = stepGrad
  ctx.fillRect(-19, wallBottom - 2, 38, 5)
  ctx.fillStyle = 'rgba(255, 245, 220, 0.5)'
  ctx.fillRect(-19, wallBottom - 2, 38, 1)
  ctx.fillStyle = 'rgba(35, 25, 14, 0.45)'
  ctx.fillRect(-19, wallBottom + 2, 38, 1)

  ctx.strokeStyle = 'rgba(255, 247, 224, 0.65)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-15, wallBottom)
  ctx.lineTo(-15, -52)
  ctx.arc(0, -52, 15, Math.PI, Math.PI * 1.45, false)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(95, 78, 50, 0.55)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.arc(0, -52, 15, Math.PI * 1.55, 0, false)
  ctx.lineTo(15, wallBottom)
  ctx.stroke()
}

function paintTrulloWindow(ctx: CanvasRenderingContext2D) {
  const wx = 22
  const wyTop = -70
  const r = 5

  ctx.fillStyle = '#cbb98e'
  ctx.beginPath()
  ctx.moveTo(wx, wyTop + 14)
  ctx.lineTo(wx, wyTop + r)
  ctx.arc(wx + r, wyTop + r, r, Math.PI, 0, false)
  ctx.lineTo(wx + r * 2, wyTop + 14)
  ctx.closePath()
  ctx.fill()

  const glassGrad = ctx.createLinearGradient(wx, wyTop, wx + 10, wyTop + 14)
  glassGrad.addColorStop(0, '#9bc8d6')
  glassGrad.addColorStop(0.45, '#3d6e84')
  glassGrad.addColorStop(1, '#1f3a4d')
  ctx.fillStyle = glassGrad
  ctx.beginPath()
  ctx.moveTo(wx + 1.5, wyTop + 13)
  ctx.lineTo(wx + 1.5, wyTop + r)
  ctx.arc(wx + r, wyTop + r, r - 1.5, Math.PI, 0, false)
  ctx.lineTo(wx + 8.5, wyTop + 13)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 248, 230, 0.45)'
  ctx.beginPath()
  ctx.ellipse(wx + 3, wyTop + 3.5, 1.5, 0.7, -0.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#cbb98e'
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.moveTo(wx + r, wyTop + 0.5)
  ctx.lineTo(wx + r, wyTop + 13)
  ctx.moveTo(wx + 1.5, wyTop + 7)
  ctx.lineTo(wx + 8.5, wyTop + 7)
  ctx.stroke()

  const sillGrad = ctx.createLinearGradient(0, wyTop + 13, 0, wyTop + 17)
  sillGrad.addColorStop(0, '#d4b88a')
  sillGrad.addColorStop(0.6, '#a08866')
  sillGrad.addColorStop(1, '#6a5638')
  ctx.fillStyle = sillGrad
  ctx.fillRect(wx - 2, wyTop + 13, 14, 4)
  ctx.fillStyle = 'rgba(255, 245, 220, 0.5)'
  ctx.fillRect(wx - 2, wyTop + 13, 14, 1)
  ctx.fillStyle = 'rgba(35, 25, 14, 0.4)'
  ctx.fillRect(wx - 2, wyTop + 16, 14, 1)
}

function paintTrulloCone(ctx: CanvasRenderingContext2D, wallTop: number, baseHalf: number, roofH: number, tipY: number) {
  const conePath = new Path2D()
  conePath.moveTo(-baseHalf, wallTop + 2)
  conePath.quadraticCurveTo(0, wallTop + 7, baseHalf, wallTop + 2)
  conePath.lineTo(2, tipY)
  conePath.lineTo(-2, tipY)
  conePath.closePath()

  const coneGrad = ctx.createLinearGradient(0, tipY, 0, wallTop + 4)
  coneGrad.addColorStop(0, '#3a3528')
  coneGrad.addColorStop(0.6, '#54503e')
  coneGrad.addColorStop(1, '#6b6450')
  ctx.fillStyle = coneGrad
  ctx.fill(conePath)

  ctx.save()
  ctx.clip(conePath)

  const N = 28
  for (let r = 0; r < N; r++) {
    const t0 = r / N
    const t1 = (r + 1) / N
    const yBot = wallTop - roofH * t0
    const yTop = wallTop - roofH * t1
    const halfBot = baseHalf * (1 - t0) + 1.5 * t0
    const halfTop = baseHalf * (1 - t1) + 1.5 * t1
    const h = yBot - yTop

    ctx.fillStyle = r % 2 === 0 ? '#5a5340' : '#46402f'
    ctx.beginPath()
    ctx.moveTo(-halfBot, yBot)
    ctx.lineTo(-halfTop, yTop)
    ctx.lineTo(halfTop, yTop)
    ctx.lineTo(halfBot, yBot)
    ctx.closePath()
    ctx.fill()

    const stoneCount = Math.max(3, Math.round(halfBot / 2.6))
    const stoneW = (halfBot * 2) / stoneCount
    const stagger = (r % 2) * (stoneW / 2)
    for (let s = 0; s < stoneCount; s++) {
      const sx = -halfBot + s * stoneW + stagger
      if (sx + stoneW > halfBot) {
        continue
      }
      const cx = sx + stoneW / 2
      const xRatio = cx / halfBot
      let tone: string
      if (xRatio < -0.55) {
        tone = r % 2 === 0 ? '#8a8270' : '#73685a'
      } else if (xRatio < -0.15) {
        tone = r % 2 === 0 ? '#6c6552' : '#574f3f'
      } else if (xRatio < 0.25) {
        tone = r % 2 === 0 ? '#52503f' : '#454234'
      } else if (xRatio < 0.65) {
        tone = r % 2 === 0 ? '#3a3729' : '#2f2c20'
      } else {
        tone = r % 2 === 0 ? '#262218' : '#1a1812'
      }
      const seed = ((r * 31 + s * 17) ^ (r << 3)) & 0xff
      const variation = seed % 13
      if (variation === 0) tone = '#615b4b'
      else if (variation === 4) tone = '#332f24'
      else if (variation === 9) tone = '#7a7160'
      else if (variation === 11) tone = '#272318'

      ctx.fillStyle = tone
      ctx.fillRect(sx + 0.15, yTop, stoneW - 0.3, h + 0.5)
    }

    ctx.fillStyle = 'rgba(15, 12, 8, 0.65)'
    ctx.fillRect(-halfBot, yBot - 0.7, halfBot * 2, 0.7)

    if (r % 2 === 0) {
      ctx.fillStyle = 'rgba(170, 152, 118, 0.22)'
      ctx.fillRect(-halfBot * 0.4, yTop, halfBot * 0.55, 0.5)
    }
  }

  const shadowGrad = ctx.createLinearGradient(-baseHalf, 0, baseHalf, 0)
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
  shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)')
  shadowGrad.addColorStop(0.85, 'rgba(15, 10, 6, 0.32)')
  shadowGrad.addColorStop(1, 'rgba(15, 10, 6, 0.55)')
  ctx.fillStyle = shadowGrad
  ctx.fill(conePath)

  const hiGrad = ctx.createLinearGradient(-baseHalf, 0, baseHalf, 0)
  hiGrad.addColorStop(0, 'rgba(255, 232, 188, 0.3)')
  hiGrad.addColorStop(0.4, 'rgba(255, 232, 188, 0)')
  ctx.fillStyle = hiGrad
  ctx.fill(conePath)

  ctx.restore()

  ctx.strokeStyle = 'rgba(20, 16, 12, 0.7)'
  ctx.lineWidth = 0.9
  ctx.stroke(conePath)
}

function paintTrulloSymbol(ctx: CanvasRenderingContext2D, wallTop: number) {
  ctx.save()
  ctx.translate(-12, wallTop - 36)
  ctx.fillStyle = 'rgba(248, 240, 220, 0.82)'
  for (let i = 0; i < 4; i++) {
    ctx.save()
    ctx.rotate((i * Math.PI) / 4)
    ctx.fillRect(-0.7, -3.5, 1.4, 7)
    ctx.restore()
  }
  ctx.fillStyle = 'rgba(255, 245, 220, 0.95)'
  ctx.beginPath()
  ctx.arc(0, 0, 1.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function paintTrulloChimney(ctx: CanvasRenderingContext2D) {
  const cx = -28
  const top = -156
  const bot = -104

  const grad = ctx.createLinearGradient(cx, 0, cx + 10, 0)
  grad.addColorStop(0, '#fbf2dc')
  grad.addColorStop(0.5, '#f0e2c0')
  grad.addColorStop(0.85, '#a8966e')
  grad.addColorStop(1, '#6a5638')
  ctx.fillStyle = grad
  ctx.fillRect(cx, top, 10, bot - top)

  const capGrad = ctx.createLinearGradient(0, top - 5, 0, top)
  capGrad.addColorStop(0, '#8a7a58')
  capGrad.addColorStop(1, '#3a3020')
  ctx.fillStyle = capGrad
  ctx.fillRect(cx - 2, top - 5, 14, 5)
  ctx.fillStyle = 'rgba(255, 247, 224, 0.5)'
  ctx.fillRect(cx - 2, top - 5, 14, 1)

  ctx.fillStyle = '#0a0805'
  ctx.fillRect(cx + 3, top - 3, 4, 3)
  ctx.fillStyle = 'rgba(35, 25, 14, 0.5)'
  ctx.fillRect(cx, top - 0.5, 10, 0.5)

  ctx.fillStyle = 'rgba(255, 248, 230, 0.32)'
  ctx.beginPath()
  ctx.arc(cx + 5, top - 10, 4, 0, Math.PI * 2)
  ctx.arc(cx + 8, top - 17, 5, 0, Math.PI * 2)
  ctx.arc(cx + 4, top - 24, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 248, 230, 0.16)'
  ctx.beginPath()
  ctx.arc(cx + 9, top - 32, 7, 0, Math.PI * 2)
  ctx.arc(cx + 2, top - 38, 6, 0, Math.PI * 2)
  ctx.fill()
}

function paintTrulloPinnacle(ctx: CanvasRenderingContext2D, tipY: number) {
  ctx.fillStyle = '#3a3528'
  ctx.fillRect(-7, tipY, 14, 3)
  ctx.fillStyle = '#85806b'
  ctx.fillRect(-7, tipY, 14, 1)
  ctx.fillStyle = 'rgba(20, 16, 10, 0.6)'
  ctx.fillRect(-7, tipY + 3, 14, 0.5)

  const cylGrad = ctx.createLinearGradient(-5, 0, 5, 0)
  cylGrad.addColorStop(0, '#fff7e0')
  cylGrad.addColorStop(0.4, '#cbb98e')
  cylGrad.addColorStop(1, '#7a6648')
  ctx.fillStyle = cylGrad
  ctx.fillRect(-5, tipY - 7, 10, 7)
  ctx.fillStyle = 'rgba(255, 245, 220, 0.55)'
  ctx.fillRect(-5, tipY - 7, 10, 0.5)

  const sphCY = tipY - 12
  const sphR = 4.5
  ctx.fillStyle = '#cbb98e'
  ctx.beginPath()
  ctx.arc(0, sphCY, sphR, 0, Math.PI * 2)
  ctx.fill()
  const sphGrad = ctx.createRadialGradient(-1.6, sphCY - 1.6, 0, 0, sphCY, sphR)
  sphGrad.addColorStop(0, 'rgba(255, 250, 230, 0.95)')
  sphGrad.addColorStop(0.45, 'rgba(255, 247, 224, 0.18)')
  sphGrad.addColorStop(1, 'rgba(50, 36, 18, 0.6)')
  ctx.fillStyle = sphGrad
  ctx.beginPath()
  ctx.arc(0, sphCY, sphR, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#1a1812'
  ctx.fillRect(-0.7, tipY - 25, 1.4, 9)
  ctx.fillRect(-2.5, tipY - 22, 5, 1.4)
  ctx.fillStyle = '#cbb98e'
  ctx.beginPath()
  ctx.arc(0, tipY - 26.5, 1.3, 0, Math.PI * 2)
  ctx.fill()
}

function paintTrulloPot(ctx: CanvasRenderingContext2D) {
  const px = -32
  const py = -10

  const grad = ctx.createLinearGradient(px, 0, px + 12, 0)
  grad.addColorStop(0, '#e8a070')
  grad.addColorStop(0.32, '#c66e3e')
  grad.addColorStop(0.78, '#8a4a1e')
  grad.addColorStop(1, '#5a2e10')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(px + 1, py - 8)
  ctx.lineTo(px, py)
  ctx.lineTo(px + 12, py)
  ctx.lineTo(px + 11, py - 8)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#9a4a1e'
  ctx.fillRect(px - 1, py - 9.5, 14, 2)
  ctx.fillStyle = '#d4754a'
  ctx.fillRect(px - 1, py - 9.5, 5, 1)
  ctx.fillStyle = 'rgba(35, 14, 6, 0.7)'
  ctx.fillRect(px - 1, py - 7.7, 14, 0.6)
  ctx.fillStyle = 'rgba(35, 14, 6, 0.5)'
  ctx.fillRect(px, py - 0.6, 12, 0.6)

  ctx.fillStyle = '#3a5a2e'
  ctx.beginPath()
  ctx.ellipse(px + 6, py - 14, 6, 4, 0, 0, Math.PI * 2)
  ctx.ellipse(px + 2, py - 12, 4, 3, -0.4, 0, Math.PI * 2)
  ctx.ellipse(px + 10, py - 12, 4, 3, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#6b8a4a'
  ctx.beginPath()
  ctx.ellipse(px + 5, py - 16, 3, 2, 0, 0, Math.PI * 2)
  ctx.ellipse(px + 9, py - 14, 2, 1.4, 0.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#cd5050'
  ctx.beginPath()
  ctx.arc(px + 3, py - 17, 1.3, 0, Math.PI * 2)
  ctx.arc(px + 8, py - 18, 1.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f0a060'
  ctx.beginPath()
  ctx.arc(px + 3, py - 17, 0.5, 0, Math.PI * 2)
  ctx.arc(px + 8, py - 18, 0.5, 0, Math.PI * 2)
  ctx.fill()
}

function paintTrulloIvy(ctx: CanvasRenderingContext2D, wallHalf: number, wallTop: number) {
  ctx.strokeStyle = '#2c4422'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(wallHalf - 2, wallTop + 2)
  ctx.bezierCurveTo(wallHalf - 6, wallTop + 20, wallHalf + 2, wallTop + 38, wallHalf - 4, wallTop + 56)
  ctx.stroke()

  ctx.fillStyle = '#3a5a2e'
  for (const [ix, iy] of [[wallHalf - 3, wallTop + 4], [wallHalf - 5, wallTop + 12], [wallHalf - 1, wallTop + 22], [wallHalf - 4, wallTop + 32], [wallHalf, wallTop + 42], [wallHalf - 3, wallTop + 52]] as const) {
    ctx.beginPath()
    ctx.arc(ix, iy, 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#6b8a4a'
  for (const [ix, iy] of [[wallHalf - 2, wallTop + 7], [wallHalf - 4, wallTop + 16], [wallHalf - 1, wallTop + 27], [wallHalf - 3, wallTop + 47]] as const) {
    ctx.beginPath()
    ctx.arc(ix, iy, 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function paintTrulloGreenery(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#3a5a2e'
  ctx.beginPath()
  ctx.moveTo(-52, -1)
  ctx.lineTo(-50, -7)
  ctx.lineTo(-48, -1)
  ctx.moveTo(-48, -1)
  ctx.lineTo(-46, -8)
  ctx.lineTo(-44, -1)
  ctx.moveTo(-44, -1)
  ctx.lineTo(-42, -6)
  ctx.lineTo(-40, -1)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(40, -1)
  ctx.lineTo(42, -6)
  ctx.lineTo(44, -1)
  ctx.moveTo(44, -1)
  ctx.lineTo(46, -8)
  ctx.lineTo(48, -1)
  ctx.moveTo(48, -1)
  ctx.lineTo(50, -5)
  ctx.lineTo(52, -1)
  ctx.fill()

  ctx.fillStyle = '#6b8a4a'
  ctx.beginPath()
  ctx.moveTo(-49, -2)
  ctx.lineTo(-47, -5)
  ctx.lineTo(-45, -2)
  ctx.moveTo(45, -2)
  ctx.lineTo(47, -5)
  ctx.lineTo(49, -2)
  ctx.fill()

  ctx.fillStyle = '#f3c84f'
  ctx.beginPath()
  ctx.arc(-46, -8, 1, 0, Math.PI * 2)
  ctx.arc(46, -8, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#cd5050'
  ctx.beginPath()
  ctx.arc(-50, -7, 0.8, 0, Math.PI * 2)
  ctx.arc(50, -5, 0.8, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 247, 224, 0.5)'
  ctx.beginPath()
  ctx.arc(-38, -2, 0.8, 0, Math.PI * 2)
  ctx.arc(38, -3, 0.8, 0, Math.PI * 2)
  ctx.fill()
}

function drawOliveTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.strokeStyle = '#6b4c35'
  ctx.lineWidth = 13
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(-9, -42, 10, -72, -18, -100)
  ctx.moveTo(2, -46)
  ctx.bezierCurveTo(26, -70, 28, -96, 54, -118)
  ctx.stroke()
  ctx.fillStyle = '#6f7a5a'
  ctx.beginPath()
  ctx.ellipse(-35, -122, 42, 24, -0.2, 0, Math.PI * 2)
  ctx.ellipse(12, -135, 48, 28, 0.15, 0, Math.PI * 2)
  ctx.ellipse(55, -112, 38, 23, 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d8c189'
  ctx.beginPath()
  ctx.arc(-20, -119, 4, 0, Math.PI * 2)
  ctx.arc(21, -130, 4, 0, Math.PI * 2)
  ctx.arc(58, -112, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawMasseria(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#f8efe0'
  ctx.fillRect(-82, -92, 164, 92)
  ctx.fillStyle = '#d8c189'
  ctx.fillRect(-92, -112, 184, 22)
  ctx.fillStyle = '#7a3f35'
  ctx.fillRect(-92, -124, 184, 14)
  ctx.fillStyle = '#24384d'
  ctx.fillRect(-54, -62, 25, 24)
  ctx.fillRect(30, -62, 25, 24)
  ctx.fillStyle = '#c9954b'
  ctx.beginPath()
  ctx.arc(0, -34, 28, Math.PI, 0)
  ctx.lineTo(28, 0)
  ctx.lineTo(-28, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawTambourine(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#d8c189'
  ctx.beginPath()
  ctx.ellipse(0, 0, 54, 18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#7a3f35'
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.fillStyle = '#fff8ed'
  ctx.beginPath()
  ctx.ellipse(0, 0, 36, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#24384d'
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6
    ctx.beginPath()
    ctx.arc(Math.cos(angle) * 44, Math.sin(angle) * 13, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawLemonIcon(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(rotation) * 0.15)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#f2c84c'
  ctx.beginPath()
  ctx.ellipse(0, 0, 19, 14, -0.45, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff0a4'
  ctx.beginPath()
  ctx.ellipse(-6, -5, 7, 3, -0.45, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#6f7a5a'
  ctx.beginPath()
  ctx.ellipse(14, -14, 7, 4, -0.55, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawCornicello(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(rotation) * 0.12)
  ctx.scale(scale, scale)
  ctx.fillStyle = '#b43d2f'
  ctx.beginPath()
  ctx.moveTo(-15, -16)
  ctx.bezierCurveTo(12, -20, 25, -3, 16, 18)
  ctx.bezierCurveTo(9, 33, 28, 36, 33, 16)
  ctx.bezierCurveTo(34, 44, 4, 51, -11, 27)
  ctx.bezierCurveTo(-23, 8, -28, -7, -15, -16)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#7a3f35'
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.fillStyle = '#d8c189'
  ctx.fillRect(-20, -21, 18, 9)
  ctx.restore()
}

function drawTarallo(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.fillStyle = '#c3863f'
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.arc(0, 0, radius * 0.46, 0, Math.PI * 2, true)
  ctx.fill()
  ctx.strokeStyle = '#8b552b'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#f3d08a'
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath()
    ctx.arc(Math.cos(i * 1.25) * radius * 0.72, Math.sin(i * 1.25) * radius * 0.72, 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function circleIntersectsRect(cx: number, cy: number, radius: number, rx: number, ry: number, rw: number, rh: number) {
  const nearestX = clamp(cx, rx, rx + rw)
  const nearestY = clamp(cy, ry, ry + rh)
  const dx = cx - nearestX
  const dy = cy - nearestY

  return dx * dx + dy * dy <= radius * radius
}

onMounted(() => {
  const canvas = canvasRef.value

  if (!canvas) {
    return
  }

  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return
  }

  context = ctx
  fitCanvas()
  resetGame()

  if ('IntersectionObserver' in window && sectionRef.value) {
    sectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        keyboardActive = entry.isIntersecting && entry.intersectionRatio > 0.3

        if (!keyboardActive) {
          releaseAllControls()
        }
      },
      { threshold: [0, 0.3, 0.6] },
    )
    sectionObserver.observe(sectionRef.value)
  } else {
    keyboardActive = true
  }

  window.addEventListener('resize', fitCanvas)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', releaseAllControls)
  lastTime = performance.now()
  animationFrame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  window.removeEventListener('resize', fitCanvas)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  window.removeEventListener('blur', releaseAllControls)
  sectionObserver?.disconnect()
})
</script>

<template>
  <section ref="sectionRef" class="game-section" aria-labelledby="game-title">
    <div class="game-section__inner">
      <div class="game-section__header">
        <div class="game-section__copy">
          <SectionLabel text="Minigioco" tone="accent" />
          <h2 id="game-title">Super Pelato nel Regno delle Due Coste</h2>
          <p>Una corsa tra pietra pugliese, Vesuvio, limoni, corni e tamburelli.</p>
        </div>

        <div class="game-hud" aria-label="Punteggio">
          <div>
            <span>Tesori</span>
            <strong>{{ collectedCount }}/{{ totalCollectibles }}</strong>
          </div>
          <div>
            <span>Punti</span>
            <strong>{{ score }}</strong>
          </div>
          <div>
            <span>Strada</span>
            <strong>{{ progressPercent }}%</strong>
          </div>
          <div>
            <span>Tempo</span>
            <strong>{{ timeLabel }}</strong>
          </div>
        </div>
      </div>

      <div class="game-frame">
        <canvas
          ref="canvasRef"
          width="960"
          height="540"
          role="img"
          aria-label="Minigioco platform con un eroe pelato tra trulli, ulivi, limoni, corni, tamburelli e Vesuvio."
        />

        <div class="game-controls">
          <p class="game-status" aria-live="polite">{{ statusText }}</p>

          <div class="game-controls__buttons" aria-label="Controlli">
            <button
              class="game-control"
              type="button"
              aria-label="Sinistra"
              @pointerdown="pressControl('left', $event)"
              @pointerup="releaseControl('left', $event)"
              @pointercancel="releaseControl('left', $event)"
              @pointerleave="releaseControl('left', $event)"
            >
              <span aria-hidden="true">&larr;</span>
            </button>
            <button
              class="game-control"
              type="button"
              aria-label="Destra"
              @pointerdown="pressControl('right', $event)"
              @pointerup="releaseControl('right', $event)"
              @pointercancel="releaseControl('right', $event)"
              @pointerleave="releaseControl('right', $event)"
            >
              <span aria-hidden="true">&rarr;</span>
            </button>
            <button
              class="game-control game-control--jump"
              type="button"
              aria-label="Salta"
              @pointerdown="pressControl('jump', $event)"
              @pointerup="releaseControl('jump', $event)"
              @pointercancel="releaseControl('jump', $event)"
              @pointerleave="releaseControl('jump', $event)"
            >
              <span aria-hidden="true">&uarr;</span>
            </button>
            <button class="game-reset" type="button" @click="resetGame">
              Nuova corsa
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.game-section {
  padding: clamp(5rem, 10vw, 8rem) var(--page-gutter);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-maiolica-blue) 88%, #18222a) 0%, #2c4238 52%, var(--color-sage-dark) 100%);
  color: var(--color-paper);
}

.game-section__inner {
  width: min(100%, 1180px);
  margin: 0 auto;
  display: grid;
  gap: 2rem;
}

.game-section__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(22rem, 0.64fr);
  gap: 2rem;
  align-items: end;
}

.game-section__copy {
  max-width: 43rem;
}

.game-section h2 {
  margin: 1rem 0 0;
  color: var(--color-paper);
  font-size: 4.4rem;
  font-weight: 500;
  line-height: 0.96;
}

.game-section__copy p {
  max-width: 36rem;
  margin: 1.35rem 0 0;
  color: color-mix(in srgb, var(--color-paper) 82%, var(--color-gold-soft));
  font-family: var(--font-sans);
  font-size: 1.08rem;
  line-height: 1.75;
}

.game-hud {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid color-mix(in srgb, var(--color-gold-soft) 38%, transparent);
  background: color-mix(in srgb, var(--color-ink) 36%, transparent);
}

.game-hud div {
  min-width: 0;
  padding: 1rem;
  border-right: 1px solid color-mix(in srgb, var(--color-gold-soft) 28%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--color-gold-soft) 28%, transparent);
}

.game-hud div:nth-child(2n) {
  border-right: 0;
}

.game-hud div:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.game-hud span,
.game-status,
.game-reset,
.game-control {
  font-family: var(--font-sans);
}

.game-hud span {
  display: block;
  color: color-mix(in srgb, var(--color-paper) 68%, var(--color-gold-soft));
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  line-height: 1.2;
  text-transform: uppercase;
}

.game-hud strong {
  display: block;
  margin-top: 0.45rem;
  color: var(--color-paper);
  font-family: var(--font-sans);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1;
}

.game-frame {
  border: 1px solid color-mix(in srgb, var(--color-gold-soft) 42%, transparent);
  background: color-mix(in srgb, var(--color-paper) 8%, transparent);
  box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.24);
}

.game-frame canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  background: #f7dcae;
  touch-action: none;
}

.game-controls {
  min-height: 5.25rem;
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem;
  border-top: 1px solid color-mix(in srgb, var(--color-gold-soft) 34%, transparent);
  background: color-mix(in srgb, var(--color-ink) 30%, transparent);
}

.game-status {
  margin: 0;
  color: color-mix(in srgb, var(--color-paper) 86%, var(--color-gold-soft));
  font-size: 0.96rem;
  line-height: 1.45;
}

.game-controls__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
  justify-content: flex-end;
}

.game-control,
.game-reset {
  min-height: 3.25rem;
  border: 1px solid color-mix(in srgb, var(--color-gold-soft) 48%, transparent);
  border-radius: 8px;
  color: var(--color-paper);
  background: color-mix(in srgb, var(--color-maiolica-blue) 64%, var(--color-ink));
  cursor: pointer;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
  touch-action: none;
}

.game-control {
  width: 3.35rem;
  padding: 0;
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1;
}

.game-control--jump {
  background: color-mix(in srgb, var(--color-accent-deep) 78%, var(--color-ink));
}

.game-reset {
  padding: 0 1rem;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.game-control:hover,
.game-reset:hover {
  transform: translateY(-2px);
  border-color: var(--color-gold-soft);
  background: var(--color-accent-deep);
}

.game-control:focus-visible,
.game-reset:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 4px;
}

@media (max-width: 900px) {
  .game-section__header {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .game-hud {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .game-hud div,
  .game-hud div:nth-child(2n),
  .game-hud div:nth-last-child(-n + 2) {
    border-right: 1px solid color-mix(in srgb, var(--color-gold-soft) 28%, transparent);
    border-bottom: 0;
  }

  .game-hud div:last-child {
    border-right: 0;
  }
}

@media (max-width: 700px) {
  .game-section {
    padding-right: 1rem;
    padding-left: 1rem;
  }

  .game-section h2 {
    font-size: 3rem;
  }

  .game-hud {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .game-hud div {
    padding: 0.85rem;
  }

  .game-hud div:nth-child(2n) {
    border-right: 0;
  }

  .game-hud div:nth-child(-n + 2) {
    border-bottom: 1px solid color-mix(in srgb, var(--color-gold-soft) 28%, transparent);
  }

  .game-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .game-controls__buttons {
    justify-content: stretch;
  }

  .game-control {
    flex: 1 1 3.25rem;
  }

  .game-reset {
    flex: 1 1 100%;
  }
}
</style>
