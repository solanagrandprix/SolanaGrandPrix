// Camera system with smoothing

import { Vec2, lerp } from './math.js';

export class Camera {
    constructor() {
        this.target = new Vec2(0, 0);
        this.position = new Vec2(0, 0);
        this.smoothFactor = 0.1; // Higher = faster follow (0-1)
        this.zoom = 1.0;
        this.shakeIntensity = 0;
        this.shakeDecay = 0.9;
    }

    setTarget(x, y) {
        this.target.set(x, y);
    }

    update(deltaTime) {
        // Smooth follow
        const diff = this.target.sub(this.position);
        this.position = this.position.add(diff.mul(this.smoothFactor));

        // Camera shake decay
        this.shakeIntensity *= this.shakeDecay;
    }

    addShake(intensity) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    // Get world to screen transform
    worldToScreen(worldPos, canvasWidth, canvasHeight) {
        const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 10;
        const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 10;

        const screenX = (worldPos.x - this.position.x) * this.zoom + canvasWidth / 2 + shakeX;
        const screenY = (worldPos.y - this.position.y) * this.zoom + canvasHeight / 2 + shakeY;

        return new Vec2(screenX, screenY);
    }

    // Get screen to world transform
    screenToWorld(screenPos, canvasWidth, canvasHeight) {
        const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 10;
        const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 10;

        const worldX = (screenPos.x - canvasWidth / 2 - shakeX) / this.zoom + this.position.x;
        const worldY = (screenPos.y - canvasHeight / 2 - shakeY) / this.zoom + this.position.y;

        return new Vec2(worldX, worldY);
    }
}
