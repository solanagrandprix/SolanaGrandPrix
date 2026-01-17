// Leaderboard management with name entry modal

import { StorageManager } from '../engine/storage.js';

export class LeaderboardManager {
    constructor() {
        this.setupNameModal();
    }

    setupNameModal() {
        const nameModal = document.getElementById('name-modal');
        const nameInput = document.getElementById('player-name-input');
        const btnSubmitName = document.getElementById('btn-submit-name');

        if (btnSubmitName && nameInput) {
            btnSubmitName.addEventListener('click', () => {
                const name = nameInput.value.trim() || 'Player';
                if (this.onSubmitName) {
                    this.onSubmitName(name);
                }
                this.hideNameModal();
            });

            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    btnSubmitName.click();
                }
            });
        }
    }

    showNameModal(onSubmit) {
        this.onSubmitName = onSubmit;
        const nameModal = document.getElementById('name-modal');
        const nameInput = document.getElementById('player-name-input');
        if (nameModal) nameModal.classList.remove('hidden');
        if (nameInput) {
            nameInput.value = 'Lemon93';
            nameInput.focus();
            nameInput.select();
        }
    }

    hideNameModal() {
        const nameModal = document.getElementById('name-modal');
        if (nameModal) nameModal.classList.add('hidden');
    }

    // Check if time qualifies for leaderboard and show modal if needed
    checkAndSaveTime(trackName, lapTime) {
        if (StorageManager.qualifiesForLeaderboard(trackName, lapTime)) {
            this.showNameModal((name) => {
                StorageManager.addLeaderboardEntry(trackName, name, lapTime);
            });
            return true;
        }
        return false;
    }
}
