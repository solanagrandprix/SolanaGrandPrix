// Rally car physics with drift, traction, and surface handling
// All constants at the top for easy tuning

// === CAR PHYSICS CONSTANTS ===
// Inspired by pakastin/car and iForce2D concepts, simplified for non-Box2D implementation
export const CAR_CONFIG = {
    // Acceleration/Braking
    MAX_ACCELERATION: 1200,      // pixels/s²
    MAX_BRAKE_FORCE: 1800,       // pixels/s²
    FRICTION: 0.85,              // Base friction coefficient (longitudinal)
    
    // Steering
    MAX_STEER_ANGLE: 0.6,        // radians (~34 degrees)
    STEER_SPEED: 8.0,            // radians/s
    STEER_RESPONSE: 0.15,        // how quickly steering affects car direction (0-1)
    
    // Traction & Drift (pakastin/car-inspired model)
    MAX_TRACTION: 250,           // pixels/s (max speed with full grip)
    LATERAL_FRICTION: 0.95,      // lateral (sideways) friction coefficient (higher = more grip)
    SLIP_THRESHOLD: 0.12,        // slip angle (rad) before drift starts
    SLIP_FACTOR: 2.5,            // how slip angle affects lateral grip loss
    DRIFT_FACTOR: 0.35,          // how speed affects grip loss (0-1)
    GRIP_RECOVERY: 0.85,         // grip recovery rate when throttle released (0-1)
    
    // iForce2D-inspired traction model
    CORNER_STIFFNESS: 0.8,       // how quickly car turns (higher = sharper turns)
    LATERAL_VELOCITY_DAMPING: 0.92, // damping for sideways motion (0-1, higher = more grip)
    
    // Handbrake
    HANDBRAKE_FORCE: 0.5,        // multiplier for handbrake (0-1)
    HANDBRAKE_SLIP: 0.9,         // slip angle increase with handbrake
    HANDBRAKE_LATERAL_REDUCTION: 0.4, // reduce lateral grip with handbrake
    
    // Surfaces
    SURFACE_GRIP: {
        asphalt: 1.0,
        dirt: 0.65,
        grass: 0.3
    },
    SURFACE_LATERAL: {           // Lateral grip multipliers per surface
        asphalt: 1.0,
        dirt: 0.6,
        grass: 0.25
    },
    
    // Visual
    CAR_WIDTH: 20,
    CAR_HEIGHT: 35,
    TIRE_MARK_THRESHOLD: 0.15,   // slip angle to generate tire marks (lower = more marks)
    TIRE_MARK_INTENSITY_SCALE: 1.5 // how slip angle affects mark darkness
};

import { Vec2, clamp } from '../engine/math.js';

export class Car {
    constructor(x, y, angle = 0) {
        // Position & Rotation
        this.position = new Vec2(x, y);
        this.angle = angle;
        this.velocity = new Vec2(0, 0);
        this.angularVelocity = 0;
        
        // Physics state
        this.speed = 0;
        this.slipAngle = 0;
        this.currentGrip = CAR_CONFIG.MAX_TRACTION;
        this.surfaceType = 'asphalt';
        
        // Input state
        this.steerInput = 0;
        this.throttleInput = 0;
        this.brakeInput = 0;
        this.handbrakeInput = false;
        
        // Visual
        this.tireMarks = [];
        this.lastTireMarkTime = 0;
    }

