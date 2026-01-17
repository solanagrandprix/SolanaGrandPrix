// Particle system for tire marks and visual effects
// Based on StackOverflow approach: progressive fade-out per segment
// Reference: https://stackoverflow.com/questions/37776626/drift-marks-in-a-top-down-car-game

import { Vec2 } from '../engine/math.js';

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.tireMarkSegments = []; // Store segments for progressive fade
    }

    addTireMark(position, angle, slipAngle, intensity = 1.0, previousPosition = null) {
        const now = Date.now();
        const segment = {
            type: 'tire',
            position: position.copy(),
            previousPosition: previousPosition ? previousPosition.copy() : position.copy(),
            angle: angle,
            slipAngle: slipAngle,
            intensity: Math.min(intensity, 1.0), // 0-1 darkness/intensity
            lifetime: 4000, // 4 seconds
            createdAt: now,
            alpha: 0.9 * intensity // Initial alpha based on intensity
        };
        
        this.tireMarkSegments.push(segment);
        
        // Keep segments connected for continuous lines (StackOverflow approach)
        if (this.tireMarkSegments.length > 1) {
            const prev = this.tireMarkSegments[this.tireMarkSegments.length - 2];
            segment.previousPosition = prev.position.copy();
        }
    }

    update(deltaTime) {
        const now = Date.now();
        
        // Progressive fade-out per segment (StackOverflow technique)
        // Each segment fades from full to transparent over its lifetime
        this.tireMarkSegments = this.tireMarkSegments.filter(segment => {
            const age = now - segment.createdAt;
            if (age > segment.lifetime) {
                return false;
            }
            
            // Progressive fade: older segments fade faster (fade from beginning to end)
            // This creates the effect of the trail disappearing from the start
            const fadeProgress = age / segment.lifetime;
            
            // Use smooth fade curve (ease-out)
            const fadeCurve = 1 - Math.pow(fadeProgress, 2);
            
            // Base alpha on intensity, then fade over time
            segment.alpha = 0.9 * segment.intensity * fadeCurve;
            
            return true;
        });
    }

    render(ctx, camera, canvasWidth, canvasHeight) {
        ctx.save();
        
        // Draw tire marks as connected segments (StackOverflow approach)
        // Render oldest first so new ones appear on top
        for (let i = 0; i < this.tireMarkSegments.length; i++) {
            const segment = this.tireMarkSegments[i];
            
            if (segment.alpha <= 0) continue;
            
            // Use intensity to determine mark darkness
            const baseColor = segment.intensity > 0.7 ? '#333' : segment.intensity > 0.4 ? '#555' : '#777';
            
            ctx.globalAlpha = segment.alpha * 0.6; // Additional opacity multiplier
            ctx.strokeStyle = baseColor;
            
            // Line width based on intensity and slip
            const lineWidth = 1.5 + (segment.intensity * 2.5);
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Draw segment as line from previous position to current
            // If no previous position, draw a short line in the direction of travel
            ctx.beginPath();
            
            if (segment.previousPosition && 
                segment.previousPosition.sub(segment.position).length() > 1) {
                // Draw connected line segment
                ctx.moveTo(segment.previousPosition.x, segment.previousPosition.y);
                ctx.lineTo(segment.position.x, segment.position.y);
            } else {
                // Draw single point as small line segment
                const length = 8 + (segment.intensity * 6);
                const direction = segment.angle + segment.slipAngle;
                const offsetX = Math.cos(direction) * length;
                const offsetY = Math.sin(direction) * length;
                
                ctx.moveTo(segment.position.x - offsetX * 0.5, segment.position.y - offsetY * 0.5);
                ctx.lineTo(segment.position.x + offsetX * 0.5, segment.position.y + offsetY * 0.5);
            }
            
            ctx.stroke();
        }
        
        ctx.restore();
    }

    clear() {
        this.tireMarkSegments = [];
        this.particles = [];
    }
}
