# Requirements Document

## Introduction

Flappy Kiro is a retro-style, browser-based endless scroller game. The player controls a ghost character (Ghosty) through an infinite series of pipe obstacles. The game features a hand-drawn/sketchy visual aesthetic with decorative parallax cloud layers in the background, sound effects, and a persistent high score. The game runs entirely in the browser with no server-side dependencies.

## Glossary

- **Game**: The Flappy Kiro browser application as a whole.
- **Ghosty**: The player-controlled ghost character rendered using `assets/ghosty.png`.
- **Pipe_Pair**: A pair of green pipes (one from the top, one from the bottom) with a gap between them that Ghosty must fly through.
- **Cloud**: A semi-transparent white rounded-rectangle drawn in the background layer as a purely decorative element. Clouds are not obstacles and do not interact with Ghosty.
- **Gap**: The vertical opening between the top and bottom pipes of a Pipe_Pair through which Ghosty must pass.
- **Score**: The count of Pipe_Pairs successfully passed by Ghosty in the current session.
- **High_Score**: The highest Score achieved across all sessions, persisted in browser local storage.
- **Canvas**: The HTML5 `<canvas>` element on which the game is rendered.
- **HUD**: The dark bottom bar displaying the current Score and High_Score.
- **Physics_Engine**: The internal subsystem responsible for applying gravity and velocity to Ghosty.
- **Collision_Detector**: The internal subsystem that checks for collisions between Ghosty and pipes, the ground, or the ceiling.
- **Ceiling_Bounce**: A non-lethal collision response that occurs when Ghosty's top edge reaches the top of the Canvas (y ≤ 0). Instead of triggering game over, the Physics_Engine reverses Ghosty's vertical velocity and clamps Ghosty's position to y = 0, causing Ghosty to bounce downward. A brief invincibility period is granted after a Ceiling_Bounce to prevent an immediate lethal pipe collision.
- **Renderer**: The internal subsystem responsible for drawing all game elements to the Canvas each frame.
- **Input_Handler**: The internal subsystem that captures keyboard and pointer input to trigger Ghosty's flap action.
- **Audio_Manager**: The internal subsystem that loads and plays sound effects.
- **Score_Manager**: The internal subsystem that tracks, updates, and persists Score and High_Score.
- **State_Machine**: The internal subsystem that governs which of the four named game states is active at any time. The four states are: `menu` (the main menu screen shown on load), `playing` (active gameplay), `paused` (gameplay frozen with overlay), and `game_over` (end-of-round screen shown after a lethal collision).
- **Particle_Trail**: A stream of short-lived semi-transparent dot particles emitted from Ghosty's position during gameplay to give a sense of motion.
- **Score_Popup**: A brief floating "+1" text indicator that appears near Ghosty when the score increments.

---

## Requirements

### Requirement 1: Main Menu State

**User Story:** As a player, I want to see a main menu screen when the game loads, so that I know the game is ready, can see my all-time high score, and can start playing when I choose.

#### Acceptance Criteria

1. WHEN the browser loads the Game, THE State_Machine SHALL enter the `menu` state.
2. WHILE the Game is in the `menu` state, THE Renderer SHALL display the game title "Flappy Kiro" prominently on the Canvas.
3. WHILE the Game is in the `menu` state, THE Renderer SHALL display the all-time High_Score loaded from localStorage in the format `High Score: X`.
4. WHILE the Game is in the `menu` state, THE Renderer SHALL display a "Press Space or Tap to Start" prompt.
5. WHILE the Game is in the `menu` state, THE Renderer SHALL draw Ghosty in a centered, idle position — not falling and not moving vertically.
6. WHILE the Game is in the `menu` state, THE Renderer SHALL animate the parallax cloud background continuously, so that clouds scroll across the Canvas as a decorative backdrop.
7. WHEN the player presses the Space key or taps the Canvas while the Game is in the `menu` state, THE State_Machine SHALL transition to the `playing` state.
8. WHEN the browser loads the Game, THE Audio_Manager SHALL preload `assets/jump.wav` and `assets/game_over.wav` before the first interaction.
9. THE Game SHALL run entirely in the browser without requiring a server-side backend or network requests beyond the initial page load.

---

### Requirement 2: Player Input and Flap Mechanic

**User Story:** As a player, I want to control Ghosty by pressing a key or tapping the screen, so that I can navigate through obstacles.

#### Acceptance Criteria

