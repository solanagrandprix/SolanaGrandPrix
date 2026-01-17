// Menu system

import { getTrackNames } from '../world/tracks.js';
import { StorageManager } from '../engine/storage.js';

export class MenuManager {
    constructor(onPlay, onTimeTrial, onSelectTrack, onShowControls, onShowLeaderboard) {
        this.onPlay = onPlay;
        this.onTimeTrial = onTimeTrial;
        this.onSelectTrack = onSelectTrack;
        this.onShowControls = onShowControls;
        this.onShowLeaderboard = onShowLeaderboard;
        this.isTimeTrialMode = false;
        this.selectedTrack = null;
        this.gameInstance = null; // Will be set by Game class

        this.setupMenu();
    }

    setGameInstance(game) {
        this.gameInstance = game;
    }

    setupMenu() {
        // Main menu buttons
        const btnPlay = document.getElementById('btn-play');
        const btnTimeTrial = document.getElementById('btn-time-trial');
        const btnLeaderboard = document.getElementById('btn-leaderboard');
        const btnControls = document.getElementById('btn-controls');
        const ghostToggle = document.getElementById('ghost-toggle');

        if (btnPlay) {
            btnPlay.addEventListener('click', () => {
                this.isTimeTrialMode = false;
                this.showTrackSelection();
            });
        }

        if (btnTimeTrial) {
            btnTimeTrial.addEventListener('click', () => {
                this.isTimeTrialMode = true;
                this.showTrackSelection();
            });
        }

        if (btnLeaderboard) {
            btnLeaderboard.addEventListener('click', () => {
                if (this.onShowLeaderboard) {
                    this.onShowLeaderboard();
                }
            });
        }

        if (btnControls) {
            btnControls.addEventListener('click', () => {
                if (this.onShowControls) {
                    this.onShowControls();
                }
            });
        }

        // Track selection
        const btnBackFromTracks = document.getElementById('btn-back-from-tracks');
        if (btnBackFromTracks) {
            btnBackFromTracks.addEventListener('click', () => {
                this.hideTrackSelection();
                this.showMainMenu();
            });
        }

        // Controls screen
        const btnBackFromControls = document.getElementById('btn-back-from-controls');
        if (btnBackFromControls) {
            btnBackFromControls.addEventListener('click', () => {
                this.hideControlsScreen();
                this.showMainMenu();
            });
        }

        // Leaderboard screen
        const btnBackFromLeaderboard = document.getElementById('btn-back-from-leaderboard');
        if (btnBackFromLeaderboard) {
            btnBackFromLeaderboard.addEventListener('click', () => {
                this.hideLeaderboardScreen();
                this.showMainMenu();
            });
        }

        // Pause menu
        const btnResume = document.getElementById('btn-resume');
        const btnRestart = document.getElementById('btn-restart');
        const btnChangeTrack = document.getElementById('btn-change-track');
        const btnQuit = document.getElementById('btn-quit');

        if (btnResume) {
            btnResume.addEventListener('click', () => {
                if (this.gameInstance && this.gameInstance.isPaused) {
                    this.gameInstance.resume();
                }
                this.hidePauseMenu();
            });
        }

        if (btnRestart) {
            btnRestart.addEventListener('click', () => {
                this.hidePauseMenu();
                if (this.selectedTrack) {
                    this.onSelectTrack(this.selectedTrack, this.isTimeTrialMode);
                }
            });
        }

        if (btnChangeTrack) {
            btnChangeTrack.addEventListener('click', () => {
                this.hidePauseMenu();
                this.showTrackSelection();
            });
        }

        if (btnQuit) {
            btnQuit.addEventListener('click', () => {
                this.hidePauseMenu();
                this.showMainMenu();
            });
        }
    }

