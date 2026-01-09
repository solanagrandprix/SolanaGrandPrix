const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random string
    const ext = path.extname(file.originalname);
    const uniqueName = `avatar-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: function (req, file, cb) {
    // Only allow images
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
    }
  },
});

// Security headers middleware
app.use((req, res, next) => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Only set Strict-Transport-Security in production with HTTPS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Limit form data size

// ---------------------- Auth/session helpers ----------------------
const sessions = new Map(); // token -> { userId, createdAt, lastAccess }

// Session expiration time: 30 days
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Rate limiting for authentication endpoints
const rateLimitMap = new Map(); // ip -> { count, resetTime }
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5; // Max 5 attempts per window

function checkRateLimit(ip) {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }
  
  limit.count++;
  return true;
}

// Cleanup old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, limit] of rateLimitMap.entries()) {
    if (now > limit.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60 * 60 * 1000); // Every hour

const normalizeUsername = (username = '') => username.trim().toLowerCase();

// Security: SHA-256 is weak for passwords, but we'll improve validation
// For production, consider migrating to bcrypt (requires password reset)
const hashPassword = (password = '') =>
  crypto.createHash('sha256').update(password).digest('hex');

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex'); // Increased from 24 to 32 bytes
  const now = Date.now();
  sessions.set(token, { userId, createdAt: now, lastAccess: now });
  
  // Cleanup old sessions periodically
  cleanupExpiredSessions();
  
  return token;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_EXPIRY_MS) {
      sessions.delete(token);
    }
  }
}

// Cleanup expired sessions every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

function readToken(req) {
  // Security: Only accept tokens from Authorization header, not query strings
  // Query strings can be logged, cached, or exposed in URLs
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').trim();
  }
  return null; // Removed query string support for security
}

// Middleware: sets req.auth = { token, userId }
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  
  const session = sessions.get(token);
  
  // Check session expiration
  if (Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
    sessions.delete(token);
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
  
  // Update last access time
  session.lastAccess = Date.now();
  
  req.auth = { token, userId: session.userId };
  next();
}

// Middleware: requires admin privileges
async function requireAdmin(req, res, next) {
  const token = readToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  
  try {
    const session = sessions.get(token);
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, isAdmin: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    req.auth = { token, userId: session.userId, user };
    next();
  } catch (err) {
    console.error('Admin check error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}

// ---------------------- API ----------------------
app.get('/hello', (req, res) => {
  res.send('Backend is working! 🏁');
});

// -------- Signup (DB) --------
app.post('/api/signup', rateLimitAuth, async (req, res) => {
  try {
    const usernameRaw = (req.body.username || '').trim();
    const password = req.body.password || '';

    // Enhanced validation
    if (!usernameRaw || usernameRaw.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters.' });
    }
    if (usernameRaw.length > 30) {
      return res.status(400).json({ message: 'Username must be less than 30 characters.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (password.length > 128) {
      return res.status(400).json({ message: 'Password is too long.' });
    }
    // Prevent common weak patterns
    if (password.toLowerCase() === usernameRaw.toLowerCase()) {
      return res.status(400).json({ message: 'Password cannot be the same as username.' });
    }

    const username = normalizeUsername(usernameRaw);
    const passwordHash = hashPassword(password);

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: 'That username is already registered.' });
    }

    const created = await prisma.user.create({
      data: {
        username,
        passwordHash: passwordHash,
        driver: {
          create: {
            driverKey: username,
            displayName: usernameRaw,
            number: 0,
            team: 'Privateer',
            primaryCar: 'Mazda MX-5 Cup',
            avatar: '/images/riley.png',
            irating: 0,
            license: 'Rookie',
            starts: 0,
            freeAgent: true,

            xpTotal: 0,
            xpLevel: 1,
            xpToNext: 500,
            skillTier: 'Beginner',
            bestFinish: 0,
            winRate: 0,
            totalPurse: 0,
          },
        },
      },
      include: { driver: true },
    });

    const token = createSession(created.id);

    return res.status(201).json({
      message: 'Account created successfully.',
      user: {
        username: created.username,
        driverKey: created.driver?.driverKey || created.username,
        displayName: created.driver?.displayName || created.username,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});


// Rate limiting middleware for auth endpoints
function rateLimitAuth(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ 
      message: 'Too many login attempts. Please try again in 15 minutes.' 
    });
  }
  next();
}

// -------- Login (DB) --------
app.post('/api/login', rateLimitAuth, async (req, res) => {
  try {
    const usernameRaw = (req.body.username || '').trim();
    const password = req.body.password || '';

    if (!usernameRaw || !password) {
      return res.status(400).json({ message: 'Missing username or password.' });
    }

    const username = normalizeUsername(usernameRaw);

    const user = await prisma.user.findUnique({
      where: { username },
      include: { driver: true },
    });

    // Security: Don't reveal if username exists to prevent enumeration attacks
    // Always hash and compare to prevent timing attacks
    const passwordHash = hashPassword(password);
    
    if (!user || passwordHash !== user.passwordHash) {
      // Use same error message and response time to prevent enumeration
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    const token = createSession(user.id);

    return res.json({
      message: 'Logged in successfully.',
      user: {
        username: user.username,
        driverKey: user.driver?.driverKey || user.username,
        displayName: user.driver?.displayName || user.username,
        isAdmin: user.isAdmin || false,
      },
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Logout --------
app.post('/api/logout', requireAuth, async (req, res) => {
  try {
    const token = readToken(req);
    if (token && sessions.has(token)) {
      sessions.delete(token);
    }
    return res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- /api/me (DB) --------
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { driver: true },
    });

    if (!user) return res.status(401).json({ message: 'Session invalid.' });

    return res.json({
      user: {
        username: user.username,
        driverKey: user.driver?.driverKey || user.username,
        displayName: user.driver?.displayName || user.username,
        isAdmin: user.isAdmin || false,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Avatar upload endpoint --------
app.post('/api/driver/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { driver: true },
    });

    if (!user || !user.driver) {
      // Clean up uploaded file if driver doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Driver profile not found.' });
    }

    const oldAvatarPath = user.driver.avatar;
    const newAvatarPath = `/uploads/avatars/${req.file.filename}`;

    // Update driver avatar
    const updated = await prisma.driver.update({
      where: { id: user.driver.id },
      data: { avatar: newAvatarPath },
    });

    // Delete old avatar if it exists and is in uploads directory (not default images)
    if (oldAvatarPath && oldAvatarPath.startsWith('/uploads/avatars/')) {
      const oldFullPath = path.join(__dirname, 'public', oldAvatarPath);
      try {
        if (fs.existsSync(oldFullPath)) {
          fs.unlinkSync(oldFullPath);
        }
      } catch (err) {
        console.error('Error deleting old avatar:', err);
        // Don't fail the request if old file deletion fails
      }
    }

    return res.json({
      message: 'Avatar uploaded successfully.',
      avatar: newAvatarPath,
    });
  } catch (err) {
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Error cleaning up file:', unlinkErr);
      }
    }
    console.error('Avatar upload error:', err);
    return res.status(500).json({ 
      message: err.message || 'Server error while uploading avatar.' 
    });
  }
});

// -------- Save card customization (DB) --------
app.post('/api/driver/card-customization', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { driver: true },
    });

    if (!user || !user.driver) {
      return res.status(404).json({ message: 'Driver profile not found.' });
    }

    // Validate and sanitize customization data
    const customization = req.body.customization;
    if (!customization || typeof customization !== 'object') {
      return res.status(400).json({ message: 'Invalid customization data.' });
    }

    // Store as JSON string
    const customizationJson = JSON.stringify(customization);

    const updated = await prisma.driver.update({
      where: { id: user.driver.id },
      data: { cardCustomization: customizationJson },
    });

    return res.json({
      message: 'Card customization saved successfully.',
      customization: customization,
    });
  } catch (err) {
    console.error('Card customization save error:', err);
    return res.status(500).json({ 
      message: 'Server error while saving card customization.' 
    });
  }
});

// -------- Get card customization (DB) --------
app.get('/api/driver/card-customization/:driverKey', async (req, res) => {
  try {
    const driverKey = normalizeUsername(req.params.driverKey || '');
    if (!driverKey) {
      return res.status(400).json({ message: 'Missing driver key.' });
    }

    const driver = await prisma.driver.findUnique({
      where: { driverKey: driverKey },
      select: { cardCustomization: true },
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    // Parse JSON if it exists
    let customization = null;
    if (driver.cardCustomization) {
      try {
        customization = JSON.parse(driver.cardCustomization);
      } catch (parseErr) {
        console.error('Error parsing card customization:', parseErr);
      }
    }

    return res.json({ customization });
  } catch (err) {
    console.error('Card customization fetch error:', err);
    return res.status(500).json({ 
      message: 'Server error while fetching card customization.' 
    });
  }
});

// -------- Driver profile update (DB) --------
app.post('/api/driver/profile', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { driver: true },
    });

    if (!user || !user.driver) {
      return res.status(404).json({ message: 'Driver profile not found.' });
    }

    // IMPORTANT: these field names match schema.prisma
    const data = {};
    const userUpdateData = {};

    // Required/standard fields - only update if provided
    if (req.body.name !== undefined && req.body.name !== null && req.body.name !== '') {
      const newDisplayName = req.body.name.trim();
      data.displayName = newDisplayName;
      
      // Update login username and driverKey to match the new display name
      // Normalize the new username (lowercase, no spaces)
      const newUsername = normalizeUsername(newDisplayName);
      
      // Check if the new username is different from current
      if (newUsername !== user.username) {
        // Validate username length (same as signup)
        if (newUsername.length < 3) {
          return res.status(400).json({ 
            message: 'Username must be at least 3 characters long after removing spaces.' 
          });
        }
        
        if (newUsername.length > 30) {
          return res.status(400).json({ 
            message: 'Username is too long. Maximum 30 characters.' 
          });
        }
        
        // Check if new username is already taken by another user
        const existingUser = await prisma.user.findUnique({
          where: { username: newUsername },
        });
        
        if (existingUser && existingUser.id !== user.id) {
          return res.status(409).json({ 
            message: `Username "${newDisplayName}" is already taken. Please choose a different name.` 
          });
        }
        
        // Check if driverKey is already taken by another driver
        const existingDriver = await prisma.driver.findUnique({
          where: { driverKey: newUsername },
        });
        
        if (existingDriver && existingDriver.userId !== user.id) {
          return res.status(409).json({ 
            message: `Username "${newDisplayName}" is already taken. Please choose a different name.` 
          });
        }
        
        // Update username and driverKey (they stay in sync)
        userUpdateData.username = newUsername;
        data.driverKey = newUsername;
      }
    }
    
    if (req.body.number !== undefined && req.body.number !== null) {
      data.number = parseInt(req.body.number, 10) || 0;
    }
    
    if (req.body.team !== undefined && req.body.team !== null) {
      data.team = req.body.team;
    }
    
    if (req.body.primaryCar !== undefined && req.body.primaryCar !== null) {
      data.primaryCar = req.body.primaryCar;
    }
    
    if (req.body.freeAgent !== undefined && req.body.freeAgent !== null) {
      data.freeAgent = !!req.body.freeAgent;
    }

    // Avatar can be updated via URL (for external images) or via the separate upload endpoint
    if (req.body.avatar !== undefined && req.body.avatar !== null && req.body.avatar !== '') {
      data.avatar = req.body.avatar;
    }

    // Optional fields (added in migration)
    // Only update fields that are explicitly provided AND have values (or are being cleared)
    // This prevents empty strings from resetting fields when the form submits all fields
    const optionalFields = {
      preferredClasses: req.body.preferredClasses,
      country: req.body.country,
      timezone: req.body.timezone,
      twitch: req.body.twitch,
      twitter: req.body.twitter,
      discord: req.body.discord,
      driverNotes: req.body.driverNotes,
    };

    Object.keys(optionalFields).forEach((k) => {
      const value = optionalFields[k];
      // Only include in update if:
      // 1. Field exists in request body (was sent)
      // 2. AND has a non-empty value (preserves existing value if empty string sent)
      // Exception: Allow explicit clearing with empty string only if field was intentionally cleared
      if (k in req.body && value !== undefined && value !== null && value !== '') {
        data[k] = value;
      }
      // If field is empty string or not provided, don't update (preserves existing value)
    });

    // Ensure we have at least one field to update
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    // Security: Don't log sensitive data in production
    if (process.env.NODE_ENV === 'development') {
      console.log('Updating driver profile');
    }

    // Update user username if it changed (must be done before driver update to avoid conflicts)
    let finalUsername = user.username;
    if (Object.keys(userUpdateData).length > 0) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: userUpdateData,
      });
      finalUsername = updatedUser.username;
    }

    const updated = await prisma.driver.update({
      where: { id: user.driver.id },
      data,
    });

    return res.json({
      message: 'Driver profile updated.',
      driver: updated,
      // Return updated username so frontend can update URL if needed
      username: finalUsername,
    });
  } catch (err) {
    console.error('PROFILE UPDATE ERROR:', err);
    console.error('Error message:', err.message);
    console.error('Error code:', err.code);
    console.error('Error meta:', err.meta);
    
    // Check if it's a missing column error (migration not run)
    if (err.message && (err.message.includes('no such column') || err.message.includes('Unknown column'))) {
      return res.status(500).json({
        message: 'Database migration required. The Prisma client may be out of sync. Please stop the server and run: npx prisma generate',
        error: 'Missing database columns. The schema was updated but the Prisma client needs to be regenerated.',
      });
    }
    
    // Check for Prisma validation errors
    if (err.code === 'P2002') {
      return res.status(409).json({
        message: 'A unique constraint failed. This value may already be in use.',
        error: err.meta?.target || 'Unknown constraint violation',
      });
    }
    
    // Check for record not found
    if (err.code === 'P2025') {
      return res.status(404).json({
        message: 'Driver profile not found.',
        error: err.message,
      });
    }
    
    return res.status(500).json({
      message: 'Server error while updating profile.',
      error: err.message,
      code: err.code,
      // Include more details in development
      ...(process.env.NODE_ENV !== 'production' && { 
        stack: err.stack,
        meta: err.meta 
      }),
    });
  }
});


// -------- Single driver fetch (for featured card, etc.) --------
app.get('/api/driver/:key', async (req, res) => {
  try {
    const key = normalizeUsername(req.params.key || '');
    if (!key) return res.status(400).json({ message: 'Missing driver key.' });

    const d = await prisma.driver.findUnique({ where: { driverKey: key } });
    if (!d) return res.status(404).json({ message: 'Driver not found.' });

    // Parse card customization if it exists
    let cardCustomization = null;
    if (d.cardCustomization) {
      try {
        cardCustomization = JSON.parse(d.cardCustomization);
      } catch (parseErr) {
        console.error('Error parsing card customization:', parseErr);
      }
    }

    // Security: Don't expose userId or other sensitive internal IDs
    const { userId, cardCustomization: cardCustomizationRaw, ...safeDriverData } = d;
    return res.json({ ...safeDriverData, cardCustomization });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Read driver stats (DB) --------
app.get('/api/stats', async (req, res) => {
  try {
    const key = normalizeUsername(req.query.driver || 'lemon');
    const token = readToken(req);
    
    // Check if this is the authenticated user's own profile
    let isOwnProfile = false;
    if (token && sessions.has(token)) {
      const session = sessions.get(token);
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.userId },
          include: { driver: true },
        });
        if (user && user.driver && user.driver.driverKey === key) {
          isOwnProfile = true;
        }
      } catch (err) {
        // Ignore errors checking ownership
      }
    }

    const d = await prisma.driver.findUnique({
      where: { driverKey: key },
    });

    if (!d) {
      return res.json({
        // legacy fields
        name: 'Unknown',
        displayName: 'Unknown',
        number: 0,
        team: 'Unknown',
        primaryCar: 'Unknown',
        avatar: '',
        irating: 0,
        license: 'N/A',
        starts: 0,
        freeAgent: true,

        xpTotal: 0,
        xpLevel: 1,
        xpToNext: 500,
        skillTier: 'Beginner',
        bestFinish: 0,
        winRate: 0,
        totalPurse: 0,
        // Default values for fields not yet in schema
        championships: 0,
        wins: 0,
        podiums: 0,
        dnfs: 0,
        earnings: 0,
      });
    }

    // Parse card customization if it exists
    let cardCustomization = null;
    if (d.cardCustomization) {
      try {
        cardCustomization = JSON.parse(d.cardCustomization);
      } catch (parseErr) {
        console.error('Error parsing card customization:', parseErr);
      }
    }

    // Security: Only return public stats. Sensitive info only for own profile.
    const publicStats = {
      name: d.displayName,
      displayName: d.displayName,
      driverKey: d.driverKey,

      number: d.number,
      team: d.team,
      primaryCar: d.primaryCar,
      avatar: d.avatar,
      irating: d.irating,
      license: d.license,
      starts: d.starts,
      freeAgent: d.freeAgent,

      xpTotal: d.xpTotal ?? 0,
      xpLevel: d.xpLevel ?? 1,
      xpToNext: d.xpToNext ?? 500,
      skillTier: d.skillTier || 'Beginner',
      bestFinish: d.bestFinish ?? 0,
      winRate: d.winRate ?? 0,
      totalPurse: d.totalPurse ?? 0,
      // Default values for fields not yet in schema
      championships: 0,
      wins: 0,
      podiums: 0,
      dnfs: 0,
      earnings: d.totalPurse ?? 0,
      
      // Include card customization for all users (it's visual styling)
      cardCustomization: cardCustomization,
    };

    // Only include sensitive personal info if viewing own profile
    if (isOwnProfile) {
      publicStats.preferredClasses = d.preferredClasses || '';
      publicStats.country = d.country || '';
      publicStats.timezone = d.timezone || '';
      publicStats.twitch = d.twitch || '';
      publicStats.twitter = d.twitter || '';
      publicStats.discord = d.discord || '';
      publicStats.driverNotes = d.driverNotes || '';
    }

    return res.json(publicStats);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Drivers list (DB) --------
app.get('/api/drivers', async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      orderBy: { irating: 'desc' },
    });

    res.json(
      drivers.map((d) => ({
        key: d.driverKey, // tracker uses this
        name: d.displayName, // tracker shows this
        displayName: d.displayName,
        number: d.number,
        team: d.team,
        primaryCar: d.primaryCar,
        avatar: d.avatar,
        irating: d.irating,
        license: d.license,
        starts: d.starts,
        freeAgent: d.freeAgent,
        xpTotal: d.xpTotal ?? 0,
        xpLevel: d.xpLevel ?? 1,
        skillTier: d.skillTier || 'Beginner',
        // Default values for fields not yet in schema
        championships: 0,
        wins: 0,
        podiums: 0,
        dnfs: 0,
        earnings: d.totalPurse ?? 0,
      }))
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Admin API Endpoints --------
// Get all users (admin only)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        driver: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
        driver: u.driver
          ? {
              driverKey: u.driver.driverKey,
              displayName: u.driver.displayName,
              team: u.driver.team,
              number: u.driver.number,
              irating: u.driver.irating,
              starts: u.driver.starts,
              freeAgent: u.driver.freeAgent,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error('Admin users error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Get user details (admin only)
app.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Security: Only return necessary fields, never password hash
    return res.json({ 
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        driver: user.driver ? {
          id: user.driver.id,
          driverKey: user.driver.driverKey,
          displayName: user.driver.displayName,
          number: user.driver.number,
          team: user.driver.team,
          primaryCar: user.driver.primaryCar,
          avatar: user.driver.avatar,
          irating: user.driver.irating,
          license: user.driver.license,
          starts: user.driver.starts,
          freeAgent: user.driver.freeAgent,
          xpTotal: user.driver.xpTotal,
          xpLevel: user.driver.xpLevel,
          skillTier: user.driver.skillTier,
          preferredClasses: user.driver.preferredClasses,
          country: user.driver.country,
          timezone: user.driver.timezone,
          twitch: user.driver.twitch,
          twitter: user.driver.twitter,
          discord: user.driver.discord,
          driverNotes: user.driver.driverNotes,
          createdAt: user.driver.createdAt,
          updatedAt: user.driver.updatedAt,
        } : null,
      }
    });
  } catch (err) {
    console.error('Admin user details error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Update user (admin only) - for making users admin, etc.
app.post('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID.' });
    }

    // Prevent modifying yourself (safety measure)
    if (userId === req.auth.userId) {
      return res.status(400).json({ message: 'Cannot modify your own admin status.' });
    }

    const updateData = {};
    if (req.body.isAdmin !== undefined) {
      updateData.isAdmin = !!req.body.isAdmin;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    return res.json({
      message: 'User updated successfully.',
      user: updated,
    });
  } catch (err) {
    console.error('Admin update user error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Get admin stats (admin only)
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [totalUsers, totalAdmins, totalDrivers, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isAdmin: true } }),
      prisma.driver.count(),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    return res.json({
      stats: {
        totalUsers,
        totalAdmins,
        totalDrivers,
        recentUsers,
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Store featured driver key (in-memory for now, can be persisted later)
let featuredDriverKey = 'lemon'; // Default

// Get featured driver (public)
app.get('/api/featured-driver', async (req, res) => {
  try {
    return res.json({ driverKey: featuredDriverKey });
  } catch (err) {
    console.error('Featured driver error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Set featured driver (admin only)
app.post('/api/admin/featured-driver', requireAdmin, async (req, res) => {
  try {
    const { driverKey } = req.body;
    
    if (!driverKey || typeof driverKey !== 'string') {
      return res.status(400).json({ message: 'Invalid driver key.' });
    }

    // Validate that the driver exists
    const driver = await prisma.driver.findUnique({
      where: { driverKey: normalizeUsername(driverKey) },
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    featuredDriverKey = normalizeUsername(driverKey);

    return res.json({
      message: 'Featured driver updated successfully.',
      driverKey: featuredDriverKey,
    });
  } catch (err) {
    console.error('Set featured driver error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ---------------------- Pages ----------------------
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'home.html'))
);
app.get('/admin', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'admin.html'))
);
app.get('/tracker', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);
app.get('/driver/:id', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'driver.html'))
);
app.get('/card-builder', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'card-builder.html'))
);
app.get('/auth', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'auth.html'))
);
app.get('/account', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'account.html'))
);
app.get('/season', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'season.html'))
);
app.get('/leaderboard', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'))
);

// Serve static files (including uploaded avatars)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