1. WHEN the player presses the Space key or clicks/taps the Canvas, THE Input_Handler SHALL trigger a flap action on Ghosty.
2. WHEN a flap action is triggered, THE Physics_Engine SHALL apply an upward velocity impulse to Ghosty, overriding any current downward velocity.
3. WHEN a flap action is triggered, THE Audio_Manager SHALL play `assets/jump.wav`.
4. WHILE the Game is in the `game_over` state, THE Input_Handler SHALL ignore flap actions and SHALL NOT apply velocity to Ghosty.

---

### Requirement 3: Physics and Gravity

**User Story:** As a player, I want Ghosty to fall under gravity and respond to flaps, so that the game has a satisfying physical feel.

#### Acceptance Criteria

1. WHILE the Game is in the `playing` state, THE Physics_Engine SHALL apply a configurable gravitational acceleration constant (default: `GRAVITY = 0.5 px/frame²`) to Ghosty's vertical velocity each frame, accumulating downward velocity over time.
2. WHILE the Game is in the `playing` state, THE Physics_Engine SHALL update Ghosty's vertical position each frame by adding the current velocity to the current position, producing smooth continuous motion.
3. WHEN a flap action is triggered, THE Physics_Engine SHALL set Ghosty's vertical velocity to a configurable upward impulse constant (default: `FLAP_VELOCITY = -8 px/frame`), replacing any current velocity value rather than adding to it.
4. THE Physics_Engine SHALL cap Ghosty's downward (positive) velocity at a configurable terminal velocity constant (default: `MAX_FALL_VELOCITY = 12 px/frame`), so that Ghosty cannot accelerate beyond this speed regardless of how long the player waits.
5. THE Physics_Engine SHALL cap Ghosty's upward (negative) velocity at a configurable ceiling constant (default: `MAX_RISE_VELOCITY = -10 px/frame`), so that consecutive rapid flaps do not cause Ghosty to accelerate upward beyond this speed.
6. THE Physics_Engine SHALL accumulate velocity changes smoothly each frame rather than snapping to discrete values, so that consecutive flaps feel natural and momentum is preserved between frames.
7. WHILE the Game is in the `playing` state, THE Physics_Engine SHALL scale all velocity and acceleration values by a delta-time factor derived from the elapsed time since the previous frame, so that Ghosty's movement speed remains consistent regardless of the actual frame rate.
8. THE Renderer SHALL interpolate Ghosty's rendered position between the previous and current physics frame positions using the sub-frame time remainder, so that Ghosty's on-screen motion appears smooth and free of jitter at varying frame rates.
9. THE Game SHALL expose `GRAVITY`, `FLAP_VELOCITY`, `MAX_FALL_VELOCITY`, and `MAX_RISE_VELOCITY` as named tunable constants in a single configuration location, so that physics feel can be adjusted without modifying game logic.

---

### Requirement 4: Pipe Obstacle Generation and Scrolling

**User Story:** As a player, I want an endless stream of pipe obstacles to scroll toward me, so that the game presents a continuous challenge.

#### Acceptance Criteria

1. WHILE the Game is in the `playing` state, THE Game SHALL spawn a new Pipe_Pair at a fixed horizontal distance after the previous Pipe_Pair, where that distance is controlled by a configurable constant (default: `PIPE_SPACING = 300 px`), so that the gap between consecutive obstacles remains consistent.
2. WHILE the Game is in the `playing` state, THE Renderer SHALL scroll all active Pipe_Pairs leftward each frame at the current pipe scroll speed, which starts at a configurable initial speed constant (default: `PIPE_SPEED = 3 px/frame`).
3. WHEN a Pipe_Pair moves completely off the left edge of the Canvas, THE Game SHALL remove that Pipe_Pair from the active obstacle list.
4. THE Game SHALL set the vertical height of the Gap for every Pipe_Pair to a configurable constant (default: `GAP_SIZE = 160 px`), so that the opening Ghosty must fly through is uniform and tunable.
5. WHEN a new Pipe_Pair is spawned, THE Game SHALL randomize the vertical center position of the Gap using a uniform distribution between a configurable minimum margin from the top of the play area (default: `GAP_MIN_Y = 80 px`) and a configurable maximum margin from the bottom of the play area (default: `GAP_MAX_Y = 80 px`), so that the Gap is never clipped by the Canvas boundary or the HUD.
6. WHILE the Game is in the `playing` state, THE Game SHALL increase the current pipe scroll speed by a configurable increment (default: `PIPE_SPEED_INCREMENT = 0.5 px/frame`) each time the player's Score reaches a multiple of a configurable interval (default: `PIPE_SPEED_INTERVAL = 5 pipes`), so that the game becomes progressively harder as the score rises.
7. THE Game SHALL cap the pipe scroll speed at a configurable maximum (default: `PIPE_SPEED_MAX = 8 px/frame`), so that the scroll speed never increases beyond a playable limit regardless of score.
8. THE Game SHALL expose `PIPE_SPACING`, `PIPE_SPEED`, `GAP_SIZE`, `GAP_MIN_Y`, `GAP_MAX_Y`, `PIPE_SPEED_INCREMENT`, `PIPE_SPEED_INTERVAL`, and `PIPE_SPEED_MAX` as named tunable constants in the same single configuration location as the physics constants defined in Requirement 3, so that all gameplay tuning is centralised.
9. THE Renderer SHALL draw each pipe with a green fill and a cap/lip at the open end, consistent with the classic Flappy Bird style shown in the reference screenshot.

