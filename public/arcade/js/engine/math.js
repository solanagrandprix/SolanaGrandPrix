// Math utilities for 2D vector operations and collision detection

export class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        return new Vec2(this.x + v.x, this.y + v.y);
    }

    sub(v) {
        return new Vec2(this.x - v.x, this.y - v.y);
    }

    mul(s) {
        return new Vec2(this.x * s, this.y * s);
    }

    div(s) {
        return new Vec2(this.x / s, this.y / s);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    lengthSq() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const len = this.length();
        if (len > 0) {
            return new Vec2(this.x / len, this.y / len);
        }
        return new Vec2(0, 0);
    }

    rotate(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return new Vec2(
            this.x * c - this.y * s,
            this.x * s + this.y * c
        );
    }

    copy() {
        return new Vec2(this.x, this.y);
    }

    set(x, y) {
        this.x = x;
        this.y = y;
    }

    clamp(maxLength) {
        const len = this.length();
        if (len > maxLength) {
            return this.normalize().mul(maxLength);
        }
        return this.copy();
    }
}

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function degToRad(deg) {
    return deg * Math.PI / 180;
}

export function radToDeg(rad) {
    return rad * 180 / Math.PI;
}

export function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

// Point to line segment distance
export function pointToSegmentDistance(p, a, b) {
    const ab = b.sub(a);
    const ap = p.sub(a);
    const abLenSq = ab.lengthSq();
    
    if (abLenSq < 0.0001) {
        return distance(p, a);
    }
    
    const t = clamp(ap.dot(ab) / abLenSq, 0, 1);
    const closest = a.add(ab.mul(t));
    return distance(p, closest);
}

// Check if point is inside axis-aligned rectangle
export function pointInRect(point, rect) {
    return point.x >= rect.x &&
           point.x <= rect.x + rect.width &&
           point.y >= rect.y &&
           point.y <= rect.y + rect.height;
}

// Check if circle intersects rectangle
export function circleRectIntersect(center, radius, rect) {
    const closestX = clamp(center.x, rect.x, rect.x + rect.width);
    const closestY = clamp(center.y, rect.y, rect.y + rect.height);
    const dx = center.x - closestX;
    const dy = center.y - closestY;
    return (dx * dx + dy * dy) < (radius * radius);
}

// Check if circle intersects line segment
export function circleLineIntersect(center, radius, a, b) {
    return pointToSegmentDistance(center, a, b) < radius;
}
