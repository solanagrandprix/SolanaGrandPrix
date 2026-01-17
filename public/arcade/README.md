# Solana Grand Prix — Rally Arcade

A polished top-down 2D rally racing game with arcade-style physics, drift mechanics, lap timing, checkpoints, and a track editor.

## Quick Start

1. **Local Development**: Open `index.html` in a modern web browser (Chrome, Firefox, Edge).
   - No build step required - pure vanilla JavaScript with ES6 modules.
   - All assets are self-contained - no external dependencies.

2. **Express Integration**: Drop this entire `/public/arcade/` folder into your Express `public` directory.
   - Access the game at: `http://localhost:3000/arcade` (or your configured port).
   - Ensure your Express server serves static files from the `public` directory.

3. **Navigation Link**: Add to your navbar:
   ```html
   <a href="/arcade">Arcade</a>
   ```

## Features

### Core Gameplay
- **Responsive Controls**: WASD/Arrow keys, gamepad support (Xbox, PlayStation), and mobile touch controls.
- **Physics**: Acceleration, braking, steering with realistic drift mechanics.
- **Surfaces**: Asphalt (high grip), dirt (medium grip), grass (low grip).
- **Collisions**: Track boundary detection with bounce and speed loss.

### Game Modes
- **Play**: Race mode with lap counting.
- **Time Trial**: Race against your best lap time with ghost car.
- **Ghost Car**: See your best lap replay as a semi-transparent car.

### Track System
- **Checkpoints**: Must pass all checkpoints in order to complete a lap.
- **Start/Finish Line**: Lap timing starts and ends at the start line.
- **Example Tracks**:
  - **Lime Rock Mini**: Compact asphalt track
  - **Dirt Ridge**: Mixed surface track with dirt and asphalt sections

### Track Editor
- Press `Shift+E` during gameplay to enable editor mode.
- **Controls**:
  - Click: Add outer boundary point
  - Shift+Click: Add inner boundary point
  - Ctrl/Cmd+Click: Place checkpoint
  - S: Set start/finish line at car position
  - Shift+E: Export track JSON to console

### UI Features
- **HUD**: Lap time, best lap, current lap, speed, checkpoint progress, minimap.
- **Debug Overlay**: Press `` ` `` to toggle FPS, slip angle, surface type, grip.
- **Leaderboard**: Local top 10 best lap times per track (stored in localStorage).
- **Menu System**: Main menu, track selection, controls, leaderboard, pause menu.

### Audio
- **WebAudio**: Engine sound (pitch based on speed/throttle), skid sound (based on slip angle), UI click sounds.
- No external audio files required - all generated procedurally.

## File Structure

```
public/arcade/
├── index.html              # Main HTML file
├── style.css               # Styling (SolanaGP theme)
├── README.md               # This file
└── js/
    ├── main.js             # Entry point
    ├── engine/
    │   ├── game.js         # Main game loop
    │   ├── input.js        # Input handling (keyboard/gamepad/mobile)
    │   ├── math.js         # Vector math utilities
    │   ├── camera.js       # Camera system
    │   ├── audio.js        # WebAudio sound system
    │   └── storage.js      # localStorage wrapper
    ├── world/
    │   ├── track.js        # Track class
    │   ├── tracks.js       # Track definitions (ADD NEW TRACKS HERE)
    │   ├── checkpoints.js  # Checkpoint manager
    │   └── particles.js    # Particle system (tire marks)
    ├── entities/
    │   ├── car.js          # Player car physics (CONSTANTS AT TOP)
    │   └── aiCar.js        # Ghost car for time trials
    └── ui/
        ├── hud.js          # Heads-up display
        ├── menu.js         # Menu system
        └── leaderboard.js  # Leaderboard management