---

### Requirement 5: Cloud Background and Parallax Scrolling

**User Story:** As a player, I want decorative clouds drifting in the background at varying speeds, so that the game has visual depth and a sense of perspective.

#### Acceptance Criteria

1. WHILE the Game is in the `playing` state, THE Game SHALL spawn Clouds at randomized horizontal intervals and vertical positions within the play area.
2. WHILE the Game is in the `playing` state, THE Renderer SHALL scroll each Cloud leftward at an independently assigned speed, with different Clouds moving at different speeds to create a parallax depth effect.
3. WHEN a Cloud moves completely off the left edge of the Canvas, THE Game SHALL remove that Cloud from the active background list.
4. THE Renderer SHALL draw each Cloud as a semi-transparent white rounded rectangle in the background layer, behind Ghosty and all Pipe_Pairs.
5. THE Renderer SHALL draw Clouds before drawing Pipe_Pairs and Ghosty each frame, so that Clouds never appear in front of gameplay elements.

---

### Requirement 6: Collision Detection and Game Over

**User Story:** As a player, I want the game to end when Ghosty hits a lethal obstacle or boundary, so that the game has meaningful consequences for mistakes, while non-lethal ceiling contacts feel forgiving and fair.

#### Acceptance Criteria

1. THE Collision_Detector SHALL compute Ghosty's active hitbox as a centered rectangle whose width and height are each equal to the sprite's rendered dimensions multiplied by a configurable shrink factor (default: `HITBOX_SHRINK = 0.6`), so that the hitbox is smaller than the visible sprite and gives the player a forgiving feel.
2. THE Collision_Detector SHALL treat each pipe's collision boundary as its exact drawn rectangle (full width, full height of the pipe segment), with no shrink applied to pipe boundaries.
3. WHEN the Collision_Detector detects that Ghosty's hitbox overlaps with any pipe rectangle AND Ghosty is not in the invincibility period, THE Game SHALL transition to the `game_over` state.
4. WHEN Ghosty's bottom edge reaches or exceeds the ground boundary Y position (defined as canvas height minus HUD height), THE Game SHALL transition to the `game_over` state.
5. WHEN Ghosty's top edge reaches or goes above the top of the Canvas (y ≤ 0) AND the Game is in the `playing` state, THE Physics_Engine SHALL perform a Ceiling_Bounce: reverse Ghosty's vertical velocity and clamp Ghosty's Y position to 0, so that Ghosty bounces downward rather than triggering game over.
6. WHEN a Ceiling_Bounce occurs, THE Physics_Engine SHALL grant Ghosty an invincibility period lasting a configurable number of frames (default: `INVINCIBILITY_FRAMES = 60 frames`), during which the Collision_Detector SHALL ignore pipe overlap checks, so that Ghosty cannot suffer an immediate lethal pipe collision after bouncing off the ceiling.
7. WHEN the Game transitions to the `game_over` state due to a pipe or ground collision, THE Renderer SHALL play a brief visual flash and shake effect on Ghosty lasting a configurable duration (default: `COLLISION_FLASH_DURATION = 500 ms`) before displaying the game over screen.
8. WHEN the Game transitions to the `game_over` state, THE Audio_Manager SHALL play `assets/game_over.wav`.
9. WHEN the Game transitions to the `game_over` state, THE Renderer SHALL display a "Game Over" message and a "Press Space or Tap to Restart" prompt overlaid on the Canvas.
10. THE Game SHALL expose `HITBOX_SHRINK`, `INVINCIBILITY_FRAMES`, and `COLLISION_FLASH_DURATION` as named tunable constants in the same single configuration location as the physics and pipe constants defined in Requirements 3 and 4.

---

### Requirement 7: Scoring and Persistent High Score

**User Story:** As a player, I want to see my current score and all-time high score in real time, and have my high score saved permanently, so that I have a meaningful goal to beat across sessions.

#### Acceptance Criteria

