# Implementation Plan: Flappy Kiro

## Overview

Implement a single-file browser game (`index.html` + `game.js`) using pure vanilla JavaScript and the HTML5 Canvas API. The implementation follows the seven-subsystem architecture defined in the design: StateMachine, PhysicsEngine, CollisionDetector, Renderer, InputHandler, AudioManager, and ScoreManager — all wired together by a fixed-timestep game loop.

## Tasks

- [x] 1. Project scaffolding and CONFIG object
  - Create `index.html` with a `<canvas>` element, minimal CSS (centered canvas, dark background), and a `<script src="game.js">` tag
  - Create `game.js` with the full `CONFIG` object containing all tunable constants: `GRAVITY`, `FLAP_VELOCITY`, `MAX_FALL_VELOCITY`, `MAX_RISE_VELOCITY`, `PIPE_SPACING`, `PIPE_SPEED`, `GAP_SIZE`, `GAP_MIN_Y`, `GAP_MAX_Y`, `PIPE_SPEED_INCREMENT`, `PIPE_SPEED_INTERVAL`, `PIPE_SPEED_MAX`, `HITBOX_SHRINK`, `INVINCIBILITY_FRAMES`, `COLLISION_FLASH_DURATION`, `SHAKE_MAGNITUDE`, `PARTICLE_LIFETIME`, `SCORE_POPUP_DURATION`, `SFX_VOLUME`, `MUSIC_VOLUME`
  - Define canvas dimensions and `HUD_HEIGHT` constant
  - Stub out empty objects for all seven subsystems and the top-level `GameState`
  - _Requirements: 3.9, 4.8, 6.10, 9.10, 10.12, 12.1_

- [x] 2. StateMachine and InputHandler
  - [x] 2.1 Implement `StateMachine` with `state`, `transition(newState)`, `is(state)`, and `onEnter`/`onExit` hook maps for all four states: `menu`, `playing`, `paused`, `game_over`
    - `transition()` must call the current state's `onExit` hook then the new state's `onEnter` hook
    - _Requirements: 1.1, 1.7, 8.5, 11.1_
  - [x] 2.2 Implement `InputHandler.init()` attaching `keydown` (Space, Escape) and `click`/`touchstart` (canvas) listeners
    - Route Space/click/tap to `onFlap` callback; route Escape to `onPause` callback
    - Guard: do not fire `onFlap` when state is `game_over` (Requirement 2.4)
    - _Requirements: 2.1, 2.4, 11.1_
  - [x] 2.3 Implement `ScoreManager` with `score`, `highScore`, `init()`, `increment()`, `checkAndPersist()`, `reset()`, and `isNewHighScore()`
    - `init()` reads `flappyKiro_highScore` from `localStorage`; defaults to 0 if absent or unavailable
    - `checkAndPersist()` writes to `localStorage` inside a try/catch for private-browsing safety
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6_

- [x] 3. PhysicsEngine
  - [x] 3.1 Implement `PhysicsEngine.update(ghosty, dt)`: apply `GRAVITY * (dt * 60)` to `ghosty.vy`, clamp `vy` to `[MAX_RISE_VELOCITY, MAX_FALL_VELOCITY]`, then integrate `ghosty.y += ghosty.vy * (dt * 60)`; decrement `invincibilityFrames` if > 0
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7_
  - [x] 3.2 Implement `PhysicsEngine.flap(ghosty)`: set `ghosty.vy = CONFIG.FLAP_VELOCITY` (replaces current velocity)
    - _Requirements: 2.2, 3.3_
  - [x] 3.3 Implement `PhysicsEngine.ceilingBounce(ghosty)`: clamp `ghosty.y = 0`, reverse `vy` to `Math.abs(ghosty.vy)`, set `ghosty.invincibilityFrames = CONFIG.INVINCIBILITY_FRAMES`
    - _Requirements: 6.5, 6.6_
  - [ ]* 3.4 Write property test for velocity bounds (Property 1)
    - **Property 1: Velocity is always within bounds**
    - For any sequence of gravity applications and flap actions, `ghosty.vy` must remain in `[MAX_RISE_VELOCITY, MAX_FALL_VELOCITY]`
    - Use `fc.array(fc.oneof(fc.constant('gravity'), fc.constant('flap')))` as arbitrary
    - **Validates: Requirements 3.4, 3.5**
  - [ ]* 3.5 Write property test for gravity accumulation (Property 2)
    - **Property 2: Gravity accumulates velocity correctly**
    - For any `v0` and tick count `n` (no flap), velocity after `n` ticks equals `clamp(v0 + n * GRAVITY, MAX_RISE_VELOCITY, MAX_FALL_VELOCITY)`
    - Use `fc.float(), fc.integer({min:1, max:200})` as arbitraries
    - **Validates: Requirements 3.1**
  - [ ]* 3.6 Write property test for position integration (Property 3)
    - **Property 3: Position integrates from velocity**
    - For any `y0` and `vy`, after one tick `ghosty.y == y0 + vy * dt_normalized`
    - Use `fc.float(), fc.float()` as arbitraries
    - **Validates: Requirements 3.2**
  - [ ]* 3.7 Write property test for delta-time scaling (Property 4)
    - **Property 4: Delta-time scaling is proportional**
    - For any `dt`, velocity change equals `GRAVITY * (dt * 60)`
    - Use `fc.float({min:0.001, max:0.1})` as arbitrary
    - **Validates: Requirements 3.7**
  - [ ]* 3.8 Write property test for render interpolation (Property 5)
    - **Property 5: Render interpolation is a linear blend**
    - For any `alpha` in `[0,1]`, rendered Y equals `prevY + alpha * (currentY - prevY)`
    - Use `fc.float({min:0, max:1}), fc.float(), fc.float()` as arbitraries
    - **Validates: Requirements 3.8**

