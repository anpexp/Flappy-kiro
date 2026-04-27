# Design Document: Flappy Kiro

## Overview

Flappy Kiro is a single-file (or minimal-file) browser game built with pure vanilla HTML5, CSS, and JavaScript — no frameworks, no build tools, no server. The player controls Ghosty, a ghost sprite, through an endless stream of pipe obstacles. The game features delta-time physics, parallax clouds, particle effects, score popups, screen shake, and a Web Audio API fallback for optional audio assets.

The entire game runs in one HTML file (`index.html`) with an inline or co-located `game.js` script. All assets are loaded from the `assets/` directory. The game is playable by opening `index.html` directly in a browser.

### Key Design Decisions

- **Single canvas, no DOM game elements**: All rendering is done via the Canvas 2D API. The HUD is drawn onto the canvas, not as HTML elements.
- **Fixed-timestep physics with render interpolation**: Physics runs at a fixed 60 Hz tick rate; rendering interpolates between the last two physics states for smooth visuals at any display refresh rate.
- **Central CONFIG object**: Every tunable constant lives in one `CONFIG` object at the top of the script. No magic numbers in game logic.
- **Subsystem objects, not classes**: Each subsystem (`StateMachine`, `PhysicsEngine`, `CollisionDetector`, `Renderer`, `InputHandler`, `AudioManager`, `ScoreManager`) is a plain JavaScript object with methods. This keeps the code readable and avoids transpilation.
- **Web Audio API fallback**: `score.wav` and `music.wav` are optional. If absent, the `AudioManager` synthesizes equivalents using the Web Audio API.

---

## Architecture

### File Structure

```
flappy-kiro/
├── index.html          # Game entry point — canvas, script tag, minimal CSS
├── game.js             # All game logic (or inlined in index.html)
└── assets/
    ├── ghosty.png      # Ghosty sprite (required)
    ├── jump.wav        # Flap sound effect (required)
    ├── game_over.wav   # Game over sound effect (required)
    ├── score.wav       # Score sound effect (optional — fallback to synthesis)
    └── music.wav       # Background music (optional — fallback to synthesis)
```

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                      game.js                         │   │
│  │                                                      │   │
│  │  CONFIG ──────────────────────────────────────────►  │   │
│  │                                                      │   │
│  │  ┌────────────┐    ┌──────────────┐                  │   │
│  │  │StateMachine│◄───│ InputHandler │                  │   │
│  │  └─────┬──────┘    └──────────────┘                  │   │
│  │        │                                             │   │
│  │        ▼                                             │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │              Game Loop (rAF)                │    │   │
│  │  │  ┌──────────────┐  ┌──────────────────────┐ │    │   │
│  │  │  │PhysicsEngine │  │  CollisionDetector   │ │    │   │
│  │  │  └──────────────┘  └──────────────────────┘ │    │   │
│  │  │  ┌──────────────┐  ┌──────────────────────┐ │    │   │
│  │  │  │ ScoreManager │  │    AudioManager      │ │    │   │
│  │  │  └──────────────┘  └──────────────────────┘ │    │   │
│  │  │  ┌──────────────────────────────────────────┐│    │   │
│  │  │  │              Renderer                    ││    │   │
│  │  │  └──────────────────────────────────────────┘│    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### CONFIG

The single source of truth for all tunable constants.

```js
const CONFIG = {
  // Physics
  GRAVITY: 0.5,
  FLAP_VELOCITY: -8,
  MAX_FALL_VELOCITY: 12,
  MAX_RISE_VELOCITY: -10,

  // Pipes
  PIPE_SPACING: 300,
  PIPE_SPEED: 3,
  GAP_SIZE: 160,
  GAP_MIN_Y: 80,
  GAP_MAX_Y: 80,
  PIPE_SPEED_INCREMENT: 0.5,
  PIPE_SPEED_INTERVAL: 5,
  PIPE_SPEED_MAX: 8,

  // Collision
  HITBOX_SHRINK: 0.6,
  INVINCIBILITY_FRAMES: 60,
  COLLISION_FLASH_DURATION: 500,

  // Visuals
  SHAKE_MAGNITUDE: 8,
  PARTICLE_LIFETIME: 300,
  SCORE_POPUP_DURATION: 600,

  // Audio
  SFX_VOLUME: 0.8,
  MUSIC_VOLUME: 0.4,
};
```