1. WHEN Ghosty passes completely through the Gap of a Pipe_Pair, THE Score_Manager SHALL increment the Score by 1.
2. WHILE the Game is in the `playing` state, THE HUD SHALL display the current Score and High_Score in the format `Score: X | High: X`, updated every frame.
3. WHEN the Game transitions to the `game_over` state AND the current Score exceeds the stored High_Score, THE Score_Manager SHALL immediately update the High_Score to the current Score and persist the new value to localStorage under the key `flappyKiro_highScore`.
4. THE Score_Manager SHALL load the High_Score from localStorage under the key `flappyKiro_highScore` during game initialization, before the `menu` state is displayed.
5. IF no value exists in localStorage under `flappyKiro_highScore`, THEN THE Score_Manager SHALL default the High_Score to 0.
6. WHEN the Game restarts from the `game_over` state, THE Score_Manager SHALL reset the current Score to 0 while retaining the persisted High_Score.

---

### Requirement 8: Game Over Screen and Restart

**User Story:** As a player, I want to see a clear game over screen with my final score and high score, and be able to restart immediately, so that I can try to beat my record.

#### Acceptance Criteria

1. WHEN the Game transitions to the `game_over` state, THE Renderer SHALL display a "Game Over" message overlaid on the Canvas.
2. WHEN the Game is in the `game_over` state, THE Renderer SHALL display the final Score and the current High_Score on the game over screen.
3. WHEN the Game is in the `game_over` state AND the current Score equals the High_Score AND the High_Score is greater than 0, THE Renderer SHALL display a "New High Score!" message on the game over screen.
4. WHILE the Game is in the `game_over` state, THE Renderer SHALL display a "Press Space or Tap to Restart" prompt.
5. WHEN the player presses the Space key or taps the Canvas while the Game is in the `game_over` state, THE State_Machine SHALL transition to the `playing` state (not the `menu` state).
6. WHEN the Game transitions from `game_over` to `playing`, THE Game SHALL reset Ghosty's position and velocity to their initial values, clear all active Pipe_Pairs and Clouds, and reset the current Score to 0.
7. WHEN the Game transitions to the `game_over` state, THE Audio_Manager SHALL play `assets/game_over.wav`.

---

### Requirement 9: Visual Style and Rendering

**User Story:** As a player, I want the game to have a retro hand-drawn aesthetic with rich visual feedback, so that it feels charming, visually distinct, and responsive to gameplay events.

#### Acceptance Criteria

1. THE Renderer SHALL draw the background as a light-blue color with a sketchy/textured appearance on every frame.
2. THE Renderer SHALL draw Ghosty using the `assets/ghosty.png` image asset.
3. THE Renderer SHALL draw the HUD as a dark bar at the bottom of the Canvas containing the Score and High_Score text in a retro-style font.
4. THE Renderer SHALL maintain a consistent frame rate by using `requestAnimationFrame` for the game loop.
5. THE Canvas SHALL have a fixed resolution appropriate for browser display, with the aspect ratio matching the reference screenshot.
6. WHEN a lethal collision occurs, THE Renderer SHALL apply a screen shake effect to the Canvas for `COLLISION_FLASH_DURATION` ms by applying a rapid random positional offset to the Canvas transform each frame during the shake period, where the maximum offset magnitude is controlled by a configurable constant (default: `SHAKE_MAGNITUDE = 8 px`).
7. WHILE the Game is in the `playing` state, THE Renderer SHALL emit a Particle_Trail from Ghosty's position consisting of small semi-transparent white dot particles, where each particle fades out over a configurable lifetime (default: `PARTICLE_LIFETIME = 300 ms`).
8. WHEN the Score increments, THE Renderer SHALL display a Score_Popup showing "+1" near Ghosty's current position that floats upward and fades out over a configurable duration (default: `SCORE_POPUP_DURATION = 600 ms`).
9. WHEN the Game transitions to the `game_over` state AND a new High_Score has been set, THE Renderer SHALL display the "New High Score!" text with a flashing or pulsing animation on the game over screen.
10. THE Game SHALL expose `SHAKE_MAGNITUDE`, `PARTICLE_LIFETIME`, and `SCORE_POPUP_DURATION` as named tunable constants in the same single configuration location as the physics and pipe constants defined in Requirements 3 and 4.

---

### Requirement 10: Audio Management

**User Story:** As a player, I want sound effects and background music for key game events, so that the game feels responsive, immersive, and engaging.

#### Acceptance Criteria

