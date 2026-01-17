// Main entry point for Solana Grand Prix Rally Arcade

import { InputManager } from './engine/input.js';
import { MenuManager } from './ui/menu.js';
import { Game } from './engine/game.js';
// Audio disabled
// import { AudioManager } from './engine/audio.js';

let game = null;
let inputManager = null;
let menuManager = null;
// let audioManager = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    // Initialize systems
    inputManager = new InputManager();
    // Audio disabled
    // audioManager = new AudioManager();

    // Initialize menu manager
    menuManager = new MenuManager(
        (trackName) => startGame(trackName, false),
        (trackName) => startGame(trackName, true),
        (trackName, isTimeTrial) => startGame(trackName, isTimeTrial),
        () => menuManager.showControlsScreen(),
        () => menuManager.showLeaderboardScreen()
    );

    // Initialize game
    game = new Game(canvas, inputManager, menuManager);

    // Setup menu button
    setupMenuButton();

    // Show main menu
    menuManager.showMainMenu();

    // Audio disabled
    // Setup audio context on user interaction (required by browsers)
    // document.addEventListener('click', () => {
    //     if (audioManager && audioManager.audioContext && audioManager.audioContext.state === 'suspended') {
    //         audioManager.audioContext.resume();
    //     }
    // }, { once: true });
});

function setupMenuButton() {
    const menuButton = document.getElementById('menu-button');
    if (!menuButton) return;

    // Show/hide menu button based on game state
    const updateMenuButtonVisibility = () => {
        const hud = document.getElementById('game-hud');
        if (hud && !hud.classList.contains('hidden') && game && game.isRunning) {
            menuButton.classList.remove('hidden');
        } else {
            menuButton.classList.add('hidden');
        }
    };

    // Check periodically
    const visibilityInterval = setInterval(updateMenuButtonVisibility, 100);

    // Menu button click handler - pause/unpause game
    menuButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (game && game.isRunning && !game.isPaused) {
            game.pause();
        }
    });
    
    // Also handle touch events for mobile
    menuButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (game && game.isRunning && !game.isPaused) {
            game.pause();
        }
    }, { passive: false });

    // Cleanup interval when page unloads
    window.addEventListener('beforeunload', () => {
        clearInterval(visibilityInterval);
    });
}

async function startGame(trackName, isTimeTrialMode) {
    if (!game) return;
    
    menuManager.hideAll();
    await game.start(trackName, isTimeTrialMode);
}

// Export for debugging
window.game = game;
window.inputManager = inputManager;
window.menuManager = menuManager;
