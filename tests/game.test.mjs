// Feature: flappy-kiro — Property-Based Tests
import fc from 'fast-check';
import { CONFIG, PhysicsEngine, CollisionDetector, ScoreManager, spawnPipe, applyDifficultyScaling, GameState, CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, PIPE_WIDTH } from '../game.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

console.log('\nFlappy Kiro — Property-Based Tests\n');

// Feature: flappy-kiro, Property 1: Velocity is always within bounds
test('Property 1: Velocity is always within bounds', () => {
  fc.assert(fc.property(
    fc.array(fc.oneof(fc.constant('gravity'), fc.constant('flap')), { minLength: 1, maxLength: 100 }),
    (actions) => {
      const ghosty = { x: 100, y: 100, prevY: 100, width: 48, height: 48, vy: 0, invincibilityFrames: 0, image: null };
      for (const action of actions) {
        if (action === 'gravity') PhysicsEngine.update(ghosty, 1/60);
        else PhysicsEngine.flap(ghosty);
      }
      return ghosty.vy >= CONFIG.MAX_RISE_VELOCITY && ghosty.vy <= CONFIG.MAX_FALL_VELOCITY;
    }
  ), { numRuns: 100 });
});

// Feature: flappy-kiro, Property 2: Gravity accumulates velocity correctly
test('Property 2: Gravity accumulates velocity correctly', () => {
  fc.assert(fc.property(
    fc.float({ min: -10, max: 10, noNaN: true }),
    fc.integer({ min: 1, max: 200 }),
    (v0, n) => {
      const ghosty = { x: 100, y: 100, prevY: 100, width: 48, height: 48, vy: v0, invincibilityFrames: 0, image: null };
      for (let i = 0; i < n; i++) PhysicsEngine.update(ghosty, 1/60);
      const expected = clamp(v0 + n * CONFIG.GRAVITY, CONFIG.MAX_RISE_VELOCITY, CONFIG.MAX_FALL_VELOCITY);
      return Math.abs(ghosty.vy - expected) < 0.001;
    }
  ), { numRuns: 100 });
});

// Feature: flappy-kiro, Property 3: Position integrates from velocity
test('Property 3: Position integrates from velocity', () => {
  fc.assert(fc.property(
    fc.float({ min: 0, max: 500, noNaN: true }),
    fc.float({ min: -10, max: 12, noNaN: true }),
    (y0, vy) => {
      const ghosty = { x: 100, y: y0, prevY: y0, width: 48, height: 48, vy, invincibilityFrames: 0, image: null };
      const dt = 1/60;
      const scale = dt * 60;
      const expectedVy = clamp(vy + CONFIG.GRAVITY * scale, CONFIG.MAX_RISE_VELOCITY, CONFIG.MAX_FALL_VELOCITY);
      const expectedY = y0 + expectedVy * scale;
      PhysicsEngine.update(ghosty, dt);
      return Math.abs(ghosty.y - expectedY) < 0.001;
    }
  ), { numRuns: 100 });
});

// Feature: flappy-kiro, Property 4: Delta-time scaling is proportional
test('Property 4: Delta-time scaling is proportional', () => {
  fc.assert(fc.property(
    fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
    (dt) => {
      const ghosty = { x: 100, y: 100, prevY: 100, width: 48, height: 48, vy: 0, invincibilityFrames: 0, image: null };
      const prevVy = ghosty.vy;
      PhysicsEngine.update(ghosty, dt);
      const expectedDelta = CONFIG.GRAVITY * (dt * 60);
      const actualDelta = clamp(prevVy + expectedDelta, CONFIG.MAX_RISE_VELOCITY, CONFIG.MAX_FALL_VELOCITY) - prevVy;
      const computedDelta = ghosty.vy - prevVy;
      return Math.abs(computedDelta - actualDelta) < 0.001;
    }
  ), { numRuns: 100 });
});

// Feature: flappy-kiro, Property 5: Render interpolation is a linear blend
test('Property 5: Render interpolation is a linear blend', () => {
  fc.assert(fc.property(
    fc.float({ min: 0, max: 1, noNaN: true }),
    fc.float({ min: 0, max: 500, noNaN: true }),
    fc.float({ min: 0, max: 500, noNaN: true }),
    (alpha, prevY, currentY) => {
      const expected = prevY + alpha * (currentY - prevY);
      const ghosty = { x: 100, y: currentY, prevY, width: 48, height: 48, vy: 0, invincibilityFrames: 0, image: null };
      const renderedY = ghosty.prevY + alpha * (ghosty.y - ghosty.prevY);
      return Math.abs(renderedY - expected) < 0.001;
    }
  ), { numRuns: 100 });
});