### StateMachine

Manages the four game states: `menu`, `playing`, `paused`, `game_over`.

```js
StateMachine = {
  state: 'menu',           // current state string
  transition(newState),    // validates and executes state change, fires onEnter/onExit hooks
  is(state),               // returns true if current state matches
  onEnter: { menu, playing, paused, game_over },  // callbacks fired on state entry
  onExit:  { menu, playing, paused, game_over },  // callbacks fired on state exit
}
```

### PhysicsEngine

Applies gravity, velocity clamping, and position integration to Ghosty. Operates on a fixed timestep.

```js
PhysicsEngine = {
  update(ghosty, dt),      // apply gravity, clamp velocity, integrate position
  flap(ghosty),            // set ghosty.vy = CONFIG.FLAP_VELOCITY
  ceilingBounce(ghosty),   // reverse vy, clamp y=0, set invincibility
}
```

### CollisionDetector

Computes hitboxes and checks overlaps.

```js
CollisionDetector = {
  getHitbox(ghosty),                    // returns {x,y,w,h} shrunk by HITBOX_SHRINK
  checkPipes(ghosty, pipes),            // returns true if hitbox overlaps any pipe rect
  checkGround(ghosty, groundY),         // returns true if ghosty bottom >= groundY
  checkCeiling(ghosty),                 // returns true if ghosty top <= 0
}
```

### Renderer

Draws everything to the canvas each frame. Receives interpolation alpha for smooth rendering.

```js
Renderer = {
  ctx,                                  // CanvasRenderingContext2D
  draw(gameState, alpha),               // master draw call — clears and redraws all layers
  drawBackground(),
  drawClouds(clouds),
  drawPipes(pipes),
  drawGhosty(ghosty, alpha),
  drawParticles(particles),
  drawScorePopups(popups),
  drawHUD(score, highScore),
  drawMenuOverlay(highScore),
  drawPausedOverlay(),
  drawGameOverOverlay(score, highScore, isNewHighScore),
  applyShake(magnitude),                // translates canvas context for shake effect
}
```

### InputHandler

Listens for keyboard and pointer events and routes them to the appropriate subsystem.

```js
InputHandler = {
  init(),                               // attach event listeners
  onFlap: null,                         // callback set by game loop
  onPause: null,                        // callback set by game loop
}
```

### AudioManager

Loads and plays audio. Falls back to Web Audio API synthesis when optional files are absent.

```js
AudioManager = {
  audioCtx,                             // AudioContext (created on first user gesture)
  init(),                               // preload required assets
  playJump(),
  playGameOver(),
  playScore(),                          // plays score.wav or synthesizes beep
  startMusic(),                         // plays music.wav or synthesizes chiptune loop
  pauseMusic(),
  resumeMusic(),
  stopMusic(),
}
```

### ScoreManager

Tracks current score and high score, persists to localStorage.

```js
ScoreManager = {
  score: 0,
  highScore: 0,
  init(),                               // load highScore from localStorage
  increment(),                          // score++, check for new high score
  checkAndPersist(),                    // if score > highScore, update and save
  reset(),                              // score = 0
  isNewHighScore(),                     // returns true if score == highScore && highScore > 0
}
```

---

## Game Loop Design

The game uses a **fixed-timestep physics loop with render interpolation**, a well-established pattern for deterministic physics at variable frame rates.

### Fixed Timestep with Interpolation

