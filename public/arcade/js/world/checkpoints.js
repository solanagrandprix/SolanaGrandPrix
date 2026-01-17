// Checkpoint and stage tracking system (start to finish, no loops)

import { Vec2, circleRectIntersect } from '../engine/math.js';

export class CheckpointManager {
    constructor(track) {
        this.track = track;
        this.currentCheckpoint = 0;
        this.startTime = null;
        this.stageTime = 0;
        this.bestStageTime = null;
        this.lastCheckpointTime = null;
        this.hasPassedStartLine = false;
        this.stageComplete = false;
    }

    reset() {
        this.currentCheckpoint = 0;
        this.startTime = null;
        this.stageTime = 0;
        this.lastCheckpointTime = null;
        this.hasPassedStartLine = false;
        this.stageComplete = false;
    }

    start() {
        this.startTime = Date.now();
    }

    checkPassedStartLine(carPosition, carRadius) {
        if (!this.track.startLine) return false;
        
        const startRect = {
            x: this.track.startLine.x - this.track.startLine.width / 2,
            y: this.track.startLine.y - 20,
            width: this.track.startLine.width,
            height: 40
        };

        return circleRectIntersect(carPosition, carRadius, startRect);
    }

    checkPassedFinishLine(carPosition, carRadius) {
        if (!this.track.finishLine) return false;
        
        const finishRect = {
            x: this.track.finishLine.x - this.track.finishLine.width / 2,
            y: this.track.finishLine.y - 20,
            width: this.track.finishLine.width,
            height: 40
        };

        return circleRectIntersect(carPosition, carRadius, finishRect);
    }

    update(carPosition, carRadius) {
        if (this.stageComplete) return; // Stage already finished
        
        const now = Date.now();
        
        // Check if passed start line (only once)
        if (!this.hasPassedStartLine) {
            if (this.checkPassedStartLine(carPosition, carRadius)) {
                this.hasPassedStartLine = true;
                this.startTime = now;
            }
        }

        // Only track time and checkpoints after passing start line
        if (this.hasPassedStartLine && !this.stageComplete) {
            // Update stage time
            if (this.startTime) {
                this.stageTime = (now - this.startTime) / 1000;
            }

            // Check checkpoints
            if (this.currentCheckpoint < this.track.checkpoints.length) {
                if (this.track.checkCheckpoint(carPosition, carRadius, this.currentCheckpoint)) {
                    this.currentCheckpoint++;
                    this.lastCheckpointTime = now;
                }
            }

            // Check if passed finish line (after all checkpoints)
            if (this.currentCheckpoint >= this.track.checkpoints.length) {
                if (this.checkPassedFinishLine(carPosition, carRadius)) {
                    this.completeStage(now);
                }
            }
        }
    }

    completeStage(finishTime) {
        if (this.stageComplete) return;
        
        this.stageComplete = true;
        const stageTime = this.stageTime;
        const wasNewBest = !this.bestStageTime || stageTime < this.bestStageTime;
        
        // Update best time
        if (wasNewBest) {
            this.bestStageTime = stageTime;
        }
    }

    getProgress() {
        return {
            checkpoint: this.currentCheckpoint,
            total: this.track.checkpoints.length,
            stageTime: this.stageTime,
            bestStageTime: this.bestStageTime,
            stageComplete: this.stageComplete,
            hasStarted: this.hasPassedStartLine
        };
    }
}