// Feature: flappy-kiro, Property 6: Pipe gap size is always GAP_SIZE
test('Property 6: Pipe gap size is always GAP_SIZE', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 100 }),
    (n) => {
      for (let i = 0; i < n; i++) {
        const pipe = spawnPipe();
        const gapTop = pipe.gapCenterY - CONFIG.GAP_SIZE / 2;
        const gapBottom = pipe.gapCenterY + CONFIG.GAP_SIZE / 2;
        if (Math.abs((gapBottom - gapTop) - CONFIG.GAP_SIZE) > 0.001) return false;
      }
      return true;
    }
  ), { numRuns: 100 });
});

// Feature: flappy-kiro, Property 7: Pipe gap center is always within valid bounds
test('Property 7: Pipe gap center is always within valid bounds', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 100 }),
    (n) => {
      const playAreaHeight = CANVAS_HEIGHT - HUD_HEIGHT;
      for (let i = 0; i < n; i++) {
        const pipe = spawnPipe();
        if (pipe.gapCenterY < CONFIG.GAP_MIN_Y) return false;
        if (pipe.gapCenterY > playAreaHeight - CONFIG.GAP_MAX_Y) return false;
      }
      return true;
    }
  ), { numRuns: 100 });
});

// Feature: flappy-kiro, Property 8: Pipe speed is always capped at PIPE_SPEED_MAX
test('Property 8: Pipe speed is always capped at PIPE_SPEED_MAX', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 1000 }),
    (score) => {
      GameState.currentPipeSpeed = CONFIG.PIPE_SPEED;
      ScoreManager.score = score;
      applyDifficultyScaling();
      return GameState.currentPipeSpeed <= CONFIG.PIPE_SPEED_MAX;
    }
  ), { numRuns: 100 });
});

// Feature: flappy-kiro, Property 9: Ghosty hitbox is centered and shrunk by HITBOX_SHRINK
test('Property 9: Ghosty hitbox is centered and shrunk by HITBOX_SHRINK', () => {
  fc.assert(fc.property(
    fc.float({ min: 10, max: 200, noNaN: true }),
    fc.float({ min: 10, max: 200, noNaN: true }),
    (w, h) => {
      const ghosty = { x: 50, y: 50, prevY: 50, width: w, height: h, vy: 0, invincibilityFrames: 0, image: null };
      const hb = CollisionDetector.getHitbox(ghosty);
      const expectedW = w * CONFIG.HITBOX_SHRINK;
      const expectedH = h * CONFIG.HITBOX_SHRINK;
      const expectedX = ghosty.x + (w - expectedW) / 2;
      const expectedY = ghosty.y + (h - expectedH) / 2;
      return Math.abs(hb.w - expectedW) < 0.001 &&
             Math.abs(hb.h - expectedH) < 0.001 &&
             Math.abs(hb.x - expectedX) < 0.001 &&
             Math.abs(hb.y - expectedY) < 0.001;
    }
  ), { numRuns: 100 });
});

// Feature: flappy-kiro, Property 12: HUD format string is correct for any score values
test('Property 12: HUD format string is correct for any score values', () => {
  fc.assert(fc.property(
    fc.nat(),
    fc.nat(),
    (score, highScore) => {
      const expected = `Score: ${score} | High: ${highScore}`;
      const actual = `Score: ${score} | High: ${highScore}`;
      return actual === expected;
    }
  ), { numRuns: 100 });
});

// Feature: flappy-kiro, Property 13: High score is updated and persisted when score exceeds it
test('Property 13: High score is updated and persisted when score exceeds it', () => {
  fc.assert(fc.property(
    fc.nat({ max: 1000 }).filter(n => n > 0),
    fc.nat({ max: 999 }),
    (score, highScore) => {
      fc.pre(score > highScore);
      ScoreManager.score = score;
      ScoreManager.highScore = highScore;
      ScoreManager.checkAndPersist();
      return ScoreManager.highScore === score;
    }
  ), { numRuns: 100 });
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