    update(input, deltaTime, track) {
        // Get surface type at position
        this.surfaceType = track ? track.getSurfaceType(this.position) : 'asphalt';
        
        // Update inputs
        this.steerInput = clamp(input.steer, -1, 1);
        this.throttleInput = clamp(input.throttle, 0, 1);
        this.brakeInput = clamp(input.brake, 0, 1);
        this.handbrakeInput = input.handbrake || false;
        
        // Calculate grip based on surface
        const surfaceGrip = CAR_CONFIG.SURFACE_GRIP[this.surfaceType] || CAR_CONFIG.SURFACE_GRIP.asphalt;
        
        // Calculate slip angle (angle between velocity and car direction)
        // pakastin/car-inspired calculation
        if (this.speed > 5) {
            const velocityAngle = Math.atan2(this.velocity.y, this.velocity.x);
            this.slipAngle = this.normalizeAngle(velocityAngle - this.angle);
            
            // Clamp slip angle to valid range (-PI/2 to PI/2)
            if (Math.abs(this.slipAngle) > Math.PI / 2) {
                this.slipAngle = Math.sign(this.slipAngle) * (Math.PI - Math.abs(this.slipAngle));
            }
        } else {
            this.slipAngle = 0;
        }
        
        // iForce2D-inspired lateral friction calculation
        const surfaceLateralGrip = CAR_CONFIG.SURFACE_LATERAL[this.surfaceType] || CAR_CONFIG.SURFACE_LATERAL.asphalt;
        const baseLateralFriction = CAR_CONFIG.LATERAL_FRICTION * surfaceLateralGrip;
        
        // Calculate effective lateral grip based on slip angle (pakastin/car model)
        const absSlip = Math.abs(this.slipAngle);
        let lateralGripMultiplier = 1.0;
        
        if (absSlip > CAR_CONFIG.SLIP_THRESHOLD) {
            // Lateral grip decreases exponentially with slip angle
            const slipExcess = absSlip - CAR_CONFIG.SLIP_THRESHOLD;
            const slipRatio = Math.min(slipExcess / (Math.PI / 4), 1.0); // Normalize to max slip
            lateralGripMultiplier = 1.0 - (Math.pow(slipRatio, CAR_CONFIG.SLIP_FACTOR) * 0.85);
        }
        
        // Speed-based grip loss (faster = less grip when drifting)
        const speedFactor = Math.min(this.speed / CAR_CONFIG.MAX_TRACTION, 1);
        const speedGripLoss = 1.0 - (CAR_CONFIG.DRIFT_FACTOR * speedFactor * (1 - lateralGripMultiplier));
        
        // Handbrake reduces lateral grip significantly
        if (this.handbrakeInput) {
            lateralGripMultiplier *= CAR_CONFIG.HANDBRAKE_LATERAL_REDUCTION;
            this.slipAngle *= (1 + CAR_CONFIG.HANDBRAKE_SLIP * (1 - lateralGripMultiplier));
        }
        
        // Calculate effective lateral friction
        const effectiveLateralFriction = baseLateralFriction * lateralGripMultiplier * speedGripLoss;
        
        // Grip recovery when throttle released
        const gripRecovery = this.throttleInput < 0.3 ? CAR_CONFIG.GRIP_RECOVERY : 1.0;
        this.currentGrip = CAR_CONFIG.MAX_TRACTION * surfaceGrip * lateralGripMultiplier * speedGripLoss * gripRecovery;
        
        // Limit speed by grip
        const maxSpeed = this.currentGrip;
        
        // Steering (progressive based on speed and grip) - iForce2D-inspired corner stiffness
        const steerReduction = Math.max(0.25, 1 - (this.speed / maxSpeed) * 0.75);
        const targetSteerAngle = this.steerInput * CAR_CONFIG.MAX_STEER_ANGLE * steerReduction * CAR_CONFIG.CORNER_STIFFNESS;
        const currentSteerAngle = this.angularVelocity / Math.max(this.speed, 10) * deltaTime;
        const steerDelta = this.normalizeAngle(targetSteerAngle - currentSteerAngle);
        this.angularVelocity += steerDelta * CAR_CONFIG.STEER_SPEED * deltaTime * CAR_CONFIG.STEER_RESPONSE;
        
        // Acceleration (longitudinal force)
        let acceleration = 0;
        if (this.throttleInput > 0) {
            acceleration = CAR_CONFIG.MAX_ACCELERATION * this.throttleInput * surfaceGrip;
        }
        
        // Braking
        if (this.brakeInput > 0) {
            const brakeForce = CAR_CONFIG.MAX_BRAKE_FORCE * this.brakeInput * surfaceGrip;
            acceleration -= brakeForce * Math.sign(this.speed);
        }
        
        // Handbrake (longitudinal braking + lateral grip reduction already applied above)
        if (this.handbrakeInput) {
            const hbForce = CAR_CONFIG.MAX_BRAKE_FORCE * CAR_CONFIG.HANDBRAKE_FORCE * surfaceGrip;
            acceleration -= hbForce * Math.sign(this.speed);
        }
        
        // Apply longitudinal acceleration (forward/backward)
        const forward = new Vec2(Math.cos(this.angle), Math.sin(this.angle));
        this.velocity = this.velocity.add(forward.mul(acceleration * deltaTime));
        
        // Apply longitudinal friction
        const longitudinalFriction = CAR_CONFIG.FRICTION * surfaceGrip;
        const forwardVel = this.velocity.dot(forward);
        const forwardVec = forward.mul(forwardVel);
        const lateralVel = this.velocity.sub(forwardVec);
        
        // Apply longitudinal friction
        this.velocity = this.velocity.sub(forwardVec.mul(longitudinalFriction * deltaTime));
        
        // Apply lateral friction (iForce2D-inspired lateral velocity damping)
        // This is what creates the drift feel - lateral velocity is damped based on grip
        const lateralFriction = effectiveLateralFriction * CAR_CONFIG.LATERAL_VELOCITY_DAMPING;
        this.velocity = this.velocity.sub(lateralVel.mul((1 - lateralFriction) * deltaTime * 10));
        
        // Limit speed
        this.speed = this.velocity.length();
        if (this.speed > maxSpeed) {
            this.velocity = this.velocity.normalize().mul(maxSpeed);
            this.speed = maxSpeed;
        }
        
        // Update position
        this.position = this.position.add(this.velocity.mul(deltaTime));
        
        // Update rotation based on angular velocity and slip
        // pakastin/car-inspired: rotation affected by slip angle
        const slipRotationFactor = 1.0 + (Math.abs(this.slipAngle) * 0.3); // More slip = more rotation
        this.angle += this.angularVelocity * deltaTime * slipRotationFactor;
        this.angle = this.normalizeAngle(this.angle);
        
        // Angular velocity decay (faster decay when not steering)
        const steerDecay = Math.abs(this.steerInput) > 0.1 ? 0.98 : 0.94;
        this.angularVelocity *= steerDecay;
        
        // Generate tire marks when drifting (based on slip angle intensity)
        if (Math.abs(this.slipAngle) > CAR_CONFIG.TIRE_MARK_THRESHOLD && this.speed > 30) {
            const now = Date.now();
            if (now - this.lastTireMarkTime > 40) { // Every 40ms for smoother marks
                const slipIntensity = Math.min(Math.abs(this.slipAngle) / (Math.PI / 3), 1.0);
                const speedIntensity = Math.min(this.speed / CAR_CONFIG.MAX_TRACTION, 1.0);
                const markIntensity = (slipIntensity * 0.7 + speedIntensity * 0.3) * CAR_CONFIG.TIRE_MARK_INTENSITY_SCALE;
                
                this.tireMarks.push({
                    position: this.position.copy(),
                    angle: this.angle,
                    slipAngle: this.slipAngle,
                    intensity: Math.min(markIntensity, 1.0), // 0-1 for mark darkness
                    lifetime: 4000, // 4 seconds
                    timestamp: now,
                    createdAt: now,
                    previousPosition: this.tireMarks.length > 0 ? this.tireMarks[this.tireMarks.length - 1].position : null
                });
                this.lastTireMarkTime = now;
            }
        }
        
        // Remove old tire marks (handled by particle system now)
    }

