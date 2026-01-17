// HUD (Heads-Up Display) system

export class HUD {
    constructor() {
        this.debugOverlayVisible = false;
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
    }

    show() {
        const hud = document.getElementById('game-hud');
        if (hud) hud.classList.remove('hidden');
    }

    hide() {
        const hud = document.getElementById('game-hud');
        if (hud) hud.classList.add('hidden');
    }

    update(progress, speed, debugInfo = {}) {
        // Update stage time
        const lapTimeEl = document.getElementById('lap-time');
        if (lapTimeEl) {
            if (progress.hasStarted) {
                lapTimeEl.textContent = this.formatTime(progress.stageTime || 0);
            } else {
                lapTimeEl.textContent = '0.00';
            }
        }

        // Update best time
        const bestTimeEl = document.getElementById('best-time');
        if (bestTimeEl) {
            if (progress.bestStageTime) {
                bestTimeEl.textContent = this.formatTime(progress.bestStageTime);
            } else {
                bestTimeEl.textContent = '--:--.--';
            }
        }

        // Update stage status (replacing lap number)
        const lapNumberEl = document.getElementById('lap-number');
        if (lapNumberEl) {
            if (progress.stageComplete) {
                lapNumberEl.textContent = 'FINISH';
            } else if (progress.hasStarted) {
                lapNumberEl.textContent = 'STAGE';
            } else {
                lapNumberEl.textContent = 'READY';
            }
        }

        // Update checkpoint progress
        const checkpointProgressEl = document.getElementById('checkpoint-progress');
        if (checkpointProgressEl) {
            checkpointProgressEl.textContent = `${progress.checkpoint || 0}/${progress.total || 0}`;
        }

        // Update speed
        const speedEl = document.getElementById('speed');
        if (speedEl) {
            speedEl.textContent = Math.round(speed);
        }

        // Update debug overlay
        if (this.debugOverlayVisible) {
            this.updateDebugOverlay(debugInfo);
        }
    }

    updateDebugOverlay(debugInfo) {
        const debugEl = document.getElementById('debug-overlay');
        if (!debugEl) return;

        let html = '';
        if (debugInfo.fps !== undefined) {
            html += `<div>FPS: ${Math.round(debugInfo.fps)}</div>`;
        }
        if (debugInfo.slipAngle !== undefined) {
            html += `<div>Slip Angle: ${(debugInfo.slipAngle * 180 / Math.PI).toFixed(1)}°</div>`;
        }
        if (debugInfo.surfaceType) {
            html += `<div>Surface: ${debugInfo.surfaceType}</div>`;
        }
        if (debugInfo.speed !== undefined) {
            html += `<div>Speed: ${debugInfo.speed.toFixed(1)} px/s</div>`;
        }
        if (debugInfo.grip !== undefined) {
            html += `<div>Grip: ${debugInfo.grip.toFixed(1)}</div>`;
        }

        debugEl.innerHTML = html;
    }

    toggleDebug() {
        this.debugOverlayVisible = !this.debugOverlayVisible;
        const debugEl = document.getElementById('debug-overlay');
        if (debugEl) {
            if (this.debugOverlayVisible) {
                debugEl.classList.remove('hidden');
            } else {
                debugEl.classList.add('hidden');
            }
        }
    }

    renderMinimap(car, ghostCar, track, camera) {
        if (!this.minimapCtx || !track) return;

        const ctx = this.minimapCtx;
        const width = this.minimapCanvas.width;
        const height = this.minimapCanvas.height;

        // Clear
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        // Get track bounds
        const bounds = track.getBounds();
        const scaleX = width / bounds.width;
        const scaleY = height / bounds.height;
        const scale = Math.min(scaleX, scaleY) * 0.9;

        // Center offset
        const offsetX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
        const offsetY = (height - bounds.height * scale) / 2 - bounds.minY * scale;

        // Draw track boundaries
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 2;

        // Outer boundary
        if (track.outerBoundary && track.outerBoundary.length > 0) {
            ctx.beginPath();
            const first = track.outerBoundary[0];
            ctx.moveTo(first.x * scale + offsetX, first.y * scale + offsetY);
            for (let i = 1; i < track.outerBoundary.length; i++) {
                const p = track.outerBoundary[i];
                ctx.lineTo(p.x * scale + offsetX, p.y * scale + offsetY);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Inner boundary
        if (track.innerBoundary && track.innerBoundary.length > 0) {
            ctx.beginPath();
            const first = track.innerBoundary[0];
            ctx.moveTo(first.x * scale + offsetX, first.y * scale + offsetY);
            for (let i = 1; i < track.innerBoundary.length; i++) {
                const p = track.innerBoundary[i];
                ctx.lineTo(p.x * scale + offsetX, p.y * scale + offsetY);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // Draw checkpoints
        ctx.fillStyle = '#ffff00';
        for (const cp of track.checkpointRects) {
            ctx.fillRect(
                cp.x * scale + offsetX - cp.width * scale / 2,
                cp.y * scale + offsetY - cp.height * scale / 2,
                cp.width * scale,
                cp.height * scale
            );
        }

        // Draw start line (green)
        if (track.startLine) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(
                track.startLine.x * scale + offsetX,
                (track.startLine.y - 20) * scale + offsetY
            );
            ctx.lineTo(
                track.startLine.x * scale + offsetX,
                (track.startLine.y + 20) * scale + offsetY
            );
            ctx.stroke();
        }

        // Draw finish line (red)
        if (track.finishLine) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            const angle = track.finishLine.angle || 0;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const offsetX2 = -sin * 20 * scale;
            const offsetY2 = cos * 20 * scale;
            ctx.beginPath();
            ctx.moveTo(
                track.finishLine.x * scale + offsetX - offsetX2,
                track.finishLine.y * scale + offsetY - offsetY2
            );
            ctx.lineTo(
                track.finishLine.x * scale + offsetX + offsetX2,
                track.finishLine.y * scale + offsetY + offsetY2
            );
            ctx.stroke();
        }

        // Draw ghost car (if active)
        if (ghostCar && ghostCar.isActive) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#8888ff';
            const gx = ghostCar.position.x * scale + offsetX;
            const gy = ghostCar.position.y * scale + offsetY;
            ctx.beginPath();
            ctx.arc(gx, gy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Draw player car
        if (car) {
            ctx.fillStyle = '#00ff41';
            const cx = car.position.x * scale + offsetX;
            const cy = car.position.y * scale + offsetY;
            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.fill();

            // Draw direction indicator
            ctx.strokeStyle = '#00ff41';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(
                cx + Math.cos(car.angle) * 10,
                cy + Math.sin(car.angle) * 10
            );
            ctx.stroke();
        }
    }

    formatTime(seconds) {
        if (!seconds && seconds !== 0) return '--:--.--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
}
