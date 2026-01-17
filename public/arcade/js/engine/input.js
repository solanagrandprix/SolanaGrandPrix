// Input handling for keyboard, gamepad, and mobile touch controls

export class InputManager {
    constructor() {
        this.keys = new Set();
        this.gamepadIndex = -1;
        this.gamepadConnected = false;
        this.mobileControls = {
            left: false,
            right: false,
            throttle: false,
            brake: false,
            handbrake: false
        };
        
        this.setupKeyboard();
        this.setupGamepad();
        this.setupMobile();
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.code);
            // Prevent default for game keys
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
        });
    }

    setupGamepad() {
        // MDN Gamepad API: Handle connect/disconnect events
        // Reference: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad.id);
            console.log('Gamepad index:', e.gamepad.index);
            // Store first connected gamepad index
            if (this.gamepadIndex < 0) {
                this.gamepadIndex = e.gamepad.index;
                this.gamepadConnected = true;
            }
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('Gamepad disconnected:', e.gamepad.index);
            if (e.gamepad.index === this.gamepadIndex) {
                this.gamepadIndex = -1;
                this.gamepadConnected = false;
            }
        });
        
        // Poll gamepads initially to detect already-connected gamepads
        // MDN pattern: navigator.getGamepads() returns array of gamepad objects
        this.pollGamepads();
    }
    
    // MDN pattern: Poll gamepads every frame (recommended approach)
    pollGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        
        // Find first connected gamepad if we don't have one stored
        if (this.gamepadIndex < 0) {
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i] && gamepads[i].connected) {
                    this.gamepadIndex = i;
                    this.gamepadConnected = true;
                    console.log('Found connected gamepad:', gamepads[i].id);
                    break;
                }
            }
        }
    }

    setupMobile() {
        // Detect mobile - check for touch capability and small screen or mobile user agent
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSmallScreen = window.innerWidth <= 768;
        const isMobile = hasTouch && (isMobileUA || isSmallScreen);
        
        if (!isMobile) return;

        // Show mobile controls
        const mobileControlsEl = document.getElementById('mobile-controls');
        if (mobileControlsEl) {
            mobileControlsEl.classList.remove('hidden');
        }

        // Setup touch controls
        const leftBtn = document.getElementById('mobile-left');
        const rightBtn = document.getElementById('mobile-right');
        const throttleBtn = document.getElementById('mobile-throttle');
        const brakeBtn = document.getElementById('mobile-brake');
        const handbrakeBtn = document.getElementById('mobile-handbrake');

        const setupButton = (btn, control) => {
            if (!btn) return;
            
            const startHandler = (e) => {
                e.preventDefault();
                this.mobileControls[control] = true;
                btn.classList.add('active');
            };
            
            const endHandler = (e) => {
                e.preventDefault();
                this.mobileControls[control] = false;
                btn.classList.remove('active');
            };

            btn.addEventListener('touchstart', startHandler, { passive: false });
            btn.addEventListener('touchend', endHandler, { passive: false });
            btn.addEventListener('touchcancel', endHandler, { passive: false });
            btn.addEventListener('mousedown', startHandler);
            btn.addEventListener('mouseup', endHandler);
            btn.addEventListener('mouseleave', endHandler);
        };

        setupButton(leftBtn, 'left');
        setupButton(rightBtn, 'right');
        setupButton(throttleBtn, 'throttle');
        setupButton(brakeBtn, 'brake');
        setupButton(handbrakeBtn, 'handbrake');
    }

    // MDN pattern: Get gamepad via polling navigator.getGamepads()
    // Reference: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API
    getGamepad() {
        // Poll for gamepads (MDN recommended pattern)
        this.pollGamepads();
        
        if (this.gamepadIndex >= 0) {
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            const gamepad = gamepads[this.gamepadIndex];
            
            // Check if gamepad is still connected
            if (!gamepad || !gamepad.connected) {
                this.gamepadIndex = -1;
                this.gamepadConnected = false;
                return null;
            }
            
            return gamepad;
        }
        return null;
    }

    // Get steering input (-1 to 1)
    // MDN pattern: axes[0] = left stick horizontal, axes[1] = left stick vertical
    getSteer() {
        // Gamepad first (MDN standard mapping)
        const gamepad = this.getGamepad();
        if (gamepad && gamepad.axes && gamepad.axes.length > 0) {
            const steer = gamepad.axes[0]; // Left stick X axis
            // Dead zone to ignore stick drift
            if (Math.abs(steer) > 0.15) {
                return clamp(steer, -1, 1);
            }
        }

        // Keyboard
        let steer = 0;
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer -= 1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer += 1;

        // Mobile
        if (this.mobileControls.left) steer -= 1;
        if (this.mobileControls.right) steer += 1;

        return clamp(steer, -1, 1);
    }

    // Get throttle input (0 to 1)
    // MDN pattern: buttons array, RT typically index 7 (varies by controller)
    getThrottle() {
        // Gamepad
        const gamepad = this.getGamepad();
        if (gamepad && gamepad.buttons) {
            // Try common mappings: RT (index 7), Right trigger (index 6), or Right stick button
            let throttle = 0;
            
            // Xbox-style: RT is button 7 (value 0-1 for analog)
            if (gamepad.buttons[7] && typeof gamepad.buttons[7].value === 'number') {
                throttle = gamepad.buttons[7].value;
            }
            // Alternative: button 5 (Right Shoulder) as digital throttle
            else if (gamepad.buttons[5] && gamepad.buttons[5].pressed) {
                throttle = 1.0;
            }
            // Alternative: Use right stick Y axis (up = throttle down = brake)
            else if (gamepad.axes && gamepad.axes.length > 3) {
                const stickY = -gamepad.axes[3]; // Invert Y (up = negative usually)
                throttle = Math.max(0, stickY); // Only positive values
            }
            
            if (throttle > 0.1) {
                return clamp(throttle, 0, 1);
            }
        }

        // Keyboard
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
            return 1;
        }

        // Mobile
        if (this.mobileControls.throttle) {
            return 1;
        }

        return 0;
    }

    // Get brake input (0 to 1)
    // MDN pattern: LT typically index 6 (varies by controller)
    getBrake() {
        // Gamepad
        const gamepad = this.getGamepad();
        if (gamepad && gamepad.buttons) {
            // Try common mappings: LT (index 6), Left trigger
            let brake = 0;
            
            // Xbox-style: LT is button 6 (value 0-1 for analog)
            if (gamepad.buttons[6] && typeof gamepad.buttons[6].value === 'number') {
                brake = gamepad.buttons[6].value;
            }
            // Alternative: button 4 (Left Shoulder) as digital brake
            else if (gamepad.buttons[4] && gamepad.buttons[4].pressed) {
                brake = 1.0;
            }
            // Alternative: Use right stick Y axis (down = brake)
            else if (gamepad.axes && gamepad.axes.length > 3) {
                const stickY = -gamepad.axes[3]; // Invert Y
                brake = Math.max(0, -stickY); // Only negative values (pressed down)
            }
            
            if (brake > 0.1) {
                return clamp(brake, 0, 1);
            }
        }

        // Keyboard
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
            return 1;
        }

        // Mobile
        if (this.mobileControls.brake) {
            return 1;
        }

        return 0;
    }

    // Get handbrake input (boolean)
    // MDN pattern: buttons array, A button typically index 0
    getHandbrake() {
        // Gamepad
        const gamepad = this.getGamepad();
        if (gamepad && gamepad.buttons) {
            // Common mappings: A button (index 0), B button (index 1), or Left Shoulder (index 4)
            if ((gamepad.buttons[0] && gamepad.buttons[0].pressed) || // A button
                (gamepad.buttons[1] && gamepad.buttons[1].pressed) || // B button (alternative)
                (gamepad.buttons[4] && gamepad.buttons[4].pressed)) { // Left Shoulder (alternative)
                return true;
            }
        }

        // Keyboard
        if (this.keys.has('Space')) {
            return true;
        }

        // Mobile
        if (this.mobileControls.handbrake) {
            return true;
        }

        return false;
    }

    // Check if reset key is pressed
    isResetPressed() {
        // Gamepad
        const gamepad = this.getGamepad();
        if (gamepad) {
            if (gamepad.buttons[3]?.pressed) { // Y button
                return true;
            }
        }

        // Keyboard
        return this.keys.has('KeyR');
    }

    // Check if pause key is pressed
    isPausePressed() {
        return this.keys.has('Escape');
    }

    // Check if debug toggle is pressed
    isDebugTogglePressed() {
        return this.keys.has('Backquote');
    }
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
