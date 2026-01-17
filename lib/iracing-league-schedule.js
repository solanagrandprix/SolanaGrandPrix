/**
 * iRacing League Schedule Sync
 * 
 * Fetches league season schedule from iRacing Data API
 * Maps league sessions to calendar events
 */

const { makeApiRequest } = require('./iracing-oauth');

/**
 * Get league details
 * @param {string} accessToken - OAuth access token
 * @param {number} leagueId - iRacing league ID
 * @returns {Promise<Object>} League details
 */
async function getLeagueDetails(accessToken, leagueId) {
  try {
    const response = await makeApiRequest('/data/league/get', accessToken, {
      league_id: leagueId,
      include_licenses: false,
    });
    
    // Handle different response formats
    const leagueData = response.data || response;
    
    return {
      leagueId: leagueData.league_id || leagueId,
      leagueName: leagueData.league_name || 'Unknown League',
      ownerId: leagueData.owner_id || null,
      createdDate: leagueData.created_date || null,
      url: leagueData.url || null,
      rosterCount: leagueData.roster_count || 0,
    };
  } catch (error) {
    throw new Error(`Failed to get league details: ${error.message}`);
  }
}

/**
 * Get seasons for a league
 * @param {string} accessToken - OAuth access token
 * @param {number} leagueId - iRacing league ID
 * @param {boolean} includeRetired - Include retired seasons (default: false)
 * @returns {Promise<Array>} Array of season objects
 */
async function getLeagueSeasons(accessToken, leagueId, includeRetired = false) {
  try {
    const response = await makeApiRequest('/data/league/seasons', accessToken, {
      league_id: leagueId,
      retired: includeRetired ? 1 : 0,
    });
    
    // Handle different response formats
    const seasons = Array.isArray(response) ? response : (response.data || response.seasons || []);
    
    return seasons.map(season => ({
      seasonId: season.season_id || season.seasonId,
      leagueId: season.league_id || leagueId,
      seasonName: season.season_name || season.name || 'Unknown Season',
      active: season.active !== undefined ? season.active : true,
      startDate: season.start_date ? new Date(season.start_date) : null,
      endDate: season.end_date ? new Date(season.end_date) : null,
      year: season.year || null,
      quarter: season.quarter || null,
    }));
  } catch (error) {
    throw new Error(`Failed to get league seasons: ${error.message}`);
  }
}

/**
 * Get season sessions for a league season
 * @param {string} accessToken - OAuth access token
 * @param {number} leagueId - iRacing league ID
 * @param {number} seasonId - Season ID
 * @param {boolean} resultsOnly - Only return completed sessions (default: false)
 * @returns {Promise<Array>} Array of session objects
 */
async function getLeagueSeasonSessions(accessToken, leagueId, seasonId, resultsOnly = false) {
  try {
    const params = {
      league_id: leagueId,
      season_id: seasonId,
    };
    
    if (resultsOnly) {
      params.results_only = 1;
    }
    
    const response = await makeApiRequest('/data/league/season_sessions', accessToken, params);
    
    // Handle different response formats
    const sessions = Array.isArray(response) ? response : (response.data || response.sessions || []);
    
    return sessions.map(session => ({
      sessionId: session.session_id || session.subsession_id,
      subsessionId: session.subsession_id || session.session_id,
      leagueId: session.league_id || leagueId,
      seasonId: session.season_id || seasonId,
      sessionName: session.session_name || session.name || 'Race Session',
      startTime: session.start_time ? new Date(session.start_time) : null,
      raceWeekNum: session.race_week_num || session.raceWeek || 0,
      trackId: session.track_id || null,
      trackName: session.track?.track_name || session.track_name || 'Unknown Track',
      carClassId: session.car_class_id || null,
      carClassName: session.car_class?.car_class_name || session.car_class_name || 'Unknown Class',
      carId: session.car_id || null,
      carName: session.car?.car_name || session.car_name || null,
      sessionType: session.session_type || 'race',
      status: session.status || 'scheduled', // scheduled, completed, cancelled, etc.
      sessionStartTime: session.session_start_time ? new Date(session.session_start_time) : null,
    }));
  } catch (error) {
    throw new Error(`Failed to get league season sessions: ${error.message}`);
  }
}