- [x] 4. Checkpoint — core physics verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Pipe generation and scrolling
  - [x] 5.1 Implement `spawnPipe()`: create a `PipePair` with randomized `gapCenterY` in `[GAP_MIN_Y, playAreaHeight - GAP_MAX_Y]`, `x = canvas.width`, `width = PIPE_WIDTH`, `scored = false`
    - _Requirements: 4.1, 4.5_
  - [x] 5.2 Implement `updatePipes(dt)`: scroll all pipes left by `currentPipeSpeed * (dt * 60)`; remove pipes whose `x + width < 0`; spawn a new pipe when the last pipe's `x` is `PIPE_SPACING` from the right edge
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.3 Implement difficulty scaling in `updatePipes`: after each score increment, if `score % PIPE_SPEED_INTERVAL == 0`, increase `currentPipeSpeed` by `PIPE_SPEED_INCREMENT`, capped at `PIPE_SPEED_MAX`
    - _Requirements: 4.6, 4.7_
  - [ ]* 5.4 Write property test for pipe gap size invariant (Property 6)
    - **Property 6: Pipe gap size is always GAP_SIZE**
    - For any spawned `PipePair`, `bottomPipeTop - topPipeBottom == GAP_SIZE`
    - Use `fc.integer({min:1, max:100})` (spawn N pipes) as arbitrary
    - **Validates: Requirements 4.4**
  - [ ]* 5.5 Write property test for pipe gap center bounds (Property 7)
    - **Property 7: Pipe gap center is always within valid bounds**
    - `GAP_MIN_Y <= gapCenterY <= (playAreaHeight - GAP_MAX_Y)` for every spawned pipe
    - Use `fc.integer({min:1, max:100})` as arbitrary
    - **Validates: Requirements 4.5**
  - [ ]* 5.6 Write property test for pipe speed cap (Property 8)
    - **Property 8: Pipe speed is always capped at PIPE_SPEED_MAX**
    - For any score value, `currentPipeSpeed <= PIPE_SPEED_MAX`
    - Use `fc.integer({min:0, max:1000})` as arbitrary
    - **Validates: Requirements 4.6, 4.7**

- [x] 6. Cloud parallax background
  - [x] 6.1 Implement `spawnCloud()`: create a `Cloud` with randomized `x`, `y`, `width`, `height`, `speed` (slower than pipe speed for parallax), and `alpha`
    - _Requirements: 5.1, 5.2_
  - [x] 6.2 Implement `updateClouds(dt)`: scroll each cloud left by `cloud.speed * (dt * 60)`; remove clouds whose `x + width < 0`; spawn new clouds at random intervals to maintain a background population
    - _Requirements: 5.2, 5.3_

