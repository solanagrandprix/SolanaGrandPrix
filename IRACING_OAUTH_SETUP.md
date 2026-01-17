# iRacing OAuth Integration Setup Guide

This guide explains how to set up and use the iRacing OAuth integration for automatic session syncing.

## Overview

The iRacing OAuth integration allows users to:
- Connect their iRacing account using OAuth (no password storage)
- Automatically sync league and hosted practice sessions
- View session data including laps, best lap times, and incidents
- Track attendance and performance over time

## Prerequisites

1. **iRacing Developer Account**: You need to register your application with iRacing to get OAuth credentials
   - Visit: https://members.iracing.com/membersite/member/DeveloperApps
   - Create a new application
   - Note your Client ID and Client Secret

2. **Node.js 18.x** or higher
3. **Database**: SQLite (or PostgreSQL if configured)

## Setup Instructions

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```env
# iRacing OAuth Configuration
IRACING_CLIENT_ID=your_client_id_here
IRACING_CLIENT_SECRET=your_client_secret_here
IRACING_REDIRECT_URI=https://yourdomain.com/auth/iracing/callback

# Base URL (used for redirect URI if IRACING_REDIRECT_URI not set)
BASE_URL=https://yourdomain.com

# Database (already configured)
DATABASE_URL="file:./prisma/production.db"
```

**Important Notes:**
- `IRACING_REDIRECT_URI` must match the callback URL registered with iRacing
- For local development, use: `http://localhost:3000/auth/iracing/callback`
- For production, use your actual domain

### 2. Database Migration

Run the migration to create the required tables:

```bash
npx prisma migrate deploy
# or for development:
npx prisma migrate dev
```

This will create:
- `IracingAccount` - Stores OAuth tokens for each user
- `IracingSession` - Stores synced session data
- `IracingSessionParticipant` - Stores participant data for each session

### 3. Generate Prisma Client

Ensure Prisma client is up to date:

```bash
npx prisma generate
```

### 4. Start the Server

```bash
npm start
# or for development:
npm run dev
```

## API Endpoints

### OAuth Flow

#### 1. Start OAuth Flow
**GET** `/auth/iracing/start`

Initiates the OAuth flow. Returns an authorization URL.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "authUrl": "https://members-ng.iracing.com/auth?...",
  "message": "Redirect to this URL to authorize iRacing connection"
}
```

**Frontend Usage:**
```javascript
const response = await fetch('/auth/iracing/start', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
window.location.href = data.authUrl; // Redirect to iRacing OAuth page
```

#### 2. OAuth Callback
**GET** `/auth/iracing/callback?code=...&state=...`

Handles the OAuth callback from iRacing. This endpoint:
- Exchanges the authorization code for tokens
- Stores tokens in the database
- Redirects to `/connections?success=iracing_connected`

**Note:** This endpoint is called automatically by iRacing after user authorization.

### Session Management

#### 3. Sync Sessions
**POST** `/api/iracing/sync`

Syncs league and hosted practice sessions from the iRacing API.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "message": "Synced 5 session(s) successfully.",
  "synced": 5,
  "errors": 0,
  "errorDetails": []
}
```

**Features:**
- Automatically refreshes expired tokens
- Retries failed API calls once
- Handles missing data gracefully
- Updates existing sessions or creates new ones

**Frontend Usage:**
```javascript
const response = await fetch('/api/iracing/sync', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
console.log(`Synced ${data.synced} sessions`);
```

#### 4. Get Connection Status
**GET** `/api/iracing/status`

Returns the current iRacing connection status for the authenticated user.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "connected": true,
  "custId": 123456,
  "displayName": "John Doe",
  "expiresAt": "2024-01-16T12:00:00Z",
  "isExpired": false,
  "lastSyncedAt": "2024-01-15T10:30:00Z",
  "connectedAt": "2024-01-10T08:00:00Z"
}
```

#### 5. Get User Sessions
**GET** `/api/iracing/sessions?limit=50&offset=0`

Returns synced sessions where the user participated.

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `limit` - Maximum number of sessions to return (default: 50)
- `offset` - Number of sessions to skip (default: 0)

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "abc123",
      "sessionType": "practice",
      "leagueId": 456,
      "leagueName": "Solana Grand Prix",
      "trackName": "Circuit de Spa-Francorchamps",
      "carName": "Formula iR-04",
      "startTime": "2024-01-15T14:00:00Z",
      "participant": {
        "lapsCompleted": 15,
        "bestLapTime": 128.456,
        "incidents": 2,
        "finishPosition": 5
      }
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

## Frontend Integration

### Example: Connect Button

```html
<button onclick="connectIracing()">Connect iRacing Account</button>