    showMainMenu() {
        this.hideAll();
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) mainMenu.classList.remove('hidden');
    }

    hideMainMenu() {
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) mainMenu.classList.add('hidden');
    }

    showTrackSelection() {
        this.hideAll();
        const trackMenu = document.getElementById('track-menu');
        if (trackMenu) trackMenu.classList.remove('hidden');

        // Populate track list
        const trackList = document.getElementById('track-list');
        if (trackList) {
            trackList.innerHTML = '';
            const tracks = getTrackNames();

            tracks.forEach(trackName => {
                const trackItem = document.createElement('div');
                trackItem.className = 'track-item';
                trackItem.textContent = trackName;

                // Show best time if available
                const bestTime = StorageManager.getBestLap(trackName);
                if (bestTime) {
                    const timeSpan = document.createElement('span');
                    timeSpan.style.float = 'right';
                    timeSpan.style.opacity = '0.7';
                    timeSpan.textContent = this.formatTime(bestTime);
                    trackItem.appendChild(timeSpan);
                }

                trackItem.addEventListener('click', () => {
                    // Remove previous selection
                    document.querySelectorAll('.track-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    trackItem.classList.add('selected');
                    this.selectedTrack = trackName;

                    // Start game after a short delay
                    setTimeout(() => {
                        if (this.isTimeTrialMode) {
                            if (this.onTimeTrial) {
                                this.onTimeTrial(trackName);
                            }
                        } else {
                            if (this.onPlay) {
                                this.onPlay(trackName);
                            }
                        }
                    }, 300);
                });

                trackList.appendChild(trackItem);
            });
        }
    }

    hideTrackSelection() {
        const trackMenu = document.getElementById('track-menu');
        if (trackMenu) trackMenu.classList.add('hidden');
    }

    showControlsScreen() {
        this.hideAll();
        const controlsScreen = document.getElementById('controls-screen');
        if (controlsScreen) controlsScreen.classList.remove('hidden');
    }

    hideControlsScreen() {
        const controlsScreen = document.getElementById('controls-screen');
        if (controlsScreen) controlsScreen.classList.add('hidden');
    }

    showLeaderboardScreen(trackName = null) {
        this.hideAll();
        const leaderboardScreen = document.getElementById('leaderboard-screen');
        if (leaderboardScreen) leaderboardScreen.classList.remove('hidden');

        // Populate leaderboard
        const leaderboardContent = document.getElementById('leaderboard-content');
        if (leaderboardContent) {
            if (!trackName) {
                // Show all tracks
                const tracks = getTrackNames();
                leaderboardContent.innerHTML = '';
                tracks.forEach(track => {
                    const trackTitle = document.createElement('h3');
                    trackTitle.textContent = track;
                    trackTitle.style.color = '#00ff41';
                    trackTitle.style.marginTop = '1rem';
                    leaderboardContent.appendChild(trackTitle);

                    const entries = StorageManager.getLeaderboard(track);
                    if (entries.length === 0) {
                        const empty = document.createElement('p');
                        empty.textContent = 'No times recorded';
                        empty.style.opacity = '0.5';
                        leaderboardContent.appendChild(empty);
                    } else {
                        entries.forEach((entry, index) => {
                            const entryEl = document.createElement('div');
                            entryEl.className = 'leaderboard-entry';
                            entryEl.innerHTML = `
                                <span class="leaderboard-rank">${index + 1}.</span>
                                <span class="leaderboard-name">${entry.name}</span>
                                <span class="leaderboard-time">${this.formatTime(entry.time)}</span>
                            `;
                            leaderboardContent.appendChild(entryEl);
                        });
                    }
                });
            }
        }
    }

    hideLeaderboardScreen() {
        const leaderboardScreen = document.getElementById('leaderboard-screen');
        if (leaderboardScreen) leaderboardScreen.classList.add('hidden');
    }

    showPauseMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) pauseMenu.classList.remove('hidden');
    }

    hidePauseMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) pauseMenu.classList.add('hidden');
    }

    hideAll() {
        this.hideMainMenu();
        this.hideTrackSelection();
        this.hideControlsScreen();
        this.hideLeaderboardScreen();
        this.hidePauseMenu();
    }

    isGhostEnabled() {
        const ghostToggle = document.getElementById('ghost-toggle');
        return ghostToggle ? ghostToggle.checked : false;
    }

    formatTime(seconds) {
        if (!seconds && seconds !== 0) return '--:--.--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
}
