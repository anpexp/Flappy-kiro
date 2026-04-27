// =============================================================================
// Flappy Kiro — game.js
// =============================================================================

// -----------------------------------------------------------------------------
// CONFIG — single source of truth for all tunable constants
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Canvas dimensions
// -----------------------------------------------------------------------------
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const HUD_HEIGHT = 50;
const PIPE_WIDTH = 60;

// -----------------------------------------------------------------------------
// StateMachine — governs the four game states
// -----------------------------------------------------------------------------
const StateMachine = {
  state: 'menu',
  onEnter: { menu: null, playing: null, paused: null, game_over: null },
  onExit:  { menu: null, playing: null, paused: null, game_over: null },

  transition(newState) {
    const prev = this.state;
    if (this.onExit[prev]) this.onExit[prev]();
    this.state = newState;
    if (this.onEnter[newState]) this.onEnter[newState]();
  },

  is(state) {
    return this.state === state;
  },
};

// -----------------------------------------------------------------------------
// PhysicsEngine — gravity, velocity clamping, position integration
// -----------------------------------------------------------------------------
const PhysicsEngine = {
  update(ghosty, dt) {
    const scale = dt * 60;
    ghosty.vy += CONFIG.GRAVITY * scale;
    ghosty.vy = Math.max(CONFIG.MAX_RISE_VELOCITY, Math.min(CONFIG.MAX_FALL_VELOCITY, ghosty.vy));
    ghosty.prevY = ghosty.y;
    ghosty.y += ghosty.vy * scale;
    if (ghosty.invincibilityFrames > 0) ghosty.invincibilityFrames--;
  },
  flap(ghosty) {
    ghosty.vy = CONFIG.FLAP_VELOCITY;
  },
  ceilingBounce(ghosty) {
    ghosty.y = 0;
    ghosty.vy = Math.abs(ghosty.vy);
    ghosty.invincibilityFrames = CONFIG.INVINCIBILITY_FRAMES;
  },
};

// -----------------------------------------------------------------------------
// CollisionDetector — hitbox computation and overlap checks
// -----------------------------------------------------------------------------
const CollisionDetector = {
  getHitbox(ghosty) {
    const w = ghosty.width * CONFIG.HITBOX_SHRINK;
    const h = ghosty.height * CONFIG.HITBOX_SHRINK;
    return {
      x: ghosty.x + (ghosty.width - w) / 2,
      y: ghosty.y + (ghosty.height - h) / 2,
      w,
      h,
    };
  },
  checkPipes(ghosty, pipes) {
    if (ghosty.invincibilityFrames > 0) return false;
    const hb = this.getHitbox(ghosty);
    for (const pipe of pipes) {
      const gapTop = pipe.gapCenterY - CONFIG.GAP_SIZE / 2;
      const gapBottom = pipe.gapCenterY + CONFIG.GAP_SIZE / 2;
      const groundY = CANVAS_HEIGHT - HUD_HEIGHT;
      // Top pipe rect
      const topPipe = { x: pipe.x, y: 0, w: pipe.width, h: gapTop };
      // Bottom pipe rect
      const bottomPipe = { x: pipe.x, y: gapBottom, w: pipe.width, h: groundY - gapBottom };
      if (this._overlaps(hb, topPipe) || this._overlaps(hb, bottomPipe)) return true;
    }
    return false;
  },
  _overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },
  checkGround(ghosty, groundY) {
    return ghosty.y + ghosty.height >= groundY;
  },
  checkCeiling(ghosty) {
    return ghosty.y <= 0;
  },
};