```
FIXED_DT = 1000 / 60  (≈16.67 ms — 60 Hz physics tick)

let accumulator = 0
let prevTime = performance.now()
let prevGhostyState = { ...ghosty }

function gameLoop(now) {
  requestAnimationFrame(gameLoop)

  if (state === 'paused') {
    renderer.draw(state, 1.0)  // draw frozen frame
    return
  }

  let elapsed = now - prevTime
  prevTime = now
  if (elapsed > 250) elapsed = 250  // spiral-of-death guard

  accumulator += elapsed

  while (accumulator >= FIXED_DT) {
    prevGhostyState = snapshot(ghosty)
    physicsEngine.update(ghosty, FIXED_DT / 1000)
    updatePipes(FIXED_DT / 1000)
    updateClouds(FIXED_DT / 1000)
    updateParticles(FIXED_DT / 1000)
    updateScorePopups(FIXED_DT / 1000)
    collisionDetector.check()
    accumulator -= FIXED_DT
  }

  const alpha = accumulator / FIXED_DT  // interpolation factor [0, 1)
  renderer.draw(state, alpha, prevGhostyState)
}
```

### Why Fixed Timestep?

- Physics results are deterministic regardless of display refresh rate (60 Hz, 120 Hz, 144 Hz).
- Render interpolation eliminates jitter by blending between the last two physics states.
- The spiral-of-death guard (cap elapsed at 250 ms) prevents runaway accumulation after tab switches or debugger pauses.

---

## State Machine Transitions

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
              ┌──────────┐   Space / Tap    ┌──────────────┐  │
  [load] ───► │   menu   │ ───────────────► │   playing    │  │
              └──────────┘                  └──────┬───────┘  │
                                                   │          │
                                         Esc/Pause │          │
                                                   ▼          │
                                            ┌──────────┐      │
                                            │  paused  │      │
                                            └──────┬───┘      │
                                                   │          │
                                         Esc/Tap   │          │
                                                   ▼          │
                                            ┌──────────┐      │
                                            │ playing  │      │
                                            └──────┬───┘      │
                                                   │          │
                                    lethal         │          │
                                    collision      ▼          │
                                            ┌──────────────┐  │
                                            │  game_over   │  │
                                            └──────┬───────┘  │
                                                   │          │
                                         Space/Tap │          │
                                                   └──────────┘
                                                   (→ playing, not menu)
