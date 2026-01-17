// Track definitions - Rally stages with realistic layouts
// Simple, clean rally tracks with proper geometry

import { Vec2 } from '../engine/math.js';
import { Track } from './track.js';

function createVec2Array(points) {
    return points.map(p => new Vec2(p[0], p[1]));
}

export const TRACKS = {
    'Forest Pass': new Track({
        name: 'Forest Pass',
        // Outer boundary - winding forest rally road (16 points, closed loop)
        outerBoundary: createVec2Array([
            [100, 750], [400, 750],  // Start area (bottom)
            [650, 700], [750, 600],  // Long straight ascending
            [800, 450], [780, 280],  // Right sweep
            [700, 150], [550, 80],   // Hairpin approach
            [350, 100], [200, 200],  // Hairpin turn
            [150, 350], [180, 500],  // Hairpin exit
            [250, 620], [100, 680],  // Return to start
            [100, 750]               // Close loop
        ]),
        // Inner boundary - creates track width (16 points matching outer)
        innerBoundary: createVec2Array([
            [180, 720], [370, 720],  // Start area inner
            [600, 680], [680, 590],  // Straight inner
            [720, 460], [700, 310],  // Sweep inner
            [640, 200], [520, 140],  // Hairpin inner
            [380, 160], [260, 240],  // Hairpin inner
            [230, 380], [250, 520],  // Exit inner
            [310, 620], [180, 680],  // Return inner
            [180, 720]               // Close loop
        ]),
        startLine: { x: 250, y: 735, angle: 0, width: 100 },
        finishLine: { x: 170, y: 350, angle: Math.PI, width: 80 },
        checkpoints: [
            { x: 700, y: 550, width: 60, height: 60 },
            { x: 750, y: 400, width: 60, height: 60 },
            { x: 350, y: 150, width: 60, height: 60 },
            { x: 200, y: 280, width: 60, height: 60 },
            { x: 180, y: 450, width: 60, height: 60 }
        ],
        surfaces: [{
            type: 'asphalt',
            poly: createVec2Array([
                [180, 720], [370, 720], [600, 680], [680, 590],
                [720, 460], [700, 310], [640, 200], [520, 140],
                [380, 160], [260, 240], [230, 380], [250, 520],
                [310, 620], [180, 680], [180, 720]
            ])
        }]
    }),

    'Mountain Descent': new Track({
        name: 'Mountain Descent',
        // Outer boundary - downhill rally stage (14 points, closed loop)
        outerBoundary: createVec2Array([
            [350, 50], [500, 50],   // Start area (top)
            [650, 120], [750, 220], // Initial descent
            [800, 380], [780, 550], // Fast sweep
            [700, 680], [550, 750], // Final descent
            [400, 750], [250, 680], // Bottom section
            [150, 550], [100, 380], // Left turn
            [150, 220], [250, 120], // Return to top
            [350, 50]               // Close loop
        ]),
        // Inner boundary - creates track width (14 points matching outer)
        innerBoundary: createVec2Array([
            [400, 80], [500, 80],   // Start inner
            [620, 140], [700, 230], // Descent inner
            [740, 380], [720, 540], // Sweep inner
            [660, 660], [540, 720], // Final inner
            [410, 720], [280, 660], // Bottom inner
            [180, 540], [140, 380], // Left inner
            [180, 230], [280, 140], // Return inner
            [400, 80]               // Close loop
        ]),
        startLine: { x: 425, y: 65, angle: Math.PI / 2, width: 100 },
        finishLine: { x: 400, y: 560, angle: Math.PI / 2, width: 80 },
        checkpoints: [
            { x: 700, y: 180, width: 60, height: 60 },
            { x: 770, y: 350, width: 60, height: 60 },
            { x: 720, y: 520, width: 60, height: 60 },
            { x: 500, y: 720, width: 60, height: 60 },
            { x: 280, y: 620, width: 60, height: 60 },
            { x: 160, y: 460, width: 60, height: 60 }
        ],
        surfaces: [
            {
                type: 'dirt',
                poly: createVec2Array([
                    [400, 80], [500, 80], [620, 140], [700, 230],
                    [740, 380], [720, 540], [660, 660], [540, 720],
                    [410, 720], [280, 660], [180, 540], [140, 380],
                    [180, 230], [280, 140], [400, 80]
                ])
            },
            {
                type: 'asphalt',
                poly: createVec2Array([
                    [420, 100], [480, 100], [580, 150], [650, 240],
                    [720, 380], [700, 530], [640, 650], [530, 710],
                    [410, 710], [300, 650], [200, 530], [170, 380],
                    [200, 240], [300, 150], [420, 100]
                ])
            }
        ]
    })
};

// Get track by name
export function getTrack(name) {
    return TRACKS[name] || TRACKS['Forest Pass'];
}

// Get all track names
export function getTrackNames() {
    return Object.keys(TRACKS);
}