- [x] 7. CollisionDetector
  - [x] 7.1 Implement `CollisionDetector.getHitbox(ghosty)`: return `{x, y, w, h}` centered within the sprite, with `w = ghosty.width * HITBOX_SHRINK` and `h = ghosty.height * HITBOX_SHRINK`
    - _Requirements: 6.1_
  - [x] 7.2 Implement `CollisionDetector.checkPipes(ghosty, pipes)`: use AABB overlap test against each pipe's top and bottom segment rectangles; return `true` if any overlap and `ghosty.invincibilityFrames == 0`
    - _Requirements: 6.2, 6.3_
  - [x] 7.3 Implement `CollisionDetector.checkGround(ghosty, groundY)` and `CollisionDetector.checkCeiling(ghosty)`: return `true` when bottom edge >= groundY or top edge <= 0
    - _Requirements: 6.4, 6.5_
  - [x] 7.4 Implement score detection in the collision/update loop: when `ghosty.x > pipe.x + pipe.width` and `pipe.scored == false`, call `ScoreManager.increment()` and set `pipe.scored = true`
    - _Requirements: 7.1_
  - [ ]* 7.5 Write property test for hitbox geometry (Property 9)
    - **Property 9: Ghosty hitbox is centered and shrunk by HITBOX_SHRINK**
    - For any sprite `(w, h)`, hitbox dimensions are `(w * HITBOX_SHRINK, h * HITBOX_SHRINK)` and centered
    - Use `fc.float({min:10, max:200}), fc.float({min:10, max:200})` as arbitraries
    - **Validates: Requirements 6.1**
  - [ ]* 7.6 Write property test for pipe collision → game_over (Property 10)
    - **Property 10: Pipe collision triggers game_over when not invincible**
    - For any overlapping Ghosty/pipe position with `invincibilityFrames == 0`, state transitions to `game_over`
    - Use `fc.record({x: fc.float(), y: fc.float()})` as arbitrary
    - **Validates: Requirements 6.3**
  - [ ]* 7.7 Write property test for score increment (Property 11)
    - **Property 11: Score increments by exactly 1 per pipe passage**
    - For any N pipe passages, score increases by exactly N and no pipe is scored twice
    - Use `fc.integer({min:1, max:50})` as arbitrary
    - **Validates: Requirements 7.1**

- [x] 8. Checkpoint — physics, pipes, and collision verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Renderer — base drawing pipeline
  - [x] 9.1 Implement `Renderer.drawBackground()`: fill canvas with sky-blue; draw a sketchy texture overlay (e.g., thin semi-transparent lines or noise pattern using `ctx.strokeStyle`)
    - _Requirements: 9.1_
  - [x] 9.2 Implement `Renderer.drawClouds(clouds)`: draw each cloud as a semi-transparent white rounded rectangle (`ctx.roundRect` or manual arc path) in the background layer
    - _Requirements: 5.4, 5.5_
  - [x] 9.3 Implement `Renderer.drawPipes(pipes)`: for each `PipePair`, draw top pipe from `y=0` to `gapCenterY - GAP_SIZE/2` and bottom pipe from `gapCenterY + GAP_SIZE/2` to ground; add a wider cap/lip rectangle at each open end; use green fill
    - _Requirements: 4.9_
  - [x] 9.4 Implement `Renderer.drawGhosty(ghosty, alpha)`: compute interpolated Y as `prevY + alpha * (ghosty.y - prevY)`; draw `ghosty.image` at `(ghosty.x, renderedY)`
    - _Requirements: 3.8, 9.2_
  - [x] 9.5 Implement `Renderer.drawHUD(score, highScore)`: draw a dark filled rectangle at the bottom of the canvas (`HUD_HEIGHT`); render `"Score: X | High: X"` text in a retro-style font
    - _Requirements: 7.2, 9.3_
  - [x] 9.6 Implement `Renderer.draw(gameState, alpha)` master draw call following the exact pipeline order: save → shake transform → clear → background → clouds → pipes → particles → Ghosty → score popups → HUD → state overlay → restore
    - _Requirements: 9.4, 5.5_
  - [ ]* 9.7 Write property test for HUD format string (Property 12)
    - **Property 12: HUD format string is correct for any score values**
    - For any non-negative `score` and `highScore`, HUD text equals `"Score: " + score + " | High: " + highScore`
    - Use `fc.nat(), fc.nat()` as arbitraries
    - **Validates: Requirements 7.2**

