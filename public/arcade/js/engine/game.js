// Main game loop with fixed timestep physics

import { Vec2 } from './math.js';
import { Camera } from './camera.js';
import { AudioManager } from './audio.js';
import { StorageManager } from './storage.js';
import { Car, CAR_CONFIG } from '../entities/car.js';
import { AICar } from '../entities/aiCar.js';
import { CheckpointManager } from '../world/checkpoints.js';
import { ParticleSystem } from '../world/particles.js';
import { Track } from '../world/track.js';
import { HUD } from '../ui/hud.js';
import { LeaderboardManager } from '../ui/leaderboard.js';

const FIXED_TIMESTEP = 1 / 60; // 60 Hz physics
const MAX_FRAME_TIME = 0.25; // Prevent spiral of death

export class Game {
    constructor(canvas, inputManager, menuManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.inputManager = inputManager;
        this.menuManager = menuManager;

        // Pass game instance to menu manager
        if (menuManager && menuManager.setGameInstance) {
            menuManager.setGameInstance(this);
        }

        // Game state
        this.isRunning = false;
        this.isPaused = false;
        this.currentTrack = null;
        this.car = null;
        this.ghostCar = null;
        this.checkpointManager = null;
        this.particleSystem = new ParticleSystem();
        this.isTimeTrialMode = false;
        this.ghostData = [];
        this.recordingGhost = false;
        this.editorMode = false;

        // Systems
        this.camera = new Camera();
        // Initialize audio manager (WebAudio oscillator-only)
        this.audioManager = new AudioManager();
        this.hud = new HUD();
        this.leaderboardManager = new LeaderboardManager();

        // Timing
        this.lastTime = 0;
        this.accumulator = 0;
        this.frameCount = 0;
        this.fps = 60;

        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        // Set canvas size with device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Set actual canvas size with DPR
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        // Scale context to handle DPR
        this.ctx.scale(dpr, dpr);
    }

    setupEventListeners() {
        // Editor mode - track editing
        this.editorPoints = {
            outer: [],
            inner: [],
            checkpoints: [],
            startLine: null
        };
        
        this.canvas.addEventListener('click', (e) => {
            if (!this.editorMode || !this.currentTrack || !this.car) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const x = (e.clientX - rect.left) * dpr / dpr;
            const y = (e.clientY - rect.top) * dpr / dpr;
            
            // Convert screen to world coordinates
            const screenPos = new Vec2(x, y);
            const worldPos = this.camera.screenToWorld(screenPos, this.canvas.width / dpr, this.canvas.height / dpr);
            
            if (e.shiftKey) {
                // Shift-click: inner boundary
                this.editorPoints.inner.push(worldPos.copy());
                console.log('Inner boundary point:', worldPos.x, worldPos.y);
            } else if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd-click: checkpoint
                this.editorPoints.checkpoints.push({
                    x: worldPos.x,
                    y: worldPos.y,
                    width: 50,
                    height: 50
                });
                console.log('Checkpoint:', worldPos.x, worldPos.y);
            } else {
                // Normal click: outer boundary
                this.editorPoints.outer.push(worldPos.copy());
                console.log('Outer boundary point:', worldPos.x, worldPos.y);
            }
        });