/**
 * Get the current/active season for a league
 * @param {string} accessToken - OAuth access token
 * @param {number} leagueId - iRacing league ID
 * @returns {Promise<Object|null>} Current season or null if none active
 */
async function getCurrentLeagueSeason(accessToken, leagueId) {
  try {
    const seasons = await getLeagueSeasons(accessToken, leagueId, false);
    
    // Find active season (most recent if multiple)
    const activeSeasons = seasons.filter(s => s.active).sort((a, b) => {
      const dateA = a.startDate || new Date(0);
      const dateB = b.startDate || new Date(0);
      return dateB - dateA; // Most recent first
    });
    
    return activeSeasons.length > 0 ? activeSeasons[0] : null;
  } catch (error) {
    throw new Error(`Failed to get current league season: ${error.message}`);
  }
}

/**
 * Fetch upcoming sessions for a league season and format as calendar events
 * @param {string} accessToken - OAuth access token
 * @param {number} leagueId - iRacing league ID
 * @param {number} seasonId - Season ID (optional, will use current season if not provided)
 * @returns {Promise<Array>} Array of calendar event objects
 */
async function fetchLeagueScheduleAsCalendarEvents(accessToken, leagueId, seasonId = null) {
  try {
    // Get season ID if not provided
    let activeSeasonId = seasonId;
    if (!activeSeasonId) {
      const currentSeason = await getCurrentLeagueSeason(accessToken, leagueId);
      if (!currentSeason) {
        throw new Error('No active season found for this league');
      }
      activeSeasonId = currentSeason.seasonId;
    }
    
    // Get league details for name
    const leagueDetails = await getLeagueDetails(accessToken, leagueId);
    
    // Get all sessions (not just completed)
    const sessions = await getLeagueSeasonSessions(accessToken, leagueId, activeSeasonId, false);
    
    // Filter to upcoming/future sessions and format as calendar events
    const now = new Date();
    const calendarEvents = sessions
      .filter(session => {
        const sessionDate = session.startTime || session.sessionStartTime;
        return sessionDate && new Date(sessionDate) >= now;
      })
      .map(session => {
        const sessionDate = session.startTime || session.sessionStartTime || new Date();
        
        // Map session type to event type
        let eventType = 'race';
        if (session.sessionType) {
          const type = session.sessionType.toLowerCase();
          if (type.includes('practice')) eventType = 'practice';
          else if (type.includes('qualif') || type.includes('qualify')) eventType = 'qualifier';
          else if (type.includes('race')) eventType = 'race';
        }
        
        // Determine status
        let status = 'scheduled';
        if (session.status) {
          const sessionStatus = session.status.toLowerCase();
          if (sessionStatus === 'completed') status = 'completed';
          else if (sessionStatus === 'cancelled') status = 'cancelled';
          else if (sessionStatus === 'postponed') status = 'postponed';
        }
        
        return {
          title: session.sessionName || `Round ${session.raceWeekNum + 1}`,
          description: `${leagueDetails.leagueName} - Week ${session.raceWeekNum + 1}`,
          eventDate: sessionDate,
          eventType: eventType,
          track: session.trackName,
          carClass: session.carName || session.carClassName,
          status: status,
          // Store iRacing metadata for reference
          iracingMetadata: {
            sessionId: session.sessionId,
            subsessionId: session.subsessionId,
            leagueId: leagueId,
            seasonId: activeSeasonId,
            raceWeekNum: session.raceWeekNum,
          },
        };
      })
      .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate)); // Sort by date
    
    return calendarEvents;
  } catch (error) {
    throw new Error(`Failed to fetch league schedule: ${error.message}`);
  }
}

module.exports = {
  getLeagueDetails,
  getLeagueSeasons,
  getLeagueSeasonSessions,
  getCurrentLeagueSeason,
  fetchLeagueScheduleAsCalendarEvents,
};