<script>
async function connectIracing() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/auth/iracing/start', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  
  if (data.authUrl) {
    window.location.href = data.authUrl;
  }
}
</script>
```

### Example: Sync Button

```html
<button onclick="syncSessions()">Sync Sessions</button>

<script>
async function syncSessions() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/iracing/sync', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  alert(data.message);
}
</script>
```

### Full Integration Page

See `public/iracing-connect.html` for a complete example implementation.

## Database Schema

### IracingAccount
Stores OAuth tokens and connection info:
- `userId` - Foreign key to User table
- `custId` - iRacing customer ID
- `accessToken` - OAuth access token (encrypted in production)
- `refreshToken` - OAuth refresh token
- `expiresAt` - Token expiration timestamp
- `displayName` - Cached iRacing display name
- `lastSyncedAt` - Last session sync timestamp

### IracingSession
Stores session metadata:
- `sessionId` - Unique iRacing session ID
- `sessionType` - practice, race, or qualifying
- `leagueId` - iRacing league ID (if applicable)
- `leagueName` - League name (cached)
- `trackName` - Track name
- `carName` - Car name
- `startTime` - Session start time
- `subSessionId` - Sub-session ID (for multi-session races)
- `seasonId` - Season ID (if part of a series)

### IracingSessionParticipant
Stores participant data:
- `sessionId` - Foreign key to IracingSession
- `custId` - iRacing customer ID
- `displayName` - Display name at time of session
- `lapsCompleted` - Number of laps completed
- `bestLapTime` - Best lap time in seconds (null if no lap)
- `incidents` - Total incidents
- `finishPosition` - Finish position (if race)
- `startingPosition` - Starting position (if available)
- `totalLaps` - Total laps (may differ from lapsCompleted)

## Token Refresh

The system automatically refreshes expired tokens:
- Tokens are checked before each API call
- Refresh occurs if token expires within 5 minutes
- Failed refresh attempts are logged
- Users are prompted to reconnect if refresh fails

## Error Handling

### Common Errors

1. **Token Expired**
   - Status: 401
   - Solution: User needs to reconnect their iRacing account

2. **Invalid State** (CSRF protection)
   - Status: 400
   - Solution: Retry the OAuth flow

3. **API Rate Limits**
   - Status: 429
   - Solution: Implement rate limiting or wait before retry

4. **Missing Data**
   - Status: 200 (partial success)
   - Solution: Handled gracefully, missing fields are null

## Security Considerations

1. **Token Storage**: Access tokens are stored in the database. In production, consider encryption.
2. **HTTPS**: Always use HTTPS in production to protect tokens in transit.
3. **CSRF Protection**: State parameter prevents CSRF attacks.
4. **Token Expiration**: Tokens expire automatically and are refreshed when needed.
5. **No Password Storage**: OAuth means we never store iRacing passwords.

## Troubleshooting

### OAuth Flow Not Starting

- Check `IRACING_CLIENT_ID` is set correctly
- Verify `IRACING_REDIRECT_URI` matches iRacing app settings
- Check server logs for errors

### Token Refresh Failing

- Verify `IRACING_CLIENT_SECRET` is correct
- Check token hasn't been revoked by user
- Verify iRacing API is accessible

### Sessions Not Syncing

- Check user's iRacing account is connected
- Verify token is valid (not expired)
- Check iRacing API endpoint availability
- Review error logs for specific failures

### Missing Session Data

- Some practice sessions may not have full results
- League sessions require league membership
- Hosted sessions require proper permissions
- API may return partial data - this is expected

## Example Workflow

1. User clicks "Connect iRacing Account"
2. Redirected to iRacing OAuth page
3. User authorizes application
4. Callback stores tokens in database
5. User clicks "Sync Sessions"
6. System fetches sessions from iRacing API
7. Sessions are stored in database
8. User can view their session data

## API Documentation References

- iRacing Data API: https://members-ng.iracing.com/
- OAuth 2.0 Specification: https://oauth.net/2/
- iRacing Developer Portal: https://members.iracing.com/membersite/member/DeveloperApps

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify environment variables are set correctly
3. Test OAuth flow with iRacing's test credentials (if available)
4. Review iRacing API documentation for endpoint changes

---

**Note:** This integration uses only the official iRacing Data API. Web scraping is not used and is not recommended.