        // Keyboard shortcuts for editor
        window.addEventListener('keydown', (e) => {
            if (!this.editorMode) return;
            
            if (e.code === 'KeyS' && !e.shiftKey && !e.ctrlKey) {
                // S: Set start line
                if (this.car) {
                    this.editorPoints.startLine = {
                        x: this.car.position.x,
                        y: this.car.position.y,
                        angle: this.car.angle,
                        width: 100
                    };
                    console.log('Start line set:', this.editorPoints.startLine);
                }
            } else if (e.code === 'KeyE' && e.shiftKey) {
                // Shift+E: Export track JSON
                this.exportTrackJSON();
            }
        });
    }
    
    exportTrackJSON() {
        const trackData = {
            name: 'Custom Track',
            outerBoundary: this.editorPoints.outer.map(p => [p.x, p.y]),
            innerBoundary: this.editorPoints.inner.map(p => [p.x, p.y]),
            checkpoints: this.editorPoints.checkpoints,
            startLine: this.editorPoints.startLine,
            surfaces: []
        };
        
        console.log('Track JSON:');
        console.log(JSON.stringify(trackData, null, 2));
        alert('Track data exported to console! Check the browser console.');
    }

    async start(trackName, isTimeTrialMode = false) {
        this.isTimeTrialMode = isTimeTrialMode;
        await this.loadTrack(trackName);
        this.initGame();
        this.isRunning = true;
        this.isPaused = false;
        this.hud.show();
        this.lastTime = performance.now() / 1000;
        this.gameLoop();
    }

    async loadTrack(trackName) {
        // Import track dynamically
        const { getTrack } = await import('../world/tracks.js');
        this.currentTrack = getTrack(trackName);
        
            // Load best stage time
            const bestTime = StorageManager.getBestLap(trackName);
            if (this.checkpointManager) {
                this.checkpointManager.bestStageTime = bestTime;
            }

        // Load ghost data if enabled
        if (this.menuManager.isGhostEnabled() && this.isTimeTrialMode) {
            const ghostData = StorageManager.getGhostData(trackName);
            if (ghostData && this.ghostCar) {
                this.ghostCar.loadGhostData(ghostData);
            }
        }
    }

    initGame() {
        if (!this.currentTrack) {
            console.error('No track loaded');
            return;
        }

        // Create car at start position
        const startLine = this.currentTrack.startLine;
        this.car = new Car(startLine.x, startLine.y, startLine.angle);

        // Create ghost car
        this.ghostCar = new AICar(startLine.x, startLine.y, startLine.angle);

        // Create checkpoint manager
        this.checkpointManager = new CheckpointManager(this.currentTrack);
        this.checkpointManager.start();

        // Reset systems
        this.particleSystem.clear();
        this.camera.position.set(startLine.x, startLine.y);
        this.camera.target.set(startLine.x, startLine.y);
        this.camera.zoom = 1.0;

        // Start recording ghost if in time trial mode
        this.ghostData = [];
        this.recordingGhost = this.isTimeTrialMode && this.menuManager.isGhostEnabled();
        this.isRecordingBestLap = false; // Set to true when we complete a best lap
    }

    pause() {
        if (!this.isRunning) return;
        this.isPaused = true;
        this.menuManager.showPauseMenu();
    }

    resume() {
        if (!this.isRunning || !this.isPaused) return;
        this.isPaused = false;
        this.menuManager.hidePauseMenu();
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.hud.hide();
        this.menuManager.hidePauseMenu();
    }

    resetCar() {
        if (!this.currentTrack || !this.car) return;
        const startLine = this.currentTrack.startLine;
        this.car.resetToCheckpoint(new Vec2(startLine.x, startLine.y), startLine.angle);
        
        // Reset checkpoint manager
        if (this.checkpointManager) {
            this.checkpointManager.reset();
            this.checkpointManager.start();
        }
    }

    gameLoop() {
        if (!this.isRunning) return;

        const currentTime = performance.now() / 1000;
        let deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Calculate FPS
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = 1 / deltaTime;
        }

        // Clamp delta time to prevent spiral of death
        deltaTime = Math.min(deltaTime, MAX_FRAME_TIME);

        if (!this.isPaused) {
            // Fixed timestep physics
            this.accumulator += deltaTime;

            while (this.accumulator >= FIXED_TIMESTEP) {
                this.update(FIXED_TIMESTEP);
                this.accumulator -= FIXED_TIMESTEP;
            }

            // Interpolation factor for smooth rendering
            const alpha = this.accumulator / FIXED_TIMESTEP;
            this.render(alpha);
        }

        requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        if (!this.car || !this.currentTrack) return;

        // Handle input
        if (this.inputManager.isResetPressed()) {
            this.resetCar();
        }

        if (this.inputManager.isPausePressed()) {
            if (this.isPaused) {
                this.resume();
            } else {
                this.pause();
            }
        }

        if (this.inputManager.isDebugTogglePressed()) {
            this.hud.toggleDebug();
        }

        // Get input
        const input = {
            steer: this.inputManager.getSteer(),
            throttle: this.inputManager.getThrottle(),
            brake: this.inputManager.getBrake(),
            handbrake: this.inputManager.getHandbrake()
        };

        // Update car physics
        this.car.update(input, deltaTime, this.currentTrack);

        // Check boundary collision
        this.car.checkBoundaryCollision(this.currentTrack);

        // Update checkpoint manager
        const carBounds = this.car.getBoundingCircle();
        this.checkpointManager.update(carBounds.center, carBounds.radius);

        // Record ghost data during stage (record every frame after start)
        if (this.recordingGhost && this.checkpointManager.hasPassedStartLine && !this.checkpointManager.stageComplete) {
            this.ghostData.push({
                x: this.car.position.x,
                y: this.car.position.y,
                angle: this.car.angle,
                speed: this.car.speed,
                slipAngle: this.car.slipAngle,
                timestamp: Date.now()
            });
        }

        // Check for stage completion (completeStage is called in checkpointManager.update)
        if (this.checkpointManager.stageComplete && !this.stageCompletedShown) {
            const progress = this.checkpointManager.getProgress();
            
            if (progress.stageTime) {
                const isNewBest = !progress.bestStageTime || progress.stageTime < progress.bestStageTime;
                
                if (isNewBest) {
                    // Save best stage time
                    StorageManager.saveBestLap(this.currentTrack.name, progress.stageTime);
                    
                    // Save ghost data if we recorded it
                    if (this.recordingGhost && this.ghostData.length > 0) {
                        this.saveGhostData();
                        this.ghostData = [];
                    }
                    
                    // Check leaderboard
                    if (this.isTimeTrialMode) {
                        this.leaderboardManager.checkAndSaveTime(this.currentTrack.name, progress.stageTime);
                    }
                }
            }
            
            this.stageCompletedShown = true;
        }

        // Update ghost car
        if (this.ghostCar && this.ghostCar.isActive) {
            this.ghostCar.update(deltaTime);
        }

        // Update camera
        this.camera.setTarget(this.car.position.x, this.car.position.y);
        this.camera.update(deltaTime);

        // Update audio (WebAudio oscillator-only)
        if (this.audioManager && this.audioManager.enabled) {
            this.audioManager.updateEngine(input.throttle, this.car.speed, CAR_CONFIG.MAX_TRACTION);
            this.audioManager.updateSkid(this.car.slipAngle, Math.PI / 2);
        }

        // Add tire marks from car to particle system (new API with intensity)
        const now = Date.now();
        for (const mark of this.car.tireMarks) {
            if (!mark.addedToParticles && mark.createdAt) {
                this.particleSystem.addTireMark(
                    mark.position, 
                    mark.angle, 
                    mark.slipAngle, 
                    mark.intensity || 1.0, // Intensity for mark darkness
                    mark.previousPosition || null // For connected segments
                );
                mark.addedToParticles = true;
            }
        }
        
        // Update particles
        this.particleSystem.update(deltaTime);
    }

    render(alpha) {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, width, height);

        if (!this.currentTrack || !this.car) return;

        // Save context
        this.ctx.save();

        // Translate to center camera
        this.ctx.translate(width / 2 - this.camera.position.x, height / 2 - this.camera.position.y);

        // Render track
        this.renderTrack();

        // Render editor points if in editor mode
        if (this.editorMode) {
            this.renderEditorPoints();
        }

        // Render checkpoints
        this.renderCheckpoints();

        // Render particles (tire marks)
        this.particleSystem.render(this.ctx, this.camera, width, height);

        // Render ghost car
        if (this.ghostCar && this.ghostCar.isActive) {
            this.renderCar(this.ghostCar, true);
        }

        // Render player car
        this.renderCar(this.car, false);

        // Restore context
        this.ctx.restore();

        // Render editor mode indicator
        if (this.editorMode) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = '20px monospace';
            this.ctx.fillText('EDITOR MODE', 10, 30);
            this.ctx.font = '12px monospace';
            this.ctx.fillText('Click: Outer boundary | Shift+Click: Inner | Ctrl+Click: Checkpoint | S: Start line | Shift+E: Export', 10, 50);
        }

        // Render HUD
        const progress = this.checkpointManager.getProgress();
        this.hud.update(progress, this.car.speed, {
            fps: this.fps,
            slipAngle: this.car.slipAngle,
            surfaceType: this.car.surfaceType,
            speed: this.car.speed,
            grip: this.car.currentGrip
        });

        // Render minimap
        this.hud.renderMinimap(this.car, this.ghostCar, this.currentTrack, this.camera);
    }
    
    renderEditorPoints() {
        const ctx = this.ctx;
        
        // Draw outer boundary points
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.fillStyle = '#00ff00';
        for (let i = 0; i < this.editorPoints.outer.length; i++) {
            const p = this.editorPoints.outer[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            
            if (i > 0) {
                ctx.beginPath();
                ctx.moveTo(this.editorPoints.outer[i - 1].x, this.editorPoints.outer[i - 1].y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            }
        }
        
        // Draw inner boundary points
        ctx.strokeStyle = '#ff0000';
        ctx.fillStyle = '#ff0000';
        for (let i = 0; i < this.editorPoints.inner.length; i++) {
            const p = this.editorPoints.inner[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            
            if (i > 0) {
                ctx.beginPath();
                ctx.moveTo(this.editorPoints.inner[i - 1].x, this.editorPoints.inner[i - 1].y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            }
        }
        
        // Draw checkpoints
        ctx.fillStyle = '#ffff00';
        for (const cp of this.editorPoints.checkpoints) {
            ctx.fillRect(cp.x - cp.width / 2, cp.y - cp.height / 2, cp.width, cp.height);
        }
        
        // Draw start line
        if (this.editorPoints.startLine) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(this.editorPoints.startLine.x, this.editorPoints.startLine.y - 20);
            ctx.lineTo(this.editorPoints.startLine.x, this.editorPoints.startLine.y + 20);
            ctx.stroke();
        }
    }

    renderTrack() {
        if (!this.currentTrack) return;

        const ctx = this.ctx;

        // Draw track surface (asphalt area)
        ctx.fillStyle = '#333';
        ctx.beginPath();
        if (this.currentTrack.outerBoundary && this.currentTrack.outerBoundary.length > 0) {
            const first = this.currentTrack.outerBoundary[0];
            ctx.moveTo(first.x, first.y);
            for (let i = 1; i < this.currentTrack.outerBoundary.length; i++) {
                const p = this.currentTrack.outerBoundary[i];
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            
            // Clip inner boundary
            if (this.currentTrack.innerBoundary && this.currentTrack.innerBoundary.length > 0) {
                const firstInner = this.currentTrack.innerBoundary[0];
                ctx.moveTo(firstInner.x, firstInner.y);
                for (let i = 1; i < this.currentTrack.innerBoundary.length; i++) {
                    const p = this.currentTrack.innerBoundary[i];
                    ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
            }
            
            ctx.fill('evenodd');
        }

        // Draw boundaries
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 3;

        // Outer boundary
        if (this.currentTrack.outerBoundary && this.currentTrack.outerBoundary.length > 0) {
            ctx.beginPath();
            const first = this.currentTrack.outerBoundary[0];
            ctx.moveTo(first.x, first.y);
            for (let i = 1; i < this.currentTrack.outerBoundary.length; i++) {
                const p = this.currentTrack.outerBoundary[i];
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Inner boundary
        if (this.currentTrack.innerBoundary && this.currentTrack.innerBoundary.length > 0) {
            ctx.beginPath();
            const first = this.currentTrack.innerBoundary[0];
            ctx.moveTo(first.x, first.y);
            for (let i = 1; i < this.currentTrack.innerBoundary.length; i++) {
                const p = this.currentTrack.innerBoundary[i];
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Draw start line (green)
        if (this.currentTrack.startLine) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(this.currentTrack.startLine.x, this.currentTrack.startLine.y - 20);
            ctx.lineTo(this.currentTrack.startLine.x, this.currentTrack.startLine.y + 20);
            ctx.stroke();
        }

        // Draw finish line (red)
        if (this.currentTrack.finishLine) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4;
            ctx.beginPath();
            const angle = this.currentTrack.finishLine.angle || 0;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const offsetX = -sin * 20;
            const offsetY = cos * 20;
            ctx.moveTo(
                this.currentTrack.finishLine.x - offsetX,
                this.currentTrack.finishLine.y - offsetY
            );
            ctx.lineTo(
                this.currentTrack.finishLine.x + offsetX,
                this.currentTrack.finishLine.y + offsetY
            );
            ctx.stroke();
        }
    }

    renderCheckpoints() {
        if (!this.currentTrack) return;

        const ctx = this.ctx;
        const checkpointManager = this.checkpointManager;

        for (let i = 0; i < this.currentTrack.checkpointRects.length; i++) {
            const cp = this.currentTrack.checkpointRects[i];
            const passed = i < checkpointManager.currentCheckpoint;
            
            ctx.fillStyle = passed ? '#00ff00' : '#ffff00';
            ctx.globalAlpha = passed ? 0.5 : 0.8;
            ctx.fillRect(cp.x - cp.width / 2, cp.y - cp.height / 2, cp.width, cp.height);
        }

        ctx.globalAlpha = 1.0;
    }

    renderCar(car, isGhost = false) {
        const ctx = this.ctx;
        ctx.save();

        if (isGhost) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#8888ff';
        } else {
            ctx.fillStyle = '#00ff41';
        }

        ctx.translate(car.position.x, car.position.y);
        ctx.rotate(car.angle);

        // Draw car body (rectangle)
        ctx.fillRect(-10, -17.5, 20, 35);

        // Draw nose indicator (triangle)
        ctx.beginPath();
        ctx.moveTo(0, -17.5);
        ctx.lineTo(-5, -25);
        ctx.lineTo(5, -25);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    saveGhostData() {
        if (this.ghostData.length > 0 && this.currentTrack) {
            StorageManager.saveGhostData(this.currentTrack.name, this.ghostData);
            console.log('Ghost data saved for', this.currentTrack.name);
        }
    }
}
