/**
 * iRacing Session Sync
 * 
 * Syncs league and hosted practice sessions from iRacing Data API
 * Handles session data retrieval and normalization
 */

const { makeApiRequest, getUserInfo } = require('./iracing-oauth');

/**
 * Fetch recent sessions for a user
 * 
 * NOTE: Actual iRacing Data API endpoints may differ. 
 * Common endpoints:
 * - /data/member/recent_races?cust_id={custId}
 * - /data/member/recent_events?cust_id={custId}
 * - /data/results/search?subsession_id={subsessionId}
 * 
 * Adjust endpoints based on official iRacing Data API documentation.
 * 
 * @param {string} accessToken - OAuth access token
 * @param {number} custId - iRacing customer ID
 * @param {number} maxResults - Maximum number of results (default: 100)
 * @returns {Promise<Array>} Array of session data
 */
async function fetchUserSessions(accessToken, custId, maxResults = 100) {
  try {
    // Fetch recent race results
    // Adjust endpoint based on actual iRacing API documentation
    let raceResults = [];
    try {
      const response = await makeApiRequest('/member/recent_races', accessToken, {
        cust_id: custId,
        max_results: maxResults,
      });
      // Handle different response formats
      raceResults = Array.isArray(response) ? response : (response.data || response.results || []);
    } catch (err) {
      console.warn('Recent races not available:', err.message);
      // Try alternative endpoint
      try {
        const altResponse = await makeApiRequest('/member/recent_events', accessToken, {
          cust_id: custId,
        });
        raceResults = Array.isArray(altResponse) ? altResponse : (altResponse.data || []);
      } catch (altErr) {
        console.warn('Alternative endpoint also failed:', altErr.message);
      }
    }

    // Fetch league sessions if available
    // NOTE: League session endpoint structure may vary
    let leagueSessions = [];
    try {
      const leagueData = await makeApiRequest('/league/sessions', accessToken, {
        cust_id: custId,
        max_results: maxResults,
      });
      leagueSessions = Array.isArray(leagueData) ? leagueData : (leagueData.data || leagueData.results || []);
    } catch (err) {
      // League sessions may not be available for all users or may use different endpoint
      console.warn('League sessions not available:', err.message);
    }

    // Fetch hosted sessions if available
    // NOTE: Hosted session endpoint structure may vary
    let hostedSessions = [];
    try {
      const hostedData = await makeApiRequest('/hosted/sessions', accessToken, {
        cust_id: custId,
        max_results: maxResults,
      });
      hostedSessions = Array.isArray(hostedData) ? hostedData : (hostedData.data || hostedData.results || []);
    } catch (err) {
      // Hosted sessions may not be available for all users or may use different endpoint
      console.warn('Hosted sessions not available:', err.message);
    }

    // Combine and normalize sessions
    const allSessions = [
      ...(raceResults || []).map(s => ({ ...s, source: 'race' })),
      ...leagueSessions.map(s => ({ ...s, source: 'league' })),
      ...hostedSessions.map(s => ({ ...s, source: 'hosted' })),
    ];

    return allSessions;
  } catch (error) {
    throw new Error(`Failed to fetch user sessions: ${error.message}`);
  }
}

/**
 * Get detailed session results including participants
 * 
 * NOTE: Actual iRacing Data API endpoint may be:
 * - /data/results/get?subsession_id={subsessionId}
 * - /data/results/search?subsession_id={subsessionId}
 * 
 * Adjust endpoint and response parsing based on official API documentation.
 * 
 * @param {string} accessToken - OAuth access token
 * @param {string} sessionId - iRacing session ID
 * @param {number} subSessionId - Sub-session ID (optional, for multi-session races)
 * @returns {Promise<Object>} Detailed session data with participants
 */