- [x] 10. Visual effects
  - [x] 10.1 Implement particle trail: `updateParticles(dt)` moves each particle by `(vx, vy) * (dt * 60)` and decrements `life`; remove dead particles; emit one new particle per frame at Ghosty's position with randomized `vx`/`vy` and `life = PARTICLE_LIFETIME`
    - _Requirements: 9.7, 12.4_
  - [x] 10.2 Implement `Renderer.drawParticles(particles)`: draw each particle as a filled circle with `alpha = life / maxLife`
    - _Requirements: 9.7_
  - [x] 10.3 Implement score popup: `updateScorePopups(dt)` moves each popup upward and decrements `life`; remove dead popups; `ScoreManager.increment()` creates a new popup at Ghosty's position with `life = SCORE_POPUP_DURATION`
    - _Requirements: 9.8, 12.3_
  - [x] 10.4 Implement `Renderer.drawScorePopups(popups)`: draw "+1" text at each popup's position with `alpha = life / maxLife`
    - _Requirements: 9.8_
  - [x] 10.5 Implement screen shake: on lethal collision set `shakeTimer = COLLISION_FLASH_DURATION`; in `Renderer.applyShake(magnitude)` apply a random `ctx.translate(dx, dy)` offset each frame while `shakeTimer > 0`; decrement `shakeTimer` each frame
    - _Requirements: 6.7, 9.6_
  - [ ]* 10.6 Write property test for particle emission (Property 16)
    - **Property 16: Particle trail is emitted continuously during playing**
    - For any N frames in `playing` state, at least N particles are added with `life == PARTICLE_LIFETIME`
    - Use `fc.integer({min:1, max:60})` as arbitrary
    - **Validates: Requirements 9.7, 12.4**
  - [ ]* 10.7 Write property test for score popup creation (Property 17)
    - **Property 17: Score popup is created at Ghosty's position on score increment**
    - For any N score increments, N popups are created at Ghosty's position with `life == SCORE_POPUP_DURATION`
    - Use `fc.integer({min:1, max:20})` as arbitrary
    - **Validates: Requirements 9.8, 12.3**

- [x] 11. AudioManager
  - [x] 11.1 Implement `AudioManager.init()`: preload `jump.wav` and `game_over.wav` via `fetch` + `decodeAudioData`; attempt to load optional `score.wav` and `music.wav` with fallback flag on 404/error; create `AudioContext` lazily on first user gesture via `AudioManager.unlock()`
    - _Requirements: 1.8, 10.1, 10.11_
  - [x] 11.2 Implement `AudioManager.playJump()`, `playGameOver()`: create a new `AudioBufferSourceNode` from the decoded buffer, connect through a `GainNode` at `SFX_VOLUME`, and start; allow overlapping playback
    - _Requirements: 2.3, 6.8, 10.2, 10.4_
  - [x] 11.3 Implement `AudioManager.playScore()`: play `score.wav` if loaded; otherwise synthesize a short ascending beep using an `OscillatorNode` (e.g., 880 Hz, 80 ms, triangle wave)
    - _Requirements: 10.3_
  - [x] 11.4 Implement `AudioManager.startMusic()`, `pauseMusic()`, `resumeMusic()`, `stopMusic()`: use a single `AudioBufferSourceNode` with `loop=true` for `music.wav`, or a chiptune oscillator sequencer fallback; implement pause/resume via `pauseTime` offset
    - _Requirements: 10.5, 10.6, 10.7, 10.8_
  - [x] 11.5 Implement `AudioContext` suspension recovery: before each playback call, check `audioCtx.state`; if `'suspended'`, call `audioCtx.resume()` then play in the resolved promise
    - _Requirements: 10.11_
  - [ ]* 11.6 Write property test for audio volume (Property 14)
    - **Property 14: Audio volume is always set to configured constants**
    - For any SFX playback, gain node volume equals `SFX_VOLUME`; for music, gain equals `MUSIC_VOLUME`
    - Use `fc.float({min:0, max:1})` as arbitrary for volume values
    - **Validates: Requirements 10.9, 10.10**

- [x] 12. ScoreManager persistence properties
  - [ ]* 12.1 Write property test for high score persistence (Property 13)
    - **Property 13: High score is updated and persisted when score exceeds it**
    - For any `(score, highScore)` pair where `score > highScore`, after `checkAndPersist()` the stored value in `localStorage` equals `score`
    - Use `fc.nat(), fc.nat()` (filtered so score > highScore) as arbitraries
    - **Validates: Requirements 7.3**