    // Check collision with track boundaries
    checkBoundaryCollision(track) {
        if (!track) return false;
        
        const carRadius = Math.max(CAR_CONFIG.CAR_WIDTH, CAR_CONFIG.CAR_HEIGHT) / 2;
        const oldPosition = this.position.copy();
        const collision = track.checkCollision(this.position, carRadius);
        
        if (collision.hit) {
            // Calculate normal from old position to new position (before moving)
            const normal = collision.newPosition.sub(oldPosition);
            
            // Push car back to valid position
            this.position = collision.newPosition;
            
            if (normal.length() > 0.1) {
                const normalNorm = normal.normalize();
                
                // Reduce speed significantly on collision
                this.velocity = this.velocity.mul(0.3);
                
                // Reflect velocity off the wall (bounce effect)
                const dot = this.velocity.dot(normalNorm);
                if (dot < 0) {
                    this.velocity = this.velocity.sub(normalNorm.mul(dot * 1.5));
                }
                
                this.speed = this.velocity.length();
            } else {
                // Just reduce speed if we can't calculate normal
                this.velocity = this.velocity.mul(0.3);
                this.speed = this.velocity.length();
            }
            
            return true;
        }
        
        return false;
    }

    // Reset to checkpoint
    resetToCheckpoint(checkpointPosition, checkpointAngle) {
        this.position = checkpointPosition.copy();
        this.angle = checkpointAngle;
        this.velocity = new Vec2(0, 0);
        this.angularVelocity = 0;
        this.speed = 0;
        this.slipAngle = 0;
    }

    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    getBoundingCircle() {
        const radius = Math.max(CAR_CONFIG.CAR_WIDTH, CAR_CONFIG.CAR_HEIGHT) / 2;
        return {
            center: this.position,
            radius: radius
        };
    }
}