// -----------------------------------------------------------------------------
// Renderer — draws all game elements to the canvas each frame
// -----------------------------------------------------------------------------
const Renderer = {
  ctx: null,

  // Task 9.1: Draw sky-blue background with sketchy texture overlay
  drawBackground() {
    const ctx = this.ctx;
    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT - HUD_HEIGHT;
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, w, h);
    // Sketchy texture: thin semi-transparent horizontal lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.random() * 2 - 1);
      ctx.lineTo(w, y + Math.random() * 2 - 1);
      ctx.stroke();
    }
    ctx.restore();
  },

  // Task 9.2: Draw clouds as semi-transparent white rounded rectangles
  drawClouds(clouds) {
    const ctx = this.ctx;
    for (const cloud of clouds) {
      ctx.save();
      ctx.globalAlpha = cloud.alpha;
      ctx.fillStyle = '#ffffff';
      const r = Math.min(cloud.height / 2, 20);
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cloud.x, cloud.y, cloud.width, cloud.height, r);
      } else {
        // Fallback for browsers without roundRect
        ctx.moveTo(cloud.x + r, cloud.y);
        ctx.lineTo(cloud.x + cloud.width - r, cloud.y);
        ctx.arcTo(cloud.x + cloud.width, cloud.y, cloud.x + cloud.width, cloud.y + r, r);
        ctx.lineTo(cloud.x + cloud.width, cloud.y + cloud.height - r);
        ctx.arcTo(cloud.x + cloud.width, cloud.y + cloud.height, cloud.x + cloud.width - r, cloud.y + cloud.height, r);
        ctx.lineTo(cloud.x + r, cloud.y + cloud.height);
        ctx.arcTo(cloud.x, cloud.y + cloud.height, cloud.x, cloud.y + cloud.height - r, r);
        ctx.lineTo(cloud.x, cloud.y + r);
        ctx.arcTo(cloud.x, cloud.y, cloud.x + r, cloud.y, r);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
  },

  // Task 9.3: Draw pipes with green fill and cap/lip
  drawPipes(pipes) {
    const ctx = this.ctx;
    const groundY = CANVAS_HEIGHT - HUD_HEIGHT;
    const capWidth = PIPE_WIDTH + 12;
    const capHeight = 16;
    for (const pipe of pipes) {
      const gapTop = pipe.gapCenterY - CONFIG.GAP_SIZE / 2;
      const gapBottom = pipe.gapCenterY + CONFIG.GAP_SIZE / 2;
      ctx.fillStyle = '#4CAF50';
      // Top pipe body
      ctx.fillRect(pipe.x, 0, pipe.width, gapTop);
      // Top pipe cap (lip at bottom of top pipe)
      ctx.fillStyle = '#388E3C';
      ctx.fillRect(pipe.x - (capWidth - pipe.width) / 2, gapTop - capHeight, capWidth, capHeight);
      // Bottom pipe body
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(pipe.x, gapBottom, pipe.width, groundY - gapBottom);
      // Bottom pipe cap (lip at top of bottom pipe)
      ctx.fillStyle = '#388E3C';
      ctx.fillRect(pipe.x - (capWidth - pipe.width) / 2, gapBottom, capWidth, capHeight);
    }
  },

  // Task 9.4: Draw Ghosty with render interpolation
  drawGhosty(ghosty, alpha) {
    const ctx = this.ctx;
    const renderedY = ghosty.prevY + alpha * (ghosty.y - ghosty.prevY);
    if (ghosty.image && ghosty.image.complete) {
      ctx.drawImage(ghosty.image, ghosty.x, renderedY, ghosty.width, ghosty.height);
    } else {
      // Fallback: white rectangle
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ghosty.x, renderedY, ghosty.width, ghosty.height);
    }
  },

  // Task 9.5: Draw HUD bar with score text
  drawHUD(score, highScore) {
    const ctx = this.ctx;
    const y = CANVAS_HEIGHT - HUD_HEIGHT;
    ctx.fillStyle = 'rgba(20, 20, 30, 0.92)';
    ctx.fillRect(0, y, CANVAS_WIDTH, HUD_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Score: ${score} | High: ${highScore}`, CANVAS_WIDTH / 2, y + HUD_HEIGHT / 2);
  },

  // Task 9.6: Master draw call — full pipeline
  draw(gameState, alpha) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.save();
    // Apply screen shake if active
    if (gameState.shakeTimer > 0) {
      this.applyShake(CONFIG.SHAKE_MAGNITUDE);
      gameState.shakeTimer -= 1000 / 60;
      if (gameState.shakeTimer < 0) gameState.shakeTimer = 0;
    }
    // 1. Clear + background
    this.drawBackground();
    // 2. Clouds
    this.drawClouds(gameState.clouds);
    // 3. Pipes
    this.drawPipes(gameState.pipes);
    // 4. Particles
    this.drawParticles(gameState.particles);
    // 5. Ghosty
    if (gameState.ghosty) this.drawGhosty(gameState.ghosty, alpha);
    // 6. Score popups
    this.drawScorePopups(gameState.scorePopups);
    // 7. HUD
    this.drawHUD(ScoreManager.score, ScoreManager.highScore);
    // 8. State overlay
    const state = StateMachine.state;
    if (state === 'menu') {
      this.drawMenuOverlay(ScoreManager.highScore);
    } else if (state === 'paused') {
      this.drawPausedOverlay();
    } else if (state === 'game_over') {
      this.drawGameOverOverlay(ScoreManager.score, ScoreManager.highScore, gameState.isNewHighScore);
    }
    ctx.restore();
  },

  drawParticles(particles) {
    const ctx = this.ctx;
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
  drawScorePopups(popups) {
    const ctx = this.ctx;
    for (const popup of popups) {
      const alpha = popup.life / popup.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+1', popup.x, popup.y);
      ctx.restore();
    }
  },
  drawMenuOverlay(highScore) {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 30, 0.45)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 12;
    ctx.fillText('Flappy Kiro', cx, 160);
    ctx.shadowBlur = 0;
    // High score
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`High Score: ${highScore}`, cx, 230);
    // Prompt
    ctx.font = '18px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const blink = Math.sin(Date.now() / 400) > 0;
    if (blink) ctx.fillText('Press Space or Tap to Start', cx, 290);
  },
  drawPausedOverlay() {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const cy = (CANVAS_HEIGHT - HUD_HEIGHT) / 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', cx, cy - 20);
    ctx.font = '18px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Press Escape or Tap to Resume', cx, cy + 30);
  },
  drawGameOverOverlay(score, highScore, isNewHighScore) {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Game Over title
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.fillText('Game Over', cx, 180);
    // Scores
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText(`Score: ${score}`, cx, 250);
    ctx.fillText(`High Score: ${highScore}`, cx, 285);
    // New high score flash
    if (isNewHighScore) {
      const alpha = 0.5 + 0.5 * Math.sin(Date.now() / 200);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.fillText('New High Score!', cx, 330);
      ctx.restore();
    }
    // Restart prompt
    ctx.font = '18px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const blink = Math.sin(Date.now() / 400) > 0;
    if (blink) ctx.fillText('Press Space or Tap to Restart', cx, 380);
  },

  applyShake(magnitude) {
    const dx = (Math.random() * 2 - 1) * magnitude;
    const dy = (Math.random() * 2 - 1) * magnitude;
    this.ctx.translate(dx, dy);
  },
};

// -----------------------------------------------------------------------------
// InputHandler — keyboard and pointer event routing
// -----------------------------------------------------------------------------
const InputHandler = {
  onFlap: null,
  onPause: null,
  init() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (this.onFlap && !StateMachine.is('game_over')) this.onFlap();
      } else if (e.code === 'Escape') {
        if (this.onPause) this.onPause();
      }
    });

    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('click', () => {
      if (this.onFlap && !StateMachine.is('game_over')) this.onFlap();
    });
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.onFlap && !StateMachine.is('game_over')) this.onFlap();
    }, { passive: false });
  },
};

// -----------------------------------------------------------------------------
// AudioManager — loads and plays audio, falls back to Web Audio API synthesis
// -----------------------------------------------------------------------------
const AudioManager = {
  audioCtx: null,
  _buffers: {},
  _musicSource: null,
  _musicGain: null,
  _pauseTime: 0,
  _musicStartTime: 0,
  _musicPlaying: false,
  _hasScoreWav: false,
  _hasMusicWav: false,
  _pendingPlay: [],

  // Task 11.1: Init — preload required assets, attempt optional ones
  async init() {
    // Load required assets after AudioContext is created
    // AudioContext is created lazily in unlock()
    // Queue asset loading to run after first gesture
    this._pendingInit = true;
  },

  async _loadAssets() {
    const load = async (path, required = true) => {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        return await this.audioCtx.decodeAudioData(buf);
      } catch (e) {
        if (required) console.error(`Failed to load ${path}:`, e);
        return null;
      }
    };

    this._buffers.jump = await load('assets/jump.wav');
    this._buffers.game_over = await load('assets/game_over.wav');
    const scoreBuffer = await load('assets/score.wav', false);
    if (scoreBuffer) { this._buffers.score = scoreBuffer; this._hasScoreWav = true; }
    const musicBuffer = await load('assets/music.wav', false);
    if (musicBuffer) { this._buffers.music = musicBuffer; this._hasMusicWav = true; }
  },

  // Task 11.1: Unlock — create AudioContext on first user gesture
  async unlock() {
    if (this.audioCtx) return;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await this._loadAssets();
    // Drain any pending play calls
    for (const fn of this._pendingPlay) fn();
    this._pendingPlay = [];
  },

  // Task 11.5: Ensure AudioContext is running before playback
  async _ensureRunning() {
    if (!this.audioCtx) return false;
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    return true;
  },

  // Task 11.2: Play a buffer through a GainNode at SFX_VOLUME
  _playBuffer(buffer) {
    if (!this.audioCtx || !buffer) return;
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = this.audioCtx.createGain();
    gain.gain.value = CONFIG.SFX_VOLUME;
    source.connect(gain);
    gain.connect(this.audioCtx.destination);
    source.start(0);
  },

  async playJump() {
    if (!await this._ensureRunning()) return;
    this._playBuffer(this._buffers.jump);
  },

  async playGameOver() {
    if (!await this._ensureRunning()) return;
    this._playBuffer(this._buffers.game_over);
  },

  // Task 11.3: Play score sound or synthesize beep
  async playScore() {
    if (!await this._ensureRunning()) return;
    if (this._hasScoreWav) {
      this._playBuffer(this._buffers.score);
    } else {
      // Fallback: short ascending beep (880 Hz, 80ms, triangle)
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 880;
      gain.gain.value = CONFIG.SFX_VOLUME * 0.5;
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    }
  },

  // Task 11.4: Music playback with pause/resume
  async startMusic() {
    if (!await this._ensureRunning()) return;
    this.stopMusic();
    this._musicGain = this.audioCtx.createGain();
    this._musicGain.gain.value = CONFIG.MUSIC_VOLUME;
    this._musicGain.connect(this.audioCtx.destination);

    if (this._hasMusicWav) {
      this._musicSource = this.audioCtx.createBufferSource();
      this._musicSource.buffer = this._buffers.music;
      this._musicSource.loop = true;
      this._musicSource.connect(this._musicGain);
      this._musicSource.start(0, this._pauseTime);
      this._musicStartTime = this.audioCtx.currentTime - this._pauseTime;
    } else {
      // Fallback: simple chiptune loop using oscillator
      this._startChiptune();
    }
    this._musicPlaying = true;
  },

  _startChiptune() {
    // Simple repeating melody: C5, E5, G5, E5
    const notes = [523, 659, 784, 659];
    let noteIdx = 0;
    const playNote = () => {
      if (!this._musicPlaying || !this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = notes[noteIdx % notes.length];
      gain.gain.value = CONFIG.MUSIC_VOLUME * 0.3;
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.18);
      noteIdx++;
      this._chiptuneTimer = setTimeout(playNote, 200);
    };
    playNote();
  },

  pauseMusic() {
    if (!this._musicPlaying || !this.audioCtx) return;
    if (this._hasMusicWav && this._musicSource) {
      this._pauseTime = this.audioCtx.currentTime - this._musicStartTime;
      try { this._musicSource.stop(); } catch(e) {}
      this._musicSource = null;
    } else {
      clearTimeout(this._chiptuneTimer);
    }
    this._musicPlaying = false;
  },

  resumeMusic() {
    this.startMusic();
  },

  stopMusic() {
    if (this._musicSource) {
      try { this._musicSource.stop(); } catch(e) {}
      this._musicSource = null;
    }
    clearTimeout(this._chiptuneTimer);
    this._pauseTime = 0;
    this._musicPlaying = false;
  },
};

// -----------------------------------------------------------------------------
// ScoreManager — tracks score and high score, persists to localStorage
// -----------------------------------------------------------------------------
const ScoreManager = {
  score: 0,
  highScore: 0,
  init() {
    try {
      const stored = localStorage.getItem('flappyKiro_highScore');
      const parsed = parseInt(stored, 10);
      this.highScore = (!isNaN(parsed) && parsed > 0) ? parsed : 0;
    } catch (e) {
      this.highScore = 0;
    }
  },
  increment() {
    this.score++;
  },
  checkAndPersist() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('flappyKiro_highScore', this.highScore);
      } catch (e) {
        // private browsing or storage unavailable — silently ignore
      }
    }
  },
  reset() {
    this.score = 0;
  },
  isNewHighScore() {
    return this.score === this.highScore && this.highScore > 0;
  },
};

// -----------------------------------------------------------------------------
// GameState — top-level game state container
// -----------------------------------------------------------------------------
const GameState = {
  state: StateMachine,
  ghosty: null,
  pipes: [],
  clouds: [],
  particles: [],
  scorePopups: [],
  currentPipeSpeed: CONFIG.PIPE_SPEED,
  shakeTimer: 0,
  isNewHighScore: false,
};

// -----------------------------------------------------------------------------
// spawnPipe — creates a new PipePair at the right edge with a random gap
// -----------------------------------------------------------------------------
function spawnPipe() {
  const playAreaHeight = CANVAS_HEIGHT - HUD_HEIGHT;
  const minY = CONFIG.GAP_MIN_Y;
  const maxY = playAreaHeight - CONFIG.GAP_MAX_Y;
  const gapCenterY = minY + Math.random() * (maxY - minY);
  return {
    x: CANVAS_WIDTH,
    gapCenterY,
    width: PIPE_WIDTH,
    scored: false,
  };
}

// -----------------------------------------------------------------------------
// updatePipes — scrolls pipes, removes off-screen pipes, spawns new ones
// -----------------------------------------------------------------------------
function updatePipes(dt) {
  const scale = dt * 60;
  // Scroll all pipes left
  for (const pipe of GameState.pipes) {
    pipe.x -= GameState.currentPipeSpeed * scale;
  }
  // Remove off-screen pipes
  GameState.pipes = GameState.pipes.filter(p => p.x + p.width >= 0);
  // Spawn new pipe when last pipe is PIPE_SPACING from right edge
  const lastPipe = GameState.pipes[GameState.pipes.length - 1];
  if (!lastPipe || lastPipe.x <= CANVAS_WIDTH - CONFIG.PIPE_SPACING) {
    GameState.pipes.push(spawnPipe());
  }
}

// -----------------------------------------------------------------------------
// applyDifficultyScaling — increases pipe speed at score milestones
// -----------------------------------------------------------------------------
function applyDifficultyScaling() {
  if (ScoreManager.score > 0 && ScoreManager.score % CONFIG.PIPE_SPEED_INTERVAL === 0) {
    GameState.currentPipeSpeed = Math.min(
      CONFIG.PIPE_SPEED_MAX,
      GameState.currentPipeSpeed + CONFIG.PIPE_SPEED_INCREMENT
    );
  }
}

// -----------------------------------------------------------------------------
// spawnCloud — creates a new Cloud with randomized position, size, and speed
// -----------------------------------------------------------------------------
function spawnCloud() {
  const width = 60 + Math.random() * 100;   // 60–160 px
  const height = 25 + Math.random() * 30;   // 25–55 px
  const playAreaHeight = CANVAS_HEIGHT - HUD_HEIGHT;
  return {
    x: CANVAS_WIDTH + width,
    y: Math.random() * (playAreaHeight - height),
    width,
    height,
    speed: 0.3 + Math.random() * 0.8,       // 0.3–1.1 px/frame (slower than pipes)
    alpha: 0.3 + Math.random() * 0.4,       // 0.3–0.7 opacity
  };
}

// -----------------------------------------------------------------------------
// updateClouds — scrolls clouds, removes off-screen ones, maintains ~5 clouds
// -----------------------------------------------------------------------------
function updateClouds(dt) {
  const scale = dt * 60;
  for (const cloud of GameState.clouds) {
    cloud.x -= cloud.speed * scale;
  }
  GameState.clouds = GameState.clouds.filter(c => c.x + c.width >= 0);
  // Maintain ~5 clouds in the background
  if (GameState.clouds.length < 5) {
    GameState.clouds.push(spawnCloud());
  }
}

// -----------------------------------------------------------------------------
// checkScoring — detects when Ghosty passes a pipe and increments score
// -----------------------------------------------------------------------------
function checkScoring() {
  for (const pipe of GameState.pipes) {
    if (!pipe.scored && GameState.ghosty && GameState.ghosty.x > pipe.x + pipe.width) {
      pipe.scored = true;
      ScoreManager.increment();
      applyDifficultyScaling();
      // Create score popup
      if (GameState.ghosty) {
        GameState.scorePopups.push({
          x: GameState.ghosty.x,
          y: GameState.ghosty.y,
          life: CONFIG.SCORE_POPUP_DURATION,
          maxLife: CONFIG.SCORE_POPUP_DURATION,
        });
      }
      AudioManager.playScore();
    }
  }
}

// -----------------------------------------------------------------------------
// updateParticles — moves particles, removes dead ones, emits one per frame
// -----------------------------------------------------------------------------
function updateParticles(dt) {
  const scale = dt * 60;
  for (const p of GameState.particles) {
    p.x += p.vx * scale;
    p.y += p.vy * scale;
    p.life -= dt * 1000;
  }
  GameState.particles = GameState.particles.filter(p => p.life > 0);
  // Emit one new particle per tick at Ghosty's position
  if (GameState.ghosty) {
    GameState.particles.push({
      x: GameState.ghosty.x + GameState.ghosty.width / 2,
      y: GameState.ghosty.y + GameState.ghosty.height / 2,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      life: CONFIG.PARTICLE_LIFETIME,
      maxLife: CONFIG.PARTICLE_LIFETIME,
      radius: 2 + Math.random() * 2,
    });
  }
}

// -----------------------------------------------------------------------------
// updateScorePopups — floats popups upward and removes expired ones
// -----------------------------------------------------------------------------
function updateScorePopups(dt) {
  for (const popup of GameState.scorePopups) {
    popup.y -= 0.5 * (dt * 60);  // float upward
    popup.life -= dt * 1000;
  }
  GameState.scorePopups = GameState.scorePopups.filter(p => p.life > 0);
}

// -----------------------------------------------------------------------------
// Game loop — fixed-timestep physics with render interpolation
// -----------------------------------------------------------------------------
const FIXED_DT = 1000 / 60;
let accumulator = 0;
let prevTime = 0;

function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  if (StateMachine.is('paused')) {
    Renderer.draw(GameState, 1.0);
    return;
  }

  let elapsed = now - prevTime;
  prevTime = now;
  if (elapsed > 250) elapsed = 250; // spiral-of-death guard

  if (StateMachine.is('playing')) {
    accumulator += elapsed;
    while (accumulator >= FIXED_DT) {
      const dt = FIXED_DT / 1000;
      PhysicsEngine.update(GameState.ghosty, dt);
      updatePipes(dt);
      updateClouds(dt);
      updateParticles(dt);
      updateScorePopups(dt);
      checkScoring();
      // Collision checks
      const groundY = CANVAS_HEIGHT - HUD_HEIGHT;
      if (CollisionDetector.checkCeiling(GameState.ghosty)) {
        PhysicsEngine.ceilingBounce(GameState.ghosty);
      }
      if (CollisionDetector.checkGround(GameState.ghosty, groundY)) {
        StateMachine.transition('game_over');
        break;
      }
      if (CollisionDetector.checkPipes(GameState.ghosty, GameState.pipes)) {
        StateMachine.transition('game_over');
        break;
      }
      accumulator -= FIXED_DT;
    }
  } else if (StateMachine.is('menu')) {
    // Animate clouds in menu state
    updateClouds(elapsed / 1000);
  }

  const alpha = accumulator / FIXED_DT;
  Renderer.draw(GameState, alpha);
}

// -----------------------------------------------------------------------------
// Wire InputHandler callbacks
// -----------------------------------------------------------------------------
InputHandler.onFlap = () => {
  if (StateMachine.is('playing')) {
    PhysicsEngine.flap(GameState.ghosty);
    AudioManager.playJump();
  } else if (StateMachine.is('menu')) {
    StateMachine.transition('playing');
  } else if (StateMachine.is('game_over')) {
    StateMachine.transition('playing');
  }
};

InputHandler.onPause = () => {
  if (StateMachine.is('playing')) {
    StateMachine.transition('paused');
  } else if (StateMachine.is('paused')) {
    StateMachine.transition('playing');
  }
};

// -----------------------------------------------------------------------------
// StateMachine onEnter hooks
// -----------------------------------------------------------------------------
function resetGame() {
  GameState.ghosty.x = CANVAS_WIDTH / 4;
  GameState.ghosty.y = CANVAS_HEIGHT / 2 - GameState.ghosty.height / 2;
  GameState.ghosty.prevY = GameState.ghosty.y;
  GameState.ghosty.vy = 0;
  GameState.ghosty.invincibilityFrames = 0;
  GameState.pipes = [];
  GameState.clouds = [];
  GameState.particles = [];
  GameState.scorePopups = [];
  GameState.currentPipeSpeed = CONFIG.PIPE_SPEED;
  GameState.shakeTimer = 0;
  GameState.isNewHighScore = false;
  ScoreManager.reset();
  // Pre-populate clouds
  for (let i = 0; i < 5; i++) {
    const c = spawnCloud();
    c.x = Math.random() * CANVAS_WIDTH;
    GameState.clouds.push(c);
  }
}

StateMachine.onEnter.menu = () => {
  // Reset Ghosty to idle center (no physics)
  if (GameState.ghosty) {
    GameState.ghosty.x = CANVAS_WIDTH / 2 - GameState.ghosty.width / 2;
    GameState.ghosty.y = CANVAS_HEIGHT / 2 - GameState.ghosty.height / 2;
    GameState.ghosty.prevY = GameState.ghosty.y;
    GameState.ghosty.vy = 0;
  }
};

StateMachine.onEnter.playing = () => {
  resetGame();
  AudioManager.startMusic();
};

StateMachine.onEnter.paused = () => {
  AudioManager.pauseMusic();
};

StateMachine.onEnter.game_over = () => {
  AudioManager.stopMusic();
  AudioManager.playGameOver();
  GameState.shakeTimer = CONFIG.COLLISION_FLASH_DURATION;
  ScoreManager.checkAndPersist();
  GameState.isNewHighScore = ScoreManager.isNewHighScore();
};

// -----------------------------------------------------------------------------
// StateMachine onExit hooks
// -----------------------------------------------------------------------------
let _pausedPhysicsSnapshot = null;

StateMachine.onExit.playing = () => {
  // Snapshot physics state when pausing
  if (GameState.ghosty) {
    _pausedPhysicsSnapshot = {
      y: GameState.ghosty.y,
      prevY: GameState.ghosty.prevY,
      vy: GameState.ghosty.vy,
      invincibilityFrames: GameState.ghosty.invincibilityFrames,
    };
  }
};

StateMachine.onExit.paused = () => {
  // Restore physics state when resuming
  if (_pausedPhysicsSnapshot && GameState.ghosty) {
    GameState.ghosty.y = _pausedPhysicsSnapshot.y;
    GameState.ghosty.prevY = _pausedPhysicsSnapshot.prevY;
    GameState.ghosty.vy = _pausedPhysicsSnapshot.vy;
    GameState.ghosty.invincibilityFrames = _pausedPhysicsSnapshot.invincibilityFrames;
    _pausedPhysicsSnapshot = null;
  }
  AudioManager.resumeMusic();
};

StateMachine.onExit.game_over = () => {
  // Full reset happens in onEnter.playing
};

// -----------------------------------------------------------------------------
// Browser initialization — runs only in browser context (not Node.js tests)
// -----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  const canvas = document.getElementById('gameCanvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  Renderer.ctx = canvas.getContext('2d');

  // Load Ghosty image, then start game loop
  const ghostyImage = new Image();
  ghostyImage.src = 'assets/ghosty.png';
  ghostyImage.onload = () => {
    GameState.ghosty = {
      x: CANVAS_WIDTH / 2 - 24,
      y: CANVAS_HEIGHT / 2 - 24,
      prevY: CANVAS_HEIGHT / 2 - 24,
      width: 48,
      height: 48,
      vy: 0,
      invincibilityFrames: 0,
      image: ghostyImage,
    };
    ScoreManager.init();
    AudioManager.init();
    InputHandler.init();
    // Wire AudioManager.unlock to first user gesture
    const unlockAudio = () => {
      AudioManager.unlock();
      window.removeEventListener('keydown', unlockAudio);
      canvas.removeEventListener('click', unlockAudio);
      canvas.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('keydown', unlockAudio);
    canvas.addEventListener('click', unlockAudio);
    canvas.addEventListener('touchstart', unlockAudio);
    // Pre-populate clouds for menu
    for (let i = 0; i < 5; i++) {
      const c = spawnCloud();
      c.x = Math.random() * CANVAS_WIDTH;
      GameState.clouds.push(c);
    }
    // Start game loop
    prevTime = performance.now();
    requestAnimationFrame(gameLoop);
  };
  ghostyImage.onerror = () => {
    // Fallback: start without image (white rectangle will be drawn)
    GameState.ghosty = {
      x: CANVAS_WIDTH / 2 - 24,
      y: CANVAS_HEIGHT / 2 - 24,
      prevY: CANVAS_HEIGHT / 2 - 24,
      width: 48,
      height: 48,
      vy: 0,
      invincibilityFrames: 0,
      image: null,
    };
    ScoreManager.init();
    AudioManager.init();
    InputHandler.init();
    for (let i = 0; i < 5; i++) {
      const c = spawnCloud();
      c.x = Math.random() * CANVAS_WIDTH;
      GameState.clouds.push(c);
    }
    prevTime = performance.now();
    requestAnimationFrame(gameLoop);
  };
}

// -----------------------------------------------------------------------------
// Node.js export for pure-logic testing (no browser required)
// -----------------------------------------------------------------------------
if (typeof module !== 'undefined') {
  module.exports = {
    CONFIG,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    HUD_HEIGHT,
    PIPE_WIDTH,
    StateMachine,
    PhysicsEngine,
    CollisionDetector,
    ScoreManager,
    GameState,
    spawnPipe,
    updatePipes,
    applyDifficultyScaling,
    spawnCloud,
    updateClouds,
    checkScoring,
    updateParticles,
    updateScorePopups,
    resetGame,
    FIXED_DT,
  };
}

// ESM exports for Node.js test runner (game.test.mjs)
export {
  CONFIG,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  PIPE_WIDTH,
  StateMachine,
  PhysicsEngine,
  CollisionDetector,
  ScoreManager,
  GameState,
  spawnPipe,
  updatePipes,
  applyDifficultyScaling,
  spawnCloud,
  updateClouds,
  checkScoring,
  updateParticles,
  updateScorePopups,
  resetGame,
  FIXED_DT,
};