- [x] 13. Game loop integration
  - [x] 13.1 Implement the fixed-timestep game loop: `FIXED_DT = 1000/60`; accumulator pattern with spiral-of-death guard (cap elapsed at 250 ms); inner `while (accumulator >= FIXED_DT)` loop calling `PhysicsEngine.update`, `updatePipes`, `updateClouds`, `updateParticles`, `updateScorePopups`, and collision checks; compute `alpha = accumulator / FIXED_DT`; call `Renderer.draw(gameState, alpha)`
    - _Requirements: 3.7, 3.8, 9.4_
  - [x] 13.2 Wire `InputHandler` callbacks: `onFlap` calls `PhysicsEngine.flap(ghosty)` and `AudioManager.playJump()` when state is `playing`; `onPause` calls `StateMachine.transition('paused')` or `transition('playing')` depending on current state
    - _Requirements: 2.1, 2.2, 2.3, 11.1, 11.6_
  - [x] 13.3 Wire `StateMachine.onEnter` hooks: `playing` → reset entities (on restart), start music, enable physics; `paused` → pause music, freeze loop; `game_over` → stop music, play game_over.wav, set `shakeTimer`, call `ScoreManager.checkAndPersist()`; `menu` → reset Ghosty to idle center
    - _Requirements: 1.1, 6.8, 8.6, 10.4, 10.5, 10.6, 10.8, 11.1_
  - [x] 13.4 Wire `StateMachine.onExit` hooks: `playing → paused` → snapshot physics state; `paused → playing` → resume music, restore physics state; `game_over → playing` → full reset (Ghosty, pipes, clouds, particles, score)
    - _Requirements: 8.6, 11.6_

- [x] 14. Checkpoint — game loop and state wiring verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. State screens and overlays
  - [x] 15.1 Implement `Renderer.drawMenuOverlay(highScore)`: draw game title "Flappy Kiro" prominently; display `"High Score: X"`; display `"Press Space or Tap to Start"`; draw Ghosty in centered idle position (no vertical movement)
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [x] 15.2 Implement `Renderer.drawPausedOverlay()`: draw a semi-transparent dark overlay; display `"PAUSED"` and `"Press Escape or Tap to Resume"`; continue drawing Ghosty, pipes, and clouds in frozen positions beneath the overlay
    - _Requirements: 11.3, 11.4, 11.5_
  - [x] 15.3 Implement `Renderer.drawGameOverOverlay(score, highScore, isNewHighScore)`: display `"Game Over"`, final score, high score, and `"Press Space or Tap to Restart"`; if `isNewHighScore`, display `"New High Score!"` with a pulsing/flashing animation (use `Math.sin(Date.now())` for alpha oscillation)
    - _Requirements: 6.9, 8.1, 8.2, 8.3, 8.4, 9.9_
  - [x] 15.4 Ensure menu state animates clouds continuously (cloud update runs even in `menu` state) and Ghosty is drawn stationary at canvas center
    - _Requirements: 1.5, 1.6_

- [x] 16. Pause-resume state preservation property
  - [ ]* 16.1 Write property test for pause-resume state preservation (Property 15)
    - **Property 15: Pause-resume preserves game state**
    - For any game state `{y, vy, score, pipePositions}`, transitioning to `paused` then back to `playing` leaves all values unchanged
    - Use `fc.record({y: fc.float(), vy: fc.float(), score: fc.nat()})` as arbitrary
    - **Validates: Requirements 11.6**

- [x] 17. Final integration and wiring
  - [x] 17.1 Ensure `index.html` loads `ghosty.png` into `ghosty.image` before the game loop starts; add a loading guard so the game loop only begins after the image is loaded
    - _Requirements: 9.2_
  - [x] 17.2 Verify all CONFIG constants are referenced from `CONFIG.*` throughout `game.js` — no magic numbers in game logic
    - _Requirements: 3.9, 4.8, 6.10, 9.10, 10.12, 12.1_
  - [x] 17.3 Verify the full rendering pipeline draw order matches the design spec: background → clouds → pipes → particles → Ghosty → score popups → HUD → state overlay
    - _Requirements: 5.5, 9.4_
  - [x] 17.4 Set up the fast-check test runner: create `tests/game.test.js` (or `game.test.mjs`) that imports the pure-logic functions from `game.js` (or a shared module) and runs all property tests with `numRuns: 100`; ensure tests run with `node tests/game.test.js` (no browser required)
    - _Requirements: (all property-validated requirements)_

- [x] 18. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests use **fast-check** with `numRuns: 100` minimum; tag each test with `// Feature: flappy-kiro, Property N: <property_text>`
- Pure-logic functions (PhysicsEngine, CollisionDetector, ScoreManager, pipe/cloud update) must be exportable or extractable for Node.js testing without a browser
- The `AudioContext` is created lazily on first user gesture — all audio tests should mock the Web Audio API
