/**
 * iRacing OAuth Integration
 * 
 * Handles OAuth flow and token management for iRacing Data API
 * 
 * iRacing OAuth endpoints:
 * - Authorization: https://members-ng.iracing.com/auth
 * - Token: https://members-ng.iracing.com/oauth/token
 * - API Base: https://members-ng.iracing.com/data
 */

const https = require('https');
const querystring = require('querystring');

// iRacing OAuth configuration
const IRACING_AUTH_URL = 'https://members-ng.iracing.com/auth';
const IRACING_TOKEN_URL = 'https://members-ng.iracing.com/oauth/token';
const IRACING_API_BASE = 'https://members-ng.iracing.com/data';

/**
 * Get OAuth authorization URL
 * @param {string} clientId - OAuth client ID
 * @param {string} redirectUri - OAuth redirect URI
 * @param {string} state - OAuth state parameter (CSRF protection)
 * @returns {string} Authorization URL
 */
function getAuthorizationUrl(clientId, redirectUri, state) {
  const params = {
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid',
    state: state,
  };
  
  return `${IRACING_AUTH_URL}?${querystring.stringify(params)}`;
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from callback
 * @param {string} clientId - OAuth client ID
 * @param {string} clientSecret - OAuth client secret
 * @param {string} redirectUri - OAuth redirect URI
 * @returns {Promise<Object>} Token response with access_token, refresh_token, expires_in, etc.
 */
function exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(IRACING_TOKEN_URL, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            reject(new Error(`Token exchange failed: ${response.error || res.statusCode} - ${response.error_description || data}`));
            return;
          }
          
          resolve(response);
        } catch (err) {
          reject(new Error(`Failed to parse token response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Token exchange request failed: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @param {string} clientId - OAuth client ID
 * @param {string} clientSecret - OAuth client secret
 * @returns {Promise<Object>} New token response
 */
function refreshAccessToken(refreshToken, clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(IRACING_TOKEN_URL, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            reject(new Error(`Token refresh failed: ${response.error || res.statusCode} - ${response.error_description || data}`));
            return;
          }
          
          resolve(response);
        } catch (err) {
          reject(new Error(`Failed to parse token response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Token refresh request failed: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Make authenticated API request to iRacing Data API
 * @param {string} endpoint - API endpoint (e.g., '/member/get')
 * @param {string} accessToken - OAuth access token
 * @param {Object} params - Query parameters (optional)
 * @returns {Promise<Object>} API response
 */
function makeApiRequest(endpoint, accessToken, params = {}) {
  return new Promise((resolve, reject) => {
    const queryString = Object.keys(params).length > 0 
      ? '?' + querystring.stringify(params)
      : '';
    
    const url = `${IRACING_API_BASE}${endpoint}${queryString}`;
    
    const options = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    };

    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            reject(new Error(`API request failed: ${res.statusCode} - ${response.error || data}`));
            return;
          }
          
          resolve(response);
        } catch (err) {
          reject(new Error(`Failed to parse API response: ${err.message}`));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`API request failed: ${err.message}`));
    });
  });
}

/**
 * Get user info from iRacing API
 * 
 * NOTE: Actual iRacing Data API endpoint may be:
 * - /data/member/get
 * - /data/member/profile
 * - /oauth/userinfo (if supported)
 * 
 * Adjust endpoint based on official iRacing API documentation.
 * 
 * PRIVACY: Only returns iRacing display_name (username), NOT real names or email addresses.
 * display_name is the iRacing username/display name, which users choose themselves.
 * 
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<Object>} User info including cust_id and display_name (iRacing username only)
 */
async function getUserInfo(accessToken) {
  try {
    let response;
    
    // Try primary endpoint
    try {
      response = await makeApiRequest('/member/get', accessToken);
    } catch (err) {
      // Try alternative endpoint
      try {
        response = await makeApiRequest('/member/profile', accessToken);
      } catch (altErr) {
        // Try OAuth userinfo endpoint if available
        try {
          response = await makeApiRequest('/oauth/userinfo', accessToken);
        } catch (userinfoErr) {
          throw new Error(`All endpoints failed: ${err.message}`);
        }
      }
    }
    
    // Handle different response formats
    const userData = response.data || response;
    
    // PRIVACY: Only return display_name (iRacing username), NOT email or real names
    // display_name is the iRacing username/display name that users choose themselves
    return {
      custId: userData.cust_id || userData.customer_id || userData.sub,
      displayName: userData.display_name || userData.name || userData.username,
      // NOTE: We intentionally do NOT return email or any real name data
      // Email and personal information are never stored or exposed
    };
  } catch (error) {
    throw new Error(`Failed to get user info: ${error.message}`);
  }
}

module.exports = {
  getAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  makeApiRequest,
  getUserInfo,
  IRACING_API_BASE,
};