1. THE Audio_Manager SHALL load `assets/jump.wav` and `assets/game_over.wav` at game initialization.
2. WHEN a flap action occurs, THE Audio_Manager SHALL play `assets/jump.wav` from the beginning, even if the sound is already playing.
3. WHEN the Score increments, THE Audio_Manager SHALL play a distinct scoring sound effect. IF `assets/score.wav` is present, THEN THE Audio_Manager SHALL play `assets/score.wav`; otherwise THE Audio_Manager SHALL synthesize a short beep tone using the Web Audio API as a fallback.
4. WHEN the Game transitions to the `game_over` state, THE Audio_Manager SHALL play `assets/game_over.wav`.
5. WHEN the Game transitions to the `playing` state, THE Audio_Manager SHALL begin playing a looping background music track. IF `assets/music.wav` is present, THEN THE Audio_Manager SHALL load and loop `assets/music.wav`; otherwise THE Audio_Manager SHALL synthesize a simple looping chiptune melody using the Web Audio API.
6. WHEN the Game transitions to the `paused` state, THE Audio_Manager SHALL pause the background music track.
7. WHEN the Game transitions from `paused` back to `playing`, THE Audio_Manager SHALL resume the background music track from the point at which it was paused.
8. WHEN the Game transitions to the `game_over` state, THE Audio_Manager SHALL stop the background music track.
9. THE Audio_Manager SHALL play all sound effects at a volume level controlled by a configurable constant (default: `SFX_VOLUME = 0.8`, range 0–1).
10. THE Audio_Manager SHALL play background music at a volume level controlled by a configurable constant (default: `MUSIC_VOLUME = 0.4`, range 0–1).
11. IF the browser has not yet received a user gesture, THEN THE Audio_Manager SHALL defer audio playback until after the first user interaction, in compliance with browser autoplay policies.
12. THE Game SHALL expose `SFX_VOLUME` and `MUSIC_VOLUME` as named tunable constants in the same single configuration location as the physics and pipe constants defined in Requirements 3 and 4.

---

### Requirement 11: Pause Functionality

**User Story:** As a player, I want to pause the game at any time during play, so that I can take a break without losing my current run.

#### Acceptance Criteria

1. WHEN the player presses the Escape key or activates a pause button while the Game is in the `playing` state, THE State_Machine SHALL transition to the `paused` state.
2. WHILE the Game is in the `paused` state, THE Game SHALL freeze the game loop so that no physics updates, pipe scrolling, cloud scrolling, or pipe spawning occur.
3. WHILE the Game is in the `paused` state, THE Renderer SHALL display a "PAUSED" overlay on the Canvas.
4. WHILE the Game is in the `paused` state, THE Renderer SHALL display a "Press Escape or Tap to Resume" prompt.
5. WHILE the Game is in the `paused` state, THE Renderer SHALL continue to draw Ghosty, all active Pipe_Pairs, and all active Clouds in their frozen positions, so that the scene remains visible beneath the overlay.
6. WHEN the player presses the Escape key or taps the Canvas while the Game is in the `paused` state, THE State_Machine SHALL transition back to the `playing` state and resume the game loop from the exact frozen state.

---

### Requirement 12: Comprehensive Audio and Visual Feedback

**User Story:** As a player, I want cohesive audio and visual feedback throughout the game, so that every meaningful event feels satisfying and the game world feels alive.

#### Acceptance Criteria

1. THE Game SHALL expose `SHAKE_MAGNITUDE`, `PARTICLE_LIFETIME`, `SCORE_POPUP_DURATION`, `SFX_VOLUME`, and `MUSIC_VOLUME` as named tunable constants in the same single configuration location as all other constants defined in Requirements 3, 4, 6, 9, and 10, so that all audio and visual feedback tuning is centralised.
2. WHEN a lethal collision occurs, THE Renderer SHALL simultaneously trigger the screen shake effect (Requirement 9, criterion 6) and THE Audio_Manager SHALL play `assets/game_over.wav` (Requirement 10, criterion 4), so that visual and audio collision feedback are synchronised.
3. WHEN the Score increments, THE Renderer SHALL simultaneously display the Score_Popup (Requirement 9, criterion 8) and THE Audio_Manager SHALL play the scoring sound (Requirement 10, criterion 3), so that visual and audio scoring feedback are synchronised.
4. WHILE the Game is in the `playing` state, THE Renderer SHALL continuously emit the Particle_Trail from Ghosty (Requirement 9, criterion 7) regardless of whether Ghosty is ascending or descending.
5. WHEN the Game transitions to the `game_over` state AND a new High_Score has been set, THE Renderer SHALL display the flashing "New High Score!" animation (Requirement 9, criterion 9) at the same time as the game over screen is shown.