async function getSessionResults(accessToken, sessionId, subSessionId = null) {
  try {
    const sessionIdToUse = subSessionId || sessionId;
    const params = { subsession_id: sessionIdToUse };
    
    // Try primary endpoint
    let response;
    try {
      response = await makeApiRequest('/results/get', accessToken, params);
    } catch (err) {
      // Try alternative endpoint
      try {
        response = await makeApiRequest('/results/search', accessToken, params);
      } catch (altErr) {
        throw new Error(`Both endpoints failed: ${err.message}, ${altErr.message}`);
      }
    }
    
    // Handle different response formats
    // Some APIs wrap data in a 'data' or 'results' field
    const sessionData = response.data || response.results?.[0] || response;
    
    // Parse participants - structure may vary
    let participants = [];
    if (sessionData.session_results && Array.isArray(sessionData.session_results)) {
      participants = sessionData.session_results;
    } else if (sessionData.results && Array.isArray(sessionData.results)) {
      participants = sessionData.results;
    } else if (Array.isArray(sessionData)) {
      participants = sessionData;
    }
    
    return {
      sessionId: sessionData.subsession_id || sessionIdToUse,
      sessionType: sessionData.session_type || sessionData.type || 'unknown',
      trackName: sessionData.track?.track_name || sessionData.track_name || 'Unknown Track',
      carName: sessionData.car_name || sessionData.car?.car_name || 'Unknown Car',
      startTime: sessionData.session_start_time || sessionData.start_time 
        ? new Date(sessionData.session_start_time || sessionData.start_time) 
        : new Date(),
      leagueId: sessionData.league_id || null,
      leagueName: sessionData.league_name || null,
      participants: participants.map((result, index) => ({
        custId: result.cust_id || result.customer_id,
        displayName: result.display_name || result.name || 'Unknown',
        lapsCompleted: result.laps_complete || result.laps_completed || 0,
        bestLapTime: result.best_lap_time 
          ? (typeof result.best_lap_time === 'number' ? result.best_lap_time / 1000 : parseFloat(result.best_lap_time))
          : null, // Convert ms to seconds if needed
        incidents: result.incidents || result.incident_count || 0,
        finishPosition: result.finish_position || result.position || (index + 1),
        startingPosition: result.start_position || result.starting_position || null,
        totalLaps: result.laps || result.total_laps || null,
      })),
      subSessionId: sessionData.subsession_id || null,
      seasonId: sessionData.season_id || null,
    };
  } catch (error) {
    throw new Error(`Failed to get session results: ${error.message}`);
  }
}

/**
 * Normalize session data for database storage
 * @param {Object} sessionData - Raw session data from API
 * @returns {Object} Normalized session data
 */
function normalizeSession(sessionData) {
  return {
    sessionId: String(sessionData.sessionId || sessionData.subsession_id),
    sessionType: mapSessionType(sessionData.sessionType || sessionData.source || 'practice'),
    leagueId: sessionData.leagueId || sessionData.league_id || null,
    leagueName: sessionData.leagueName || sessionData.league_name || null,
    trackName: sessionData.trackName || sessionData.track?.track_name || 'Unknown Track',
    carName: sessionData.carName || sessionData.car_name || 'Unknown Car',
    startTime: sessionData.startTime ? new Date(sessionData.startTime) : new Date(),
    subSessionId: sessionData.subSessionId || sessionData.subsession_id || null,
    seasonId: sessionData.seasonId || sessionData.season_id || null,
  };
}

/**
 * Map session type from API to normalized format
 * @param {string} sessionType - Raw session type from API
 * @returns {string} Normalized session type (practice, race, qualifying)
 */
function mapSessionType(sessionType) {
  const normalized = (sessionType || '').toLowerCase();
  
  if (normalized.includes('practice')) {
    return 'practice';
  } else if (normalized.includes('qualif') || normalized.includes('qualify')) {
    return 'qualifying';
  } else if (normalized.includes('race')) {
    return 'race';
  }
  
  return 'practice'; // Default to practice
}

/**
 * Normalize participant data for database storage
 * 
 * PRIVACY: displayName is the iRacing username/display name (chosen by user), NOT their real name.
 * This is stored for session results but is only displayed to the session owner, not publicly.
 * 
 * @param {Object} participantData - Raw participant data from API
 * @returns {Object} Normalized participant data
 */
function normalizeParticipant(participantData) {
  return {
    custId: participantData.custId || participantData.cust_id,
    // displayName is iRacing username/display name (user-chosen), NOT real name
    displayName: participantData.displayName || participantData.display_name || 'Unknown',
    lapsCompleted: participantData.lapsCompleted || participantData.laps_complete || 0,
    bestLapTime: participantData.bestLapTime !== undefined 
      ? participantData.bestLapTime 
      : (participantData.best_lap_time ? participantData.best_lap_time / 1000 : null),
    incidents: participantData.incidents || 0,
    finishPosition: participantData.finishPosition || participantData.finish_position || null,
    startingPosition: participantData.startingPosition || participantData.start_position || null,
    totalLaps: participantData.totalLaps || participantData.laps || null,
  };
}

module.exports = {
  fetchUserSessions,
  getSessionResults,
  normalizeSession,
  normalizeParticipant,
};
