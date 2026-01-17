// Track system with boundaries, surfaces, and checkpoint detection

import { Vec2, pointToSegmentDistance, circleRectIntersect } from '../engine/math.js';

export class Track {
    constructor(data) {
        this.name = data.name || 'Unnamed Track';
        this.outerBoundary = data.outerBoundary || []; // Array of Vec2
        this.innerBoundary = data.innerBoundary || []; // Array of Vec2
        this.startLine = data.startLine || { x: 0, y: 0, angle: 0, width: 100 };
        this.finishLine = data.finishLine || null; // { x, y, angle, width }
        this.checkpoints = data.checkpoints || []; // Array of {x, y, width, height}
        this.surfaces = data.surfaces || []; // Array of {type: 'asphalt'|'dirt'|'grass', poly: Vec2[]}
        
        // Convert checkpoints to Vec2 for convenience
        this.checkpointRects = this.checkpoints.map(cp => ({
            x: cp.x,
            y: cp.y,
            width: cp.width || 50,
            height: cp.height || 50
        }));
    }

    // Check if point is inside track (between inner and outer boundaries)
    isInsideTrack(point) {
        // For simplicity, check if point is inside outer boundary and outside inner boundary
        // Using winding number algorithm
        const insideOuter = this.isPointInPolygon(point, this.outerBoundary);
        const insideInner = this.isPointInPolygon(point, this.innerBoundary);
        return insideOuter && !insideInner;
    }

    // Check collision with boundaries
    checkCollision(position, radius) {
        let minDist = Infinity;
        let closestPoint = position.copy();
        let hit = false;

        // Check outer boundary - car should stay inside
        for (let i = 0; i < this.outerBoundary.length; i++) {
            const a = this.outerBoundary[i];
            const b = this.outerBoundary[(i + 1) % this.outerBoundary.length];
            const dist = pointToSegmentDistance(position, a, b);
            
            if (dist < radius) {
                // Find closest point on segment
                const segment = b.sub(a);
                const segmentLenSq = segment.lengthSq();
                if (segmentLenSq < 0.0001) continue; // Skip zero-length segments
                
                const toPoint = position.sub(a);
                const t = Math.max(0, Math.min(1, toPoint.dot(segment) / segmentLenSq));
                const closestOnSegment = a.add(segment.mul(t));
                
                // Calculate normal pointing inward (away from boundary)
                const toCar = position.sub(closestOnSegment);
                const distToCar = toCar.length();
                let pushNormal;
                
                if (distToCar < 0.0001) {
                    // Car is exactly on the line, use perpendicular to segment pointing inward
                    const perp = new Vec2(-segment.y, segment.x);
                    pushNormal = perp.length() > 0.0001 ? perp.normalize() : new Vec2(1, 0);
                } else {
                    pushNormal = toCar.normalize();
                }
                
                // Push car inside by radius + margin
                const pushDistance = radius - distToCar + 15;
                closestPoint = closestOnSegment.add(pushNormal.mul(pushDistance));
                hit = true;
                minDist = Math.min(minDist, dist);
                break; // Use first collision
            }
        }

        // Check inner boundary - car should stay outside
        if (!hit) {
            for (let i = 0; i < this.innerBoundary.length; i++) {
                const a = this.innerBoundary[i];
                const b = this.innerBoundary[(i + 1) % this.innerBoundary.length];
                const dist = pointToSegmentDistance(position, a, b);
                
                if (dist < radius) {
                    // Find closest point on segment
                    const segment = b.sub(a);
                    const segmentLenSq = segment.lengthSq();
                    if (segmentLenSq < 0.0001) continue;
                    
                    const toPoint = position.sub(a);
                    const t = Math.max(0, Math.min(1, toPoint.dot(segment) / segmentLenSq));
                    const closestOnSegment = a.add(segment.mul(t));
                    
                    // Calculate normal pointing outward (away from inner boundary)
                    const toCar = position.sub(closestOnSegment);
                    const distToCar = toCar.length();
                    let pushNormal;
                    
                    if (distToCar < 0.0001) {
                        const perp = new Vec2(segment.y, -segment.x);
                        pushNormal = perp.length() > 0.0001 ? perp.normalize() : new Vec2(1, 0);
                    } else {
                        pushNormal = toCar.normalize().mul(-1); // Reverse to push outward
                    }
                    
                    // Push car outside by radius + margin
                    const pushDistance = radius - distToCar + 15;
                    closestPoint = closestOnSegment.add(pushNormal.mul(pushDistance));
                    hit = true;
                    minDist = Math.min(minDist, dist);
                    break;
                }
            }
        }

        return { hit, newPosition: closestPoint, distance: minDist };
    }

    // Get surface type at position
    getSurfaceType(position) {
        // Check if position is in any surface polygon
        for (const surface of this.surfaces) {
            if (this.isPointInPolygon(position, surface.poly)) {
                return surface.type;
            }
        }
        // Default to asphalt
        return 'asphalt';
    }

    // Check if checkpoint is passed
    checkCheckpoint(position, radius, checkpointIndex) {
        if (checkpointIndex < 0 || checkpointIndex >= this.checkpointRects.length) {
            return false;
        }
        
        const cp = this.checkpointRects[checkpointIndex];
        return circleRectIntersect(position, radius, cp);
    }

    // Winding number algorithm for point-in-polygon
    isPointInPolygon(point, polygon) {
        if (polygon.length < 3) return false;
        
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            
            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                             (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Get track bounds for camera/minimap
    getBounds() {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        const allPoints = [...this.outerBoundary, ...this.innerBoundary];
        for (const point of allPoints) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }

        return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }
}