```

## Adding New Tracks

Edit `js/world/tracks.js`:

1. Define track data:
```javascript
export const TRACKS = {
    'My Custom Track': new Track({
        name: 'My Custom Track',
        outerBoundary: createVec2Array([
            [x1, y1], [x2, y2], [x3, y3], // ... more points
        ]),
        innerBoundary: createVec2Array([
            [x1, y1], [x2, y2], [x3, y3], // ... more points
        ]),
        startLine: {
            x: 0,
            y: 0,
            angle: 0,
            width: 100
        },
        checkpoints: [
            { x: 100, y: 100, width: 60, height: 60 },
            { x: 200, y: 200, width: 60, height: 60 },
            // ... more checkpoints
        ],
        surfaces: [
            {
                type: 'asphalt', // or 'dirt' or 'grass'
                poly: createVec2Array([
                    [x1, y1], [x2, y2], // ... polygon points
                ])
            }
        ]
    })
};
```

2. Use the track editor (`Shift+E` in-game) to place points visually, then export to console and copy the JSON.

3. Add the exported track data to `tracks.js`.

## Tuning Car Physics

Edit `js/entities/car.js` - all constants are at the top:

```javascript
export const CAR_CONFIG = {
    MAX_ACCELERATION: 1200,      // Higher = faster acceleration
    MAX_BRAKE_FORCE: 1800,       // Higher = stronger braking
    MAX_TRACTION: 250,           // Max speed with full grip
    SLIP_THRESHOLD: 0.15,        // Slip angle before drift starts
    DRIFT_FACTOR: 0.3,           // How much speed affects grip
    GRIP_RECOVERY: 0.8,          // Grip recovery when throttle released
    // ... more constants
};
```

## Controls

### Keyboard
- **WASD** or **Arrow Keys**: Drive (W/Up = throttle, S/Down = brake, A/D = steer)
- **Space**: Handbrake
- **R**: Reset to last checkpoint
- **Esc**: Pause/Menu
- **`** (Backtick): Toggle debug overlay
- **Shift+E**: Toggle track editor mode

### Gamepad
- **Left Stick**: Steer
- **RT (Right Trigger)**: Accelerate
- **LT (Left Trigger)**: Brake
- **A Button**: Handbrake
- **Y Button**: Reset to checkpoint

### Mobile
- On-screen touch controls (left/right buttons, throttle, brake, handbrake)

## Verification Checklist

Follow these 10 steps to verify everything works:

1. ✅ **Game Loads**: Open `index.html` in browser - main menu should appear with "Solana Grand Prix Rally Arcade" title.

2. ✅ **Track Selection**: Click "Play" → select a track → game should start with car at start line.

3. ✅ **Controls Work**: 
   - WASD/Arrows move the car
   - Camera follows smoothly
   - Collision with boundaries bounces car back

4. ✅ **Checkpoints**: Drive through checkpoints in order → HUD shows "X/Y" progress.

5. ✅ **Lap Timing**: Complete a full lap → HUD shows lap time and updates best time.

6. ✅ **Drift/Physics**: Turn sharply at speed → car should slide/drift, tire marks should appear.

7. ✅ **Audio**: 
   - Engine sound should vary with speed/throttle
   - Skid sound should play when drifting
   - UI click sounds when clicking menu buttons

8. ✅ **Time Trial Mode**: 
   - Select "Time Trial" → complete a lap → ghost car option appears
   - Enable ghost toggle, race again → should see semi-transparent ghost car

9. ✅ **Leaderboard**: 
   - Complete a fast lap → name entry modal should appear
   - Enter name → check leaderboard menu → should see your entry

10. ✅ **Track Editor**:
    - Start a race → press `Shift+E` → yellow "EDITOR MODE" text appears
    - Click to place points → press `S` at car position to set start line
    - Press `Shift+E` again → JSON exported to console

11. ✅ **Debug Overlay**: Press `` ` `` → should show FPS, slip angle, surface type.

12. ✅ **Mobile**: Test on mobile device → touch controls should appear at bottom.

## Troubleshooting

- **No audio**: Browser requires user interaction to enable audio. Click anywhere on the page first.
- **Gamepad not working**: Check browser gamepad support. Some browsers need extensions.
- **Canvas blurry**: Ensure `devicePixelRatio` scaling is working correctly (should be automatic).
- **Track doesn't load**: Check browser console for errors. Ensure track data is valid JSON.

## Technical Notes

- **Physics**: Fixed timestep (60 Hz) with interpolation for smooth rendering.
- **Rendering**: Canvas 2D with devicePixelRatio scaling for crisp graphics.
- **Storage**: All game data stored in localStorage (best times, ghost data, leaderboards).
- **Performance**: Uses `requestAnimationFrame` for optimal frame timing.
- **No Dependencies**: Pure vanilla JavaScript with ES6 modules - no build step needed.

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (may need user interaction for audio)
- Mobile browsers: Full support with touch controls

---

**IRACING • LEAGUE • STATS • CRYPTO**

Built for Solana Grand Prix
