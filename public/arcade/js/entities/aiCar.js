// AI car for ghost replay

import { Car } from './car.js';

export class AICar extends Car {
    constructor(x, y, angle = 0) {
        super(x, y, angle);
        this.ghostData = null;
        this.currentFrame = 0;
        this.isActive = false;
        this.opacity = 0.5; // Semi-transparent ghost
    }

    loadGhostData(ghostData) {
        this.ghostData = ghostData;
        this.currentFrame = 0;
        this.isActive = ghostData && ghostData.length > 0;
    }

    update(deltaTime) {
        if (!this.isActive || !this.ghostData || this.currentFrame >= this.ghostData.length) {
            this.isActive = false;
            return;
        }

        // Get current frame data
        const frame = this.ghostData[this.currentFrame];
        if (frame) {
            this.position.set(frame.x, frame.y);
            this.angle = frame.angle;
            this.speed = frame.speed || 0;
            this.slipAngle = frame.slipAngle || 0;
        }

        // Advance frame (assuming 60 FPS recording)
        const frameRate = 60;
        this.currentFrame += frameRate * deltaTime;

        if (this.currentFrame >= this.ghostData.length) {
            this.isActive = false;
        }
    }

    // Don't record tire marks for ghost car
    getTireMarks() {
        return [];
    }
}
