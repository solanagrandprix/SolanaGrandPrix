// WebAudio-based sound system (oscillator-only, no external files)
// Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
// Implementation uses OscillatorNode + GainNode envelopes per MDN/W3C standards

export class AudioManager {
    constructor() {
        this.audioContext = null;
        this.engineOsc = null;
        this.engineGain = null;
        this.skidOsc = null;
        this.skidGain = null;
        this.uiGain = null;
        this.enabled = false;
        this.engineFreq = 0;
        this.engineVolume = 0;
        this.skidVolume = 0;
        
        this.initAudioContext();
    }

    // Initialize Web Audio API context (MDN pattern)
    initAudioContext() {
        try {
            // MDN: Use AudioContext or webkitAudioContext for compatibility
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                console.warn('Web Audio API not supported');
                return;
            }
            
            this.audioContext = new AudioContextClass();
            this.enabled = true;
            
            // Setup audio nodes
            this.setupEngineSound();
            this.setupSkidSound();
            this.setupUISound();
            
            // Resume audio context on user interaction (required by browsers)
            const resumeAudio = () => {
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                document.removeEventListener('click', resumeAudio);
                document.removeEventListener('touchstart', resumeAudio);
            };
            document.addEventListener('click', resumeAudio);
            document.addEventListener('touchstart', resumeAudio);
            
        } catch (error) {
            console.warn('Failed to initialize audio:', error);
            this.enabled = false;
        }
    }

    // Setup engine sound using OscillatorNode + GainNode envelope
    // MDN: https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode
    // MDN: https://developer.mozilla.org/en-US/docs/Web/API/GainNode
    setupEngineSound() {
        if (!this.audioContext || !this.enabled) return;
        
        try {
            // Create oscillator for engine sound (sine wave for smooth engine tone)
            this.engineOsc = this.audioContext.createOscillator();
            this.engineOsc.type = 'sawtooth'; // Sawtooth for more engine-like sound
            this.engineOsc.frequency.setValueAtTime(60, this.audioContext.currentTime);
            
            // Create gain node for volume control
            this.engineGain = this.audioContext.createGain();
            this.engineGain.gain.setValueAtTime(0, this.audioContext.currentTime);
            
            // Connect: Oscillator -> Gain -> Destination
            this.engineOsc.connect(this.engineGain);
            this.engineGain.connect(this.audioContext.destination);
            
            // Start oscillator (runs continuously)
            this.engineOsc.start();
        } catch (error) {
            console.warn('Failed to setup engine sound:', error);
            this.enabled = false;
        }
    }

    // Setup skid sound using OscillatorNode (white noise-like)
    setupSkidSound() {
        if (!this.audioContext || !this.enabled) return;
        
        try {
            // Create oscillator for skid sound (square wave for harsh tire sound)
            this.skidOsc = this.audioContext.createOscillator();
            this.skidOsc.type = 'sawtooth'; // Sawtooth with high frequency for skid texture
            this.skidOsc.frequency.setValueAtTime(200, this.audioContext.currentTime);
            
            // Create gain node for volume control
            this.skidGain = this.audioContext.createGain();
            this.skidGain.gain.setValueAtTime(0, this.audioContext.currentTime);
            
            // Connect: Oscillator -> Gain -> Destination
            this.skidOsc.connect(this.skidGain);
            this.skidGain.connect(this.audioContext.destination);
            
            // Start oscillator (runs continuously)
            this.skidOsc.start();
        } catch (error) {
            console.warn('Failed to setup skid sound:', error);
        }
    }

    // Setup UI sound gain node (shared for UI clicks)
    setupUISound() {
        if (!this.audioContext || !this.enabled) return;
        
        try {
            this.uiGain = this.audioContext.createGain();
            this.uiGain.gain.setValueAtTime(0, this.audioContext.currentTime);
            this.uiGain.connect(this.audioContext.destination);
        } catch (error) {
            console.warn('Failed to setup UI sound:', error);
        }
    }

    // Update engine sound based on throttle and speed
    // MDN: Use setValueAtTime for smooth parameter changes
    updateEngine(throttle, speed, maxSpeed) {
        if (!this.enabled || !this.engineOsc || !this.engineGain) return;
        
        try {
            // Calculate engine frequency based on throttle and speed
            // Base frequency: 60 Hz (low idle)
            // Max frequency: 400 Hz (high revs)
            const speedRatio = Math.min(speed / maxSpeed, 1.0);
            const throttleFactor = throttle;
            const targetFreq = 60 + (speedRatio * 200) + (throttleFactor * 140);
            
            // Smooth frequency transition (avoid clicks/pops)
            const now = this.audioContext.currentTime;
            this.engineFreq = targetFreq;
            this.engineOsc.frequency.exponentialRampToValueAtTime(
                Math.max(20, targetFreq), // Min 20 Hz to avoid audio issues
                now + 0.1 // 100ms transition
            );
            
            // Calculate engine volume based on throttle (more throttle = louder)
            const baseVolume = 0.15;
            const throttleVolume = throttle * 0.2;
            const speedVolume = speedRatio * 0.15;
            this.engineVolume = Math.min(baseVolume + throttleVolume + speedVolume, 0.5);
            
            // Smooth volume transition using GainNode envelope
            this.engineGain.gain.exponentialRampToValueAtTime(
                this.engineVolume,
                now + 0.05 // 50ms transition for responsive feel
            );
        } catch (error) {
            // Silently fail if audio context is suspended or unavailable
            if (error.name !== 'InvalidStateError') {
                console.warn('Engine sound update error:', error);
            }
        }
    }

    // Update skid sound based on slip angle
    updateSkid(slipAngle, maxSlipAngle) {
        if (!this.enabled || !this.skidOsc || !this.skidGain) return;
        
        try {
            // Calculate skid intensity based on slip angle
            const absSlip = Math.abs(slipAngle);
            const slipRatio = Math.min(absSlip / maxSlipAngle, 1.0);
            
            // Only play skid sound when actually drifting
            if (slipRatio < 0.15) {
                this.skidVolume = 0;
            } else {
                // Calculate skid frequency (higher slip = higher pitch)
                const skidFreq = 150 + (slipRatio * 250); // 150-400 Hz range
                const now = this.audioContext.currentTime;
                
                this.skidOsc.frequency.exponentialRampToValueAtTime(
                    Math.max(50, skidFreq),
                    now + 0.08 // 80ms transition
                );
                
                // Calculate skid volume based on slip intensity
                // More slip = louder skid
                this.skidVolume = slipRatio * 0.25; // Max 0.25 volume
            }
            
            // Smooth volume transition
            const now = this.audioContext.currentTime;
            this.skidGain.gain.exponentialRampToValueAtTime(
                this.skidVolume,
                now + 0.06 // 60ms transition
            );
        } catch (error) {
            if (error.name !== 'InvalidStateError') {
                console.warn('Skid sound update error:', error);
            }
        }
    }

    // Play UI click sound (short beep using oscillator)
    playUIClick() {
        if (!this.enabled || !this.audioContext || !this.uiGain) return;
        
        try {
            const now = this.audioContext.currentTime;
            
            // Create a short oscillator for click sound
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now); // 800 Hz beep
            
            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.001); // Quick attack
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05); // Quick decay
            
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            
            osc.start(now);
            osc.stop(now + 0.05); // 50ms click sound
        } catch (error) {
            // Silently fail
        }
    }

    // Play menu select sound (slightly different pitch)
    playMenuSelect() {
        if (!this.enabled || !this.audioContext || !this.uiGain) return;
        
        try {
            const now = this.audioContext.currentTime;
            
            // Create a short oscillator for select sound (lower pitch)
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now); // 600 Hz beep
            
            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.001); // Quick attack
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08); // Slightly longer decay
            
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            
            osc.start(now);
            osc.stop(now + 0.08); // 80ms select sound
        } catch (error) {
            // Silently fail
        }
    }
}
