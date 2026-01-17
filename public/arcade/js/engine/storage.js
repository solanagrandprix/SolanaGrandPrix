// LocalStorage wrapper for saving/loading game data

const STORAGE_PREFIX = 'solanaGP_rally_';

export class StorageManager {
    // Save best lap time for a track
    static saveBestLap(trackName, time) {
        const key = `${STORAGE_PREFIX}best_${trackName}`;
        localStorage.setItem(key, time.toString());
    }

    // Get best lap time for a track
    static getBestLap(trackName) {
        const key = `${STORAGE_PREFIX}best_${trackName}`;
        const value = localStorage.getItem(key);
        return value ? parseFloat(value) : null;
    }

    // Save ghost data for a track
    static saveGhostData(trackName, ghostData) {
        const key = `${STORAGE_PREFIX}ghost_${trackName}`;
        localStorage.setItem(key, JSON.stringify(ghostData));
    }

    // Get ghost data for a track
    static getGhostData(trackName) {
        const key = `${STORAGE_PREFIX}ghost_${trackName}`;
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    }

    // Add entry to leaderboard (top 10)
    static addLeaderboardEntry(trackName, name, time) {
        const key = `${STORAGE_PREFIX}leaderboard_${trackName}`;
        let leaderboard = this.getLeaderboard(trackName);
        
        // Add new entry
        leaderboard.push({ name, time, date: Date.now() });
        
        // Sort by time (ascending)
        leaderboard.sort((a, b) => a.time - b.time);
        
        // Keep only top 10
        leaderboard = leaderboard.slice(0, 10);
        
        localStorage.setItem(key, JSON.stringify(leaderboard));
    }

    // Get leaderboard for a track
    static getLeaderboard(trackName) {
        const key = `${STORAGE_PREFIX}leaderboard_${trackName}`;
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : [];
    }

    // Check if time qualifies for leaderboard (top 10 or better than worst)
    static qualifiesForLeaderboard(trackName, time) {
        const leaderboard = this.getLeaderboard(trackName);
        if (leaderboard.length < 10) {
            return true;
        }
        const worstTime = leaderboard[leaderboard.length - 1].time;
        return time < worstTime;
    }
}