```

### State Entry Actions

| State | On Enter |
|---|---|
| `menu` | Reset Ghosty to idle center position; load highScore; start cloud animation |
| `playing` | Reset all entities (on restart); start music; enable physics |
| `paused` | Pause music; freeze game loop updates |
| `game_over` | Stop music; play game_over.wav; trigger shake/flash; check/persist highScore |

### State Exit Actions

| State | On Exit |
|---|---|
| `playing` → `paused` | Snapshot current physics state |
| `paused` → `playing` | Resume music; restore physics state |
| `game_over` → `playing` | Full reset: Ghosty, pipes, clouds, particles, score |

---

## Rendering Pipeline and Draw Order

Every frame, `Renderer.draw()` executes the following draw order. This ensures correct layering.

```
1. Save canvas context state
2. Apply screen shake transform (if active)
3. Clear canvas (fillRect with sky blue)
4. Draw background texture (sketchy lines/noise overlay)
5. Draw clouds (parallax background layer)
6. Draw pipes (green fill + cap/lip)
7. Draw particles (Ghosty's trail — behind Ghosty)
8. Draw Ghosty (interpolated position, ghosty.png)
9. Draw score popups ("+1" floating text)
10. Draw HUD bar (dark bottom bar, score text)
11. Draw state overlay (menu / paused / game_over — if applicable)
12. Restore canvas context state
```

### Pipe Drawing Detail

Each `PipePair` consists of two pipe segments:
- **Top pipe**: drawn from `y=0` down to `gapTop = gapCenterY - GAP_SIZE/2`
- **Bottom pipe**: drawn from `gapBottom = gapCenterY + GAP_SIZE/2` down to the ground

Each pipe segment gets a rectangular cap/lip (wider rectangle) at its open end, matching the classic Flappy Bird style.

### HUD Layout

```
┌─────────────────────────────────────────────────────┐
│                   CANVAS (play area)                │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Score: 12 | High: 47          [dark HUD bar]       │
└─────────────────────────────────────────────────────┘
```

HUD height is a constant (e.g., 50 px). The ground collision boundary is `canvas.height - HUD_HEIGHT`.

---

## Physics System Design

### Coordinate System

- Origin `(0, 0)` is the top-left of the canvas.
- Positive Y is downward.
- Gravity accelerates in the positive Y direction.
- Flap applies a negative Y velocity impulse.

### Update Equations (per fixed tick, dt in seconds)

```
// Apply gravity
ghosty.vy += CONFIG.GRAVITY * (dt * 60)   // scale to 60 Hz baseline

// Clamp velocity
ghosty.vy = clamp(ghosty.vy, CONFIG.MAX_RISE_VELOCITY, CONFIG.MAX_FALL_VELOCITY)

// Integrate position
ghosty.y += ghosty.vy * (dt * 60)
```

> The `dt * 60` factor normalizes delta-time so that `GRAVITY = 0.5` means "0.5 px/frame at 60 fps", matching the intuitive per-frame constants in CONFIG.

### Flap

```
ghosty.vy = CONFIG.FLAP_VELOCITY   // replaces current velocity
```

### Ceiling Bounce

```
if (ghosty.y <= 0) {
  ghosty.y = 0
  ghosty.vy = Math.abs(ghosty.vy)   // reverse to positive (downward)
  ghosty.invincibilityFrames = CONFIG.INVINCIBILITY_FRAMES
}
```

### Render Interpolation

```
renderedY = prevGhostyY + alpha * (ghosty.y - prevGhostyY)
```

Where `alpha = accumulator / FIXED_DT` is the fractional progress through the current physics tick.

---

## Collision Detection Approach

### Ghosty Hitbox (Shrunk AABB)

```
hitbox = {
  x: ghosty.x + ghosty.width  * (1 - CONFIG.HITBOX_SHRINK) / 2,
  y: ghosty.y + ghosty.height * (1 - CONFIG.HITBOX_SHRINK) / 2,
  w: ghosty.width  * CONFIG.HITBOX_SHRINK,
  h: ghosty.height * CONFIG.HITBOX_SHRINK,
}
```

The hitbox is centered within the sprite, smaller than the visible image, giving a forgiving feel.

### Pipe Hitbox (Exact AABB)

Each pipe segment is a full-width, full-height rectangle. No shrink applied.

### AABB Overlap Test

```js
function overlaps(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}
```

### Collision Check Order (per physics tick)

1. Check ceiling → Ceiling_Bounce (non-lethal)
2. Check ground → `game_over`
3. If `invincibilityFrames > 0`: decrement and skip pipe checks
4. Check each active pipe's top and bottom segments → `game_over`

### Score Detection

A pipe is "passed" when `ghosty.x > pipe.x + PIPE_WIDTH` and the pipe has not yet been scored. The `PipePair` carries a `scored: false` flag that is set to `true` on first pass.

---

## Audio System Design

### AudioContext Lifecycle

The `AudioContext` is created lazily on the first user gesture (Space, click, or tap) to comply with browser autoplay policies. All audio operations before this point are queued and replayed after context creation.

```
User gesture → AudioManager.unlock() → create AudioContext → load/decode assets → play queued sounds
```

### Asset Loading Strategy

```
Required (preloaded via fetch + decodeAudioData):
  assets/jump.wav
  assets/game_over.wav

Optional (attempted load; fallback to synthesis on 404 or error):
  assets/score.wav    → fallback: short ascending beep (Web Audio API oscillator)
  assets/music.wav    → fallback: chiptune loop (Web Audio API oscillator sequence)
```

### Sound Playback

Each sound effect is played by creating a new `AudioBufferSourceNode` from the decoded buffer, connecting it through a `GainNode` set to `SFX_VOLUME`, and starting it. This allows overlapping playback (e.g., rapid flaps).

```
buffer → AudioBufferSourceNode → GainNode (SFX_VOLUME) → audioCtx.destination
```

### Background Music

Music uses a single `AudioBufferSourceNode` with `loop = true` (for `music.wav`) or a custom oscillator-based chiptune sequencer (for the fallback). The music node is connected through a `GainNode` set to `MUSIC_VOLUME`.

Pause/resume is implemented by:
- **Pause**: record `pauseTime = audioCtx.currentTime - startTime`; stop the source node.
- **Resume**: create a new source node; start it with `offset = pauseTime`.

### Web Audio API Chiptune Fallback

The fallback chiptune is a simple repeating melody using `OscillatorNode` with `type = 'square'`. A short sequence of notes (e.g., C5, E5, G5, E5) is scheduled using `oscillator.frequency.setValueAtTime()` and loops via a `setInterval` scheduler.

The score beep fallback is a single short `OscillatorNode` burst (e.g., 880 Hz, 80 ms, triangle wave).

---

## Data Models

### Ghosty

```js
{
  x: number,              // left edge position (px)
  y: number,              // top edge position (px)
  prevY: number,          // y position at previous physics tick (for interpolation)
  width: number,          // sprite render width (px)
  height: number,         // sprite render height (px)
  vy: number,             // vertical velocity (px/frame at 60 Hz baseline)
  invincibilityFrames: number,  // frames remaining of invincibility (0 = not invincible)
  image: HTMLImageElement,      // loaded ghosty.png
}
```

### PipePair

```js
{
  x: number,              // left edge of both pipes (px)
  gapCenterY: number,     // vertical center of the gap (px)
  width: number,          // pipe width (px, constant)
  scored: boolean,        // true once Ghosty has passed this pipe
  // Derived (computed on access):
  // topPipeRect:    { x, y:0, w:width, h: gapCenterY - GAP_SIZE/2 }
  // bottomPipeRect: { x, y: gapCenterY + GAP_SIZE/2, w:width, h: canvas.height - (gapCenterY + GAP_SIZE/2) }
}
```

### Cloud

```js
{
  x: number,              // left edge (px)
  y: number,              // top edge (px)
  width: number,          // cloud width (px, randomized)
  height: number,         // cloud height (px, randomized)
  speed: number,          // scroll speed (px/frame at 60 Hz baseline)
  alpha: number,          // opacity (0–1, randomized for depth effect)
}
```

### Particle

```js
{
  x: number,              // current x position (px)
  y: number,              // current y position (px)
  vx: number,             // horizontal velocity (px/frame)
  vy: number,             // vertical velocity (px/frame)
  life: number,           // remaining lifetime (ms)
  maxLife: number,        // initial lifetime = CONFIG.PARTICLE_LIFETIME (ms)
  radius: number,         // dot radius (px)
  // alpha derived as: life / maxLife
}
```

### ScorePopup

```js
{
  x: number,              // initial x position (near Ghosty)
  y: number,              // current y position (floats upward)
  life: number,           // remaining lifetime (ms)
  maxLife: number,        // initial lifetime = CONFIG.SCORE_POPUP_DURATION (ms)
  // alpha derived as: life / maxLife
  // text: "+1" (constant)
}
```

### GameState (top-level)

```js
{
  state: StateMachine,
  ghosty: Ghosty,
  pipes: PipePair[],
  clouds: Cloud[],
  particles: Particle[],
  scorePopups: ScorePopup[],
  currentPipeSpeed: number,   // starts at CONFIG.PIPE_SPEED, increases with score
  shakeTimer: number,         // ms remaining for screen shake (0 = no shake)
  isNewHighScore: boolean,    // set true when game_over with new record
}
```

---

## Configuration Constants Table

| Constant | Default | Unit | Description |
|---|---|---|---|
| `GRAVITY` | 0.5 | px/frame² | Downward acceleration applied each frame |
| `FLAP_VELOCITY` | -8 | px/frame | Upward velocity impulse on flap |
| `MAX_FALL_VELOCITY` | 12 | px/frame | Terminal downward velocity cap |
| `MAX_RISE_VELOCITY` | -10 | px/frame | Maximum upward velocity cap |
| `PIPE_SPACING` | 300 | px | Horizontal distance between consecutive pipe pairs |
| `PIPE_SPEED` | 3 | px/frame | Initial pipe scroll speed |
| `GAP_SIZE` | 160 | px | Vertical height of the gap between pipes |
| `GAP_MIN_Y` | 80 | px | Minimum gap center distance from top of play area |
| `GAP_MAX_Y` | 80 | px | Minimum gap center distance from bottom of play area |
| `PIPE_SPEED_INCREMENT` | 0.5 | px/frame | Speed increase per difficulty step |
| `PIPE_SPEED_INTERVAL` | 5 | pipes | Score interval between difficulty increases |
| `PIPE_SPEED_MAX` | 8 | px/frame | Maximum pipe scroll speed |
| `HITBOX_SHRINK` | 0.6 | ratio | Ghosty hitbox size as fraction of sprite size |
| `INVINCIBILITY_FRAMES` | 60 | frames | Invincibility duration after ceiling bounce |
| `COLLISION_FLASH_DURATION` | 500 | ms | Duration of flash/shake effect on lethal collision |
| `SHAKE_MAGNITUDE` | 8 | px | Maximum canvas offset during screen shake |
| `PARTICLE_LIFETIME` | 300 | ms | Lifetime of each trail particle |
| `SCORE_POPUP_DURATION` | 600 | ms | Duration of "+1" score popup |
| `SFX_VOLUME` | 0.8 | 0–1 | Volume for all sound effects |
| `MUSIC_VOLUME` | 0.4 | 0–1 | Volume for background music |


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Prework Reflection

Before writing properties, I reviewed all testable criteria from the prework and eliminated redundancy:

- **3.4 and 3.5** (velocity clamping) can be combined into one property: "velocity is always within [MAX_RISE_VELOCITY, MAX_FALL_VELOCITY]".
- **3.1 and 3.2** (gravity application and position integration) are distinct enough to keep separate — one tests velocity accumulation, the other tests position update.
- **4.6 and 4.7** (speed increment and speed cap) can be combined: "pipe speed after N score increments is always clamped to PIPE_SPEED_MAX".
- **7.2** (HUD format) and **1.3** (menu high score format) are both format-string properties but test different functions — keep separate.
- **10.9 and 10.10** (SFX volume and music volume) can be combined into one volume property.
- **6.1 and 6.3** (hitbox computation and pipe collision) are distinct — hitbox geometry vs. collision outcome.

After reflection, the final property set is:

---

### Property 1: Velocity is always within bounds

*For any* sequence of physics updates (gravity applications and flap actions), Ghosty's vertical velocity shall always remain within the range `[MAX_RISE_VELOCITY, MAX_FALL_VELOCITY]`.

**Validates: Requirements 3.4, 3.5**

---

### Property 2: Gravity accumulates velocity correctly

*For any* initial velocity `v0` and number of physics ticks `n` (with no flap), the velocity after `n` ticks shall equal `clamp(v0 + n * GRAVITY, MAX_RISE_VELOCITY, MAX_FALL_VELOCITY)`.

**Validates: Requirements 3.1**

---

### Property 3: Position integrates from velocity

*For any* Ghosty position `y0` and velocity `vy`, after one physics tick the position shall equal `y0 + vy * dt_normalized`.

**Validates: Requirements 3.2**

---

### Property 4: Delta-time scaling is proportional

*For any* delta-time value `dt`, the velocity change applied by gravity shall equal `GRAVITY * (dt * 60)`, so that physics behavior is consistent regardless of frame rate.

**Validates: Requirements 3.7**

---

### Property 5: Render interpolation is a linear blend

*For any* alpha value in `[0, 1]`, the rendered Y position of Ghosty shall equal `prevY + alpha * (currentY - prevY)`.

**Validates: Requirements 3.8**

---

### Property 6: Pipe gap size is always GAP_SIZE

*For any* spawned `PipePair`, the vertical distance between the bottom of the top pipe and the top of the bottom pipe shall equal `GAP_SIZE`.

**Validates: Requirements 4.4**

---

### Property 7: Pipe gap center is always within valid bounds

*For any* spawned `PipePair`, the gap center Y shall satisfy `GAP_MIN_Y <= gapCenterY <= (playAreaHeight - GAP_MAX_Y)`, ensuring the gap is never clipped by the canvas boundary or HUD.

**Validates: Requirements 4.5**

---

### Property 8: Pipe speed is always capped at PIPE_SPEED_MAX

*For any* score value, the current pipe scroll speed shall never exceed `PIPE_SPEED_MAX`, regardless of how many difficulty increments have been applied.

**Validates: Requirements 4.6, 4.7**

---

### Property 9: Ghosty hitbox is centered and shrunk by HITBOX_SHRINK

*For any* Ghosty sprite dimensions `(w, h)`, the computed hitbox shall have dimensions `(w * HITBOX_SHRINK, h * HITBOX_SHRINK)` and be centered within the sprite bounds.

**Validates: Requirements 6.1**

---

### Property 10: Pipe collision triggers game_over when not invincible

*For any* Ghosty position that overlaps a pipe rectangle (using the shrunk hitbox) and where `invincibilityFrames == 0`, the game shall transition to the `game_over` state.

**Validates: Requirements 6.3**

---

### Property 11: Score increments by exactly 1 per pipe passage

*For any* pipe that Ghosty passes through, the score shall increase by exactly 1, and the same pipe shall not be scored again.

**Validates: Requirements 7.1**

---

### Property 12: HUD format string is correct for any score values

*For any* non-negative integer values of `score` and `highScore`, the HUD text shall equal the string `"Score: " + score + " | High: " + highScore"`.

**Validates: Requirements 7.2**

---

### Property 13: High score is updated and persisted when score exceeds it

*For any* session where the final score exceeds the stored high score, the high score shall be updated to the session score and written to `localStorage` under the key `flappyKiro_highScore`.

**Validates: Requirements 7.3**

---

### Property 14: Audio volume is always set to configured constants

*For any* sound effect playback, the gain node volume shall equal `SFX_VOLUME`; for any music playback, the gain node volume shall equal `MUSIC_VOLUME`.

**Validates: Requirements 10.9, 10.10**

---

### Property 15: Pause-resume preserves game state

*For any* game state (Ghosty position/velocity, pipe positions, cloud positions, score), transitioning to `paused` and then back to `playing` shall leave all entity positions, velocities, and the score unchanged.

**Validates: Requirements 11.6**

---

### Property 16: Particle trail is emitted continuously during playing

*For any* frame while the game is in the `playing` state, at least one new particle shall be added to the particle list at Ghosty's current position, with `life == PARTICLE_LIFETIME`.

**Validates: Requirements 9.7, 12.4**

---

### Property 17: Score popup is created at Ghosty's position on score increment

*For any* score increment event, a new `ScorePopup` shall be added to the popup list at Ghosty's current position with `life == SCORE_POPUP_DURATION`.

**Validates: Requirements 9.8, 12.3**

---

## Error Handling

### Asset Loading Failures

- **Required assets** (`ghosty.png`, `jump.wav`, `game_over.wav`): If loading fails, the game logs a console error and continues. Ghosty falls back to a simple white rectangle if the image fails. Audio failures are silently swallowed (no crash).
- **Optional assets** (`score.wav`, `music.wav`): A 404 or network error triggers the Web Audio API fallback silently. No user-visible error.

### localStorage Unavailability

If `localStorage` is unavailable (e.g., private browsing with storage blocked), `ScoreManager` catches the exception and operates with an in-memory high score only. The high score will not persist across sessions but the game will function normally.

### AudioContext Suspension

Browsers may suspend the `AudioContext` after a period of inactivity. The `AudioManager` checks `audioCtx.state` before each playback call and calls `audioCtx.resume()` if suspended, then plays the sound in the resolved promise.

### Frame Rate Anomalies

The spiral-of-death guard caps `elapsed` at 250 ms per frame. This prevents the physics accumulator from running hundreds of ticks after a tab switch or debugger pause, which would cause Ghosty to teleport.

---

## Testing Strategy

### PBT Applicability Assessment

Flappy Kiro has significant pure-logic subsystems (physics engine, collision detector, score manager, audio volume routing) that are well-suited to property-based testing. The rendering and UI layers are not suitable for PBT and will use example-based tests or visual inspection.

### Dual Testing Approach

**Unit / Example Tests** (specific scenarios):
- State machine transitions (menu → playing, playing → paused, etc.)
- Ceiling bounce behavior (velocity reversal, position clamp, invincibility grant)
- Ground collision triggers game_over
- Score reset on restart
- localStorage read/write for high score
- Audio asset fallback path (mock fetch to return 404)
- Pipe removal when off-screen
- Cloud removal when off-screen

**Property-Based Tests** (universal properties, minimum 100 iterations each):

The recommended PBT library is **fast-check** (JavaScript). Each property test is tagged with a comment referencing the design property.

| Test | Property | fast-check Arbitraries |
|---|---|---|
| Velocity bounds | Property 1 | `fc.array(fc.oneof(fc.constant('gravity'), fc.constant('flap')))` |
| Gravity accumulation | Property 2 | `fc.float(), fc.integer({min:1, max:200})` |
| Position integration | Property 3 | `fc.float(), fc.float()` |
| Delta-time scaling | Property 4 | `fc.float({min:0.001, max:0.1})` |
| Render interpolation | Property 5 | `fc.float({min:0, max:1}), fc.float(), fc.float()` |
| Gap size invariant | Property 6 | `fc.integer({min:1, max:100})` (spawn N pipes) |
| Gap center bounds | Property 7 | `fc.integer({min:1, max:100})` (spawn N pipes) |
| Pipe speed cap | Property 8 | `fc.integer({min:0, max:1000})` (score values) |
| Hitbox geometry | Property 9 | `fc.float({min:10, max:200}), fc.float({min:10, max:200})` |
| Pipe collision → game_over | Property 10 | `fc.record({x: fc.float(), y: fc.float()})` (overlapping positions) |
| Score increment | Property 11 | `fc.integer({min:1, max:50})` (pipe passages) |
| HUD format string | Property 12 | `fc.nat(), fc.nat()` |
| High score persistence | Property 13 | `fc.nat(), fc.nat()` (score > highScore pairs) |
| Audio volume | Property 14 | `fc.float({min:0, max:1})` (SFX_VOLUME values) |
| Pause-resume state preservation | Property 15 | `fc.record({y: fc.float(), vy: fc.float(), score: fc.nat()})` |
| Particle emission | Property 16 | `fc.integer({min:1, max:60})` (frame counts) |
| Score popup creation | Property 17 | `fc.integer({min:1, max:20})` (score increments) |

**Tag format for each property test:**
```js
// Feature: flappy-kiro, Property N: <property_text>
```

### Integration / Visual Tests

- Render pipeline draw order (clouds behind pipes behind Ghosty)
- Screen shake applies canvas transform offset
- Game over overlay displays correct score and high score
- New high score flashing animation activates correctly
- Parallax cloud speeds differ between clouds

### Test Configuration

- Each property test: minimum **100 iterations** (`fc.assert(fc.property(...), { numRuns: 100 })`)
- Tests run in Node.js (no browser required for logic tests)
- Rendering tests use a mock `CanvasRenderingContext2D` (record draw calls)
