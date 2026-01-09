const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;

// Email configuration
// For production, set these environment variables:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, BASE_URL
// For development/testing, uses a test account (emails won't actually send)
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

// Email sending function
async function sendVerificationEmail(email, username, verificationToken) {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@solanagp.com',
      to: email,
      subject: 'Verify your Solana Grand Prix account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #22c55e, #06b6d4); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Solana Grand Prix</h1>
            </div>
            <div class="content">
              <h2>Verify your email address</h2>
              <p>Hi ${escapeHtmlForEmail(username)},</p>
              <p>Thank you for signing up for Solana Grand Prix! Please verify your email address by clicking the button below:</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #6b7280; font-size: 12px;">${verificationUrl}</p>
              <p>This link will expire in 7 days.</p>
              <p>If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>Solana Grand Prix - iRacing League</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Verify your Solana Grand Prix account
        
        Hi ${username},
        
        Thank you for signing up! Please verify your email address by visiting this link:
        
        ${verificationUrl}
        
        This link will expire in 7 days.
        
        If you didn't create an account, you can safely ignore this email.
      `,
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    // Don't throw - allow signup to continue even if email fails
    return false;
  }
}

function escapeHtmlForEmail(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

// Rate limiting for authentication endpoints (login rate limiting disabled)
const rateLimitMap = new Map(); // ip -> { count, resetTime }
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5; // Max 5 attempts per window

// Clear all rate limits on server startup
rateLimitMap.clear();
console.log('✅ Rate limiting cleared - login cooldown disabled');

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

// Clear all rate limits on server startup (so login works immediately after restart)
rateLimitMap.clear();

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
    // Email verification temporarily disabled
    // const email = (req.body.email || '').trim().toLowerCase();

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

    // Check for existing username
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return res.status(409).json({ message: 'That username is already registered.' });
    }

    // Email verification temporarily disabled
    // // Check for existing email
    // const existingEmail = await prisma.user.findUnique({ where: { email } });
    // if (existingEmail) {
    //   return res.status(409).json({ message: 'That email address is already registered.' });
    // }

    const created = await prisma.user.create({
      data: {
        username,
        passwordHash: passwordHash,
        // Email verification temporarily disabled
        // email: email,
        // emailVerified: false,
        // verificationToken: verificationToken,
        // verificationSentAt: new Date(),
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

    // Email verification temporarily disabled
    // // Send verification email (don't block signup if it fails)
    // sendVerificationEmail(email, usernameRaw, verificationToken).catch(err => {
    //   console.error('Failed to send verification email:', err);
    // });

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
    console.error('Signup error:', err);
    if (err.code === 'P2002') {
      // Unique constraint violation
      if (err.meta?.target?.includes('email')) {
        return res.status(409).json({ message: 'That email address is already registered.' });
      }
      return res.status(409).json({ message: 'That username is already registered.' });
    }
    return res.status(500).json({ message: 'Server error.' });
  }
});


// Rate limiting middleware for auth endpoints (disabled for login, kept for signup)
function rateLimitAuth(req, res, next) {
  // Skip rate limiting for login endpoint (check req.path or req.url)
  const isLogin = req.path === '/api/login' || req.url === '/api/login';
  if (isLogin) {
    return next(); // Skip rate limiting for login
  }
  
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ 
      message: 'Too many attempts. Please try again in 15 minutes.' 
    });
  }
  next();
}

// -------- Login (DB) --------
app.post('/api/login', async (req, res) => {
  try {
    const usernameRaw = (req.body.username || '').trim();
    const password = req.body.password || '';

    if (!usernameRaw || !password) {
      return res.status(400).json({ message: 'Missing username or password.' });
    }

    const username = normalizeUsername(usernameRaw);

    // Explicitly select only fields that exist in database (email verification disabled)
    // Note: updatedAt doesn't exist in User table in current database
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        isAdmin: true,
        createdAt: true,
        driver: {
          select: {
            id: true,
            userId: true,
            driverKey: true,
            displayName: true,
            number: true,
            team: true,
            primaryCar: true,
            avatar: true,
            irating: true,
            license: true,
            starts: true,
            freeAgent: true,
            xpTotal: true,
            xpLevel: true,
            xpToNext: true,
            skillTier: true,
            bestFinish: true,
            winRate: true,
            totalPurse: true,
            preferredClasses: true,
            country: true,
            timezone: true,
            twitch: true,
            twitter: true,
            discord: true,
            driverNotes: true,
            cardCustomization: true,
            createdAt: true,
            updatedAt: true, // This should exist in Driver table
          },
        },
      },
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
    console.error('LOGIN ERROR:', err);
    console.error('Error message:', err.message);
    console.error('Error code:', err.code);
    console.error('Error meta:', err.meta);
    console.error('Full error stack:', err.stack);
    
    // Check if it's a missing column error (migration not run)
    if (err.code === 'P2022' || err.code === 'P2019' || 
        (err.message && (err.message.includes('no such column') || 
         err.message.includes('Unknown column') || 
         err.message.includes('does not exist in the current database')))) {
      return res.status(500).json({
        message: 'Database migration required. Please run: npx prisma generate && npx prisma migrate deploy',
        error: 'Database schema mismatch. Missing columns detected.',
        code: err.code || 'P2022'
      });
    }
    
    // Check if it's a Prisma client not generated error
    if (err.message && err.message.includes('PrismaClient')) {
      return res.status(500).json({
        message: 'Prisma client not generated. Please run: npx prisma generate',
        error: 'Prisma client needs to be regenerated.',
      });
    }
    
    // Check if it's a database connection error
    if (err.code === 'P1001' || err.message.includes('Can\'t reach database server')) {
      return res.status(500).json({
        message: 'Database connection failed. Please check DATABASE_URL environment variable.',
        error: 'Unable to connect to database.',
      });
    }
    
    return res.status(500).json({ 
      message: 'Server error during login.',
      ...(process.env.NODE_ENV !== 'production' && { 
        error: err.message,
        code: err.code,
        hint: 'Check server console for full error details'
      })
    });
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
        // Email verification temporarily disabled
        // email: user.email || null,
        // emailVerified: user.emailVerified || false,
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
          select: {
            id: true,
            userId: true,
          },
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
      iracing: req.body.iracing,
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

    // Explicitly select only fields that exist in database
    const d = await prisma.driver.findUnique({ 
      where: { driverKey: key },
      select: {
        id: true,
        userId: true,
        driverKey: true,
        displayName: true,
        number: true,
        team: true,
        primaryCar: true,
        avatar: true,
        irating: true,
        license: true,
        starts: true,
        freeAgent: true,
        xpTotal: true,
        xpLevel: true,
        xpToNext: true,
        skillTier: true,
        bestFinish: true,
        winRate: true,
        totalPurse: true,
        preferredClasses: true,
        country: true,
        timezone: true,
        twitch: true,
        twitter: true,
        discord: true,
        driverNotes: true,
        cardCustomization: true,
        createdAt: true,
        updatedAt: true,
        // iracing and solanaWallet may not exist in DB yet - handle gracefully
      },
    });
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

    // Explicitly select only fields that exist in database (avoid missing column errors)
    const d = await prisma.driver.findUnique({
      where: { driverKey: key },
      select: {
        id: true,
        userId: true,
        driverKey: true,
        displayName: true,
        number: true,
        team: true,
        primaryCar: true,
        avatar: true,
        irating: true,
        license: true,
        starts: true,
        freeAgent: true,
        xpTotal: true,
        xpLevel: true,
        xpToNext: true,
        skillTier: true,
        bestFinish: true,
        winRate: true,
        totalPurse: true,
        preferredClasses: true,
        country: true,
        timezone: true,
        twitch: true,
        twitter: true,
        discord: true,
        // iracing: true, // May not exist in DB yet - handle gracefully
        // solanaWallet: true, // May not exist in DB yet - handle gracefully
        driverNotes: true,
        cardCustomization: true,
        createdAt: true,
        updatedAt: true,
      },
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
      // iRacing data is PRIVATE - only returned to the user themselves
      // Never displayed publicly, only used for API connection
      publicStats.iracing = d.iracing || '';
      publicStats.driverNotes = d.driverNotes || '';
    }
    
    // SECURITY: iRacing data is NEVER included in public responses
    // It is only available to the user themselves (isOwnProfile check above)

    // Set cache headers to prevent caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    return res.json(publicStats);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Drivers list (DB) --------
// Only returns drivers that have active user accounts
app.get('/api/drivers', async (req, res) => {
  try {
    // Get all drivers - userId is required in schema, so all drivers have accounts
    // But we'll verify by including the user relation
    const drivers = await prisma.driver.findMany({
      select: {
        id: true,
        userId: true,
        driverKey: true,
        displayName: true,
        number: true,
        team: true,
        primaryCar: true,
        avatar: true,
        irating: true,
        license: true,
        starts: true,
        freeAgent: true,
        xpTotal: true,
        xpLevel: true,
        xpToNext: true,
        skillTier: true,
        bestFinish: true,
        winRate: true,
        totalPurse: true,
        preferredClasses: true,
        country: true,
        timezone: true,
        twitch: true,
        twitter: true,
        discord: true,
        // iracing: true, // May not exist in DB yet - handle gracefully
        // solanaWallet: true, // May not exist in DB yet - handle gracefully
        driverNotes: true,
        cardCustomization: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            createdAt: true,
          },
        },
      },
      orderBy: { 
        displayName: 'asc',
      },
    });
    
    // All drivers have accounts since userId is required in schema
    // But filter out any that somehow don't have user loaded (shouldn't happen)
    const validDrivers = drivers.filter(d => {
      // If user relation exists, include it
      if (d.user && d.user.id) {
        return true;
      }
      // If user relation is missing but driver exists, log warning but still include
      // (userId is required, so user should always exist)
      if (d.userId) {
        console.warn('Driver', d.driverKey, 'has userId but user relation not loaded');
        return true; // Still include it since userId exists
      }
      return false; // Only exclude if no userId at all
    });

    // Map to response format
    const driversList = validDrivers.map((d) => {
      let cardCustomization = null;
      if (d.cardCustomization) {
        try {
          cardCustomization = JSON.parse(d.cardCustomization);
        } catch (e) {
          console.error('Error parsing cardCustomization for driver', d.driverKey, e);
        }
      }
      
      // Ensure hasAccount is always explicitly true or false
      const hasAccount = !!(d.user || d.userId);
      
      return {
        key: d.driverKey,
        driverKey: d.driverKey,
        name: d.displayName,
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
        xpToNext: d.xpToNext ?? 500,
        skillTier: d.skillTier || 'Beginner',
        bestFinish: d.bestFinish ?? 0,
        winRate: d.winRate ?? 0,
        totalPurse: d.totalPurse ?? 0,
        cardCustomization: cardCustomization,
        // Account info (for verification)
        // Always explicitly set to true or false
        hasAccount: hasAccount,
        accountCreated: d.user?.createdAt || null,
        // Default values for fields not yet in schema
        championships: 0,
        wins: 0,
        podiums: 0,
        dnfs: 0,
        earnings: d.totalPurse ?? 0,
      };
    });

    console.log(`/api/drivers: Returning ${driversList.length} drivers (from ${drivers.length} total, ${validDrivers.length} valid)`);
    if (driversList.length > 0) {
      console.log('Sample driver:', {
        driverKey: driversList[0].driverKey,
        name: driversList[0].name,
        hasAccount: driversList[0].hasAccount,
        hasCustomization: !!driversList[0].cardCustomization,
        customizationKeys: driversList[0].cardCustomization ? Object.keys(driversList[0].cardCustomization) : null,
      });
    }

    // Set cache headers to prevent caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.json(driversList);
  } catch (err) {
    console.error('Error fetching drivers:', err);
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
        // Email verification temporarily disabled
        // email: u.email || null,
        // emailVerified: u.emailVerified || false,
        // verifiedAt: u.verifiedAt || null,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
        driver: u.driver
          ? {
              driverKey: u.driver.driverKey,
              displayName: u.driver.displayName, // Only display name, never full name
              team: u.driver.team,
              number: u.driver.number,
              irating: u.driver.irating,
              starts: u.driver.starts,
              freeAgent: u.driver.freeAgent,
              // NOTE: iRacing data is intentionally excluded for privacy
              // It is only used for API connection, never displayed
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
          // iRacing data is PRIVATE - only used for API connection, never displayed
          // iracing: user.driver.iracing, // REMOVED - privacy protection
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
    const [totalUsers, totalAdmins, totalDrivers, recentUsers, verifiedEmails] = await Promise.all([
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
      // Email verification temporarily disabled
      // prisma.user.count({ where: { emailVerified: true } }),
      0, // Placeholder for verified email count
    ]);

    return res.json({
      stats: {
        totalUsers,
        totalAdmins,
        totalDrivers,
        recentUsers,
        // verifiedEmails, // Email verification temporarily disabled
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Store featured driver key (in-memory for now, can be persisted later)
let featuredDriverKey = 'lemon'; // Default

// Get driver count (public) - for home page stats
// Only counts drivers with active user accounts (same logic as /api/drivers)
app.get('/api/driver-count', async (req, res) => {
  try {
    // Get all drivers with user accounts (same query as /api/drivers)
    const drivers = await prisma.driver.findMany({
      select: {
        id: true,
        userId: true,
        driverKey: true,
        displayName: true,
        user: {
          select: {
            id: true,
          },
        },
      },
    });
    
    // Filter to only drivers with active accounts (same logic as /api/drivers)
    const validDrivers = drivers.filter(d => {
      // If user relation exists, include it
      if (d.user && d.user.id) {
        return true;
      }
      // If user relation is missing but driver exists, still include
      // (userId is required, so user should always exist)
      if (d.userId) {
        return true; // Still include it since userId exists
      }
      return false; // Only exclude if no userId at all
    });
    
    const count = validDrivers.length;
    return res.json({ count });
  } catch (err) {
    console.error('Driver count error:', err);
    return res.status(500).json({ message: 'Server error.', count: 0 });
  }
});

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
      select: {
        id: true,
        driverKey: true,
      },
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
app.get('/connections', (req, res) => {
  console.log('Connections route hit:', req.url);
  const filePath = path.join(__dirname, 'public', 'connections.html');
  console.log('Sending file:', filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending connections.html:', err);
      res.status(500).send('Error loading connections page');
    }
  });
});

app.get('/verify-email', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify-email.html'));
});

// -------- Connections API Endpoints --------
// Get connections (returns current user's connections)
app.get('/api/driver/connections', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { driver: true },
    });

    if (!user || !user.driver) {
      return res.status(404).json({ message: 'Driver profile not found.' });
    }

    return res.json({
      discord: user.driver.discord || null,
      iracing: user.driver.iracing || null,
      twitter: user.driver.twitter || null,
      solanaWallet: user.driver.solanaWallet || null,
    });
  } catch (err) {
    console.error('Get connections error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Update connections
app.post('/api/driver/connections', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { driver: true },
    });

    if (!user || !user.driver) {
      return res.status(404).json({ message: 'Driver profile not found.' });
    }

    const updateData = {};

    // Update only provided fields, convert empty strings to null
    if (req.body.discord !== undefined) {
      updateData.discord = req.body.discord && req.body.discord.trim() !== '' 
        ? req.body.discord.trim() 
        : null;
    }

    if (req.body.iracing !== undefined) {
      // iRacing connection is PRIVATE - only used for API integration
      // Never displayed publicly, only stored for backend API calls
      const iracingValue = req.body.iracing && req.body.iracing.trim() !== '' 
        ? req.body.iracing.trim() 
        : null;
      
      // Ensure we're only storing username/ID, not full names
      // iRacing usernames are typically alphanumeric, no spaces
      if (iracingValue && iracingValue.length > 100) {
        return res.status(400).json({ message: 'Invalid iRacing identifier format.' });
      }
      
      updateData.iracing = iracingValue;
    }

    if (req.body.twitter !== undefined) {
      updateData.twitter = req.body.twitter && req.body.twitter.trim() !== '' 
        ? req.body.twitter.trim() 
        : null;
    }

    if (req.body.solanaWallet !== undefined) {
      // Validate Solana wallet address format (base58, 32-44 characters)
      const walletAddress = req.body.solanaWallet && req.body.solanaWallet.trim() !== '' 
        ? req.body.solanaWallet.trim() 
        : null;
      
      if (walletAddress) {
        // Basic validation: Solana addresses are base58 encoded, typically 32-44 characters
        const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        if (!solanaAddressRegex.test(walletAddress)) {
          return res.status(400).json({ message: 'Invalid Solana wallet address format.' });
        }
      }
      
      updateData.solanaWallet = walletAddress;
    }

    await prisma.driver.update({
      where: { id: user.driver.id },
      data: updateData,
    });

    return res.json({
      message: 'Connections updated successfully.',
      connections: {
        discord: updateData.discord,
        iracing: updateData.iracing,
        twitter: updateData.twitter,
        solanaWallet: updateData.solanaWallet,
      },
    });
  } catch (err) {
    console.error('Update connections error:', err);
    return res.status(500).json({ message: 'Server error while updating connections.' });
  }
});

// -------- Achievements API Endpoints --------
// Get achievements for a driver
app.get('/api/driver/:driverKey/achievements', async (req, res) => {
  try {
    const driverKey = normalizeUsername(req.params.driverKey);
    const driver = await prisma.driver.findUnique({
      where: { driverKey },
      select: {
        id: true,
        driverKey: true,
        displayName: true,
        achievements: {
          where: { driverId: { not: null } }, // Only unlocked achievements
          orderBy: { unlockedAt: 'desc' },
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            xpReward: true,
            rarity: true,
            category: true,
            unlockedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    // Also get global achievement templates (available achievements)
    const globalAchievements = await prisma.achievement.findMany({
      where: {
        driverId: null,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      unlocked: driver.achievements,
      available: globalAchievements,
    });
  } catch (err) {
    console.error('Fetch achievements error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Admin Achievement Management --------
// Get all achievements (templates and unlocked)
app.get('/api/admin/achievements', requireAdmin, async (req, res) => {
  try {
    const achievements = await prisma.achievement.findMany({
      orderBy: [{ driverId: 'asc' }, { createdAt: 'desc' }],
      include: {
        driver: {
          select: {
            driverKey: true,
            displayName: true,
          },
        },
      },
    });
    return res.json(achievements);
  } catch (err) {
    console.error('Fetch all achievements error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Create achievement template
app.post('/api/admin/achievements', requireAdmin, async (req, res) => {
  try {
    const { name, description, icon, xpReward, rarity, category, isActive } = req.body;

    if (!name || !description) {
      return res.status(400).json({ message: 'Name and description are required.' });
    }

    const achievement = await prisma.achievement.create({
      data: {
        name,
        description,
        icon: icon || null,
        xpReward: parseInt(xpReward) || 0,
        rarity: rarity || 'Common',
        category: category || null,
        isActive: isActive !== false,
        driverId: null, // Template achievement
      },
    });

    return res.json(achievement);
  } catch (err) {
    console.error('Create achievement error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Update achievement
app.put('/api/admin/achievements/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, icon, xpReward, rarity, category, isActive } = req.body;

    const achievement = await prisma.achievement.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(xpReward !== undefined && { xpReward: parseInt(xpReward) || 0 }),
        ...(rarity !== undefined && { rarity }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return res.json(achievement);
  } catch (err) {
    console.error('Update achievement error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Achievement not found.' });
    }
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Delete achievement
app.delete('/api/admin/achievements/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.achievement.delete({
      where: { id },
    });
    return res.json({ message: 'Achievement deleted successfully.' });
  } catch (err) {
    console.error('Delete achievement error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Achievement not found.' });
    }
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Account credentials update --------
app.post('/api/account/credentials', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
    });

    if (!user) {
      return res.status(401).json({ message: 'Session invalid.' });
    }

    const { currentPassword, newUsername, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required.' });
    }

    // Verify current password
    const currentPasswordHash = hashPassword(currentPassword);
    if (currentPasswordHash !== user.passwordHash) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const updateData = {};

    // Update username if provided
    if (newUsername && newUsername.trim()) {
      const normalizedUsername = normalizeUsername(newUsername.trim());
      
      // Check if username is already taken
      const existingUser = await prisma.user.findUnique({
        where: { username: normalizedUsername },
      });

      if (existingUser && existingUser.id !== user.id) {
        return res.status(409).json({ message: 'That username is already taken.' });
      }

      updateData.username = normalizedUsername;

      // Also update driverKey if driver exists
      const driver = await prisma.driver.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          userId: true,
          driverKey: true,
        },
      });

      if (driver) {
        await prisma.driver.update({
          where: { id: driver.id },
          data: { driverKey: normalizedUsername },
        });
      }
    }

    // Update password if provided
    if (newPassword && newPassword.trim()) {
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
      }
      updateData.passwordHash = hashPassword(newPassword);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Nothing to update.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
      },
    });

    return res.json({
      message: 'Credentials updated successfully.',
      user: updatedUser,
    });
  } catch (err) {
    console.error('Credentials update error:', err);
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'That username is already taken.' });
    }
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Request account deletion --------
app.post('/api/account/request-deletion', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { deletionRequest: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'Session invalid.' });
    }

    // Check if user already has a pending request
    if (user.deletionRequest) {
      if (user.deletionRequest.status === 'pending') {
        return res.status(409).json({ message: 'You already have a pending deletion request.' });
      }
      // If previous request was denied, allow new request
      if (user.deletionRequest.status === 'denied') {
        await prisma.deletionRequest.delete({
          where: { userId: user.id },
        });
      }
    }

    const { reason } = req.body;

    await prisma.deletionRequest.create({
      data: {
        userId: user.id,
        reason: reason || null,
        status: 'pending',
      },
    });

    return res.json({
      message: 'Deletion request submitted successfully. An admin will review your request.',
    });
  } catch (err) {
    console.error('Deletion request error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Get deletion request status (for user) --------
app.get('/api/account/deletion-status', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      include: { deletionRequest: true },
    });

    if (!user) {
      return res.status(401).json({ message: 'Session invalid.' });
    }

    if (!user.deletionRequest) {
      return res.json({ hasRequest: false });
    }

    return res.json({
      hasRequest: true,
      status: user.deletionRequest.status,
      reason: user.deletionRequest.reason,
      createdAt: user.deletionRequest.createdAt,
      reviewedAt: user.deletionRequest.reviewedAt,
      notes: user.deletionRequest.notes,
    });
  } catch (err) {
    console.error('Deletion status error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Admin: Get all deletion requests --------
app.get('/api/admin/deletion-requests', requireAdmin, async (req, res) => {
  try {
    const requests = await prisma.deletionRequest.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true,
            driver: {
              select: {
                driverKey: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(requests);
  } catch (err) {
    console.error('Get deletion requests error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Admin: Approve deletion request --------
app.post('/api/admin/deletion-requests/:id/approve', requireAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { notes } = req.body;

    const deletionRequest = await prisma.deletionRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          include: {
            driver: true,
          },
        },
      },
    });

    if (!deletionRequest) {
      return res.status(404).json({ message: 'Deletion request not found.' });
    }

    if (deletionRequest.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been processed.' });
    }

    // Prevent admins from deleting themselves
    if (deletionRequest.user.isAdmin) {
      return res.status(403).json({ message: 'Cannot delete admin accounts.' });
    }

    const userId = deletionRequest.userId;

    // Delete the user (cascade will delete driver, achievements, and deletion request)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Invalidate any active sessions for this user
    const tokensToDelete = [];
    for (const [token, session] of sessions.entries()) {
      if (session.userId === userId) {
        tokensToDelete.push(token);
      }
    }
    tokensToDelete.forEach(token => sessions.delete(token));

    return res.json({
      message: 'Account deleted successfully.',
    });
  } catch (err) {
    console.error('Approve deletion error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Admin: Deny deletion request --------
app.post('/api/admin/deletion-requests/:id/deny', requireAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { notes } = req.body;

    const deletionRequest = await prisma.deletionRequest.findUnique({
      where: { id: requestId },
    });

    if (!deletionRequest) {
      return res.status(404).json({ message: 'Deletion request not found.' });
    }

    if (deletionRequest.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been processed.' });
    }

    await prisma.deletionRequest.update({
      where: { id: requestId },
      data: {
        status: 'denied',
        reviewedBy: req.auth.userId,
        reviewedAt: new Date(),
        notes: notes || null,
      },
    });

    return res.json({
      message: 'Deletion request denied.',
    });
  } catch (err) {
    console.error('Deny deletion error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Calendar Events API --------
// Get all calendar events (public)
app.get('/api/calendar', async (req, res) => {
  try {
    const events = await prisma.calendarEvent.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        eventDate: 'asc',
      },
    });

    return res.json(events);
  } catch (err) {
    console.error('Get calendar events error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Get calendar events (admin - includes inactive)
app.get('/api/admin/calendar', requireAdmin, async (req, res) => {
  try {
    const events = await prisma.calendarEvent.findMany({
      orderBy: {
        eventDate: 'asc',
      },
    });

    return res.json(events);
  } catch (err) {
    console.error('Get calendar events (admin) error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Create calendar event (admin only)
app.post('/api/admin/calendar', requireAdmin, async (req, res) => {
  try {
    const { title, description, eventDate, eventType, track, carClass, status, isActive } = req.body;

    if (!title || !eventDate) {
      return res.status(400).json({ message: 'Title and event date are required.' });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description: description || null,
        eventDate: new Date(eventDate),
        eventType: eventType || 'race',
        track: track || null,
        carClass: carClass || null,
        status: status || 'scheduled',
        isActive: isActive !== undefined ? isActive : true,
        createdBy: req.auth.userId,
      },
    });

    return res.json({
      message: 'Calendar event created successfully.',
      event,
    });
  } catch (err) {
    console.error('Create calendar event error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Update calendar event (admin only)
app.put('/api/admin/calendar/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, eventDate, eventType, track, carClass, status, isActive } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (eventDate !== undefined) updateData.eventDate = new Date(eventDate);
    if (eventType !== undefined) updateData.eventType = eventType;
    if (track !== undefined) updateData.track = track || null;
    if (carClass !== undefined) updateData.carClass = carClass || null;
    if (status !== undefined) updateData.status = status;
    if (isActive !== undefined) updateData.isActive = isActive;

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: updateData,
    });

    return res.json({
      message: 'Calendar event updated successfully.',
      event,
    });
  } catch (err) {
    console.error('Update calendar event error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Calendar event not found.' });
    }
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Delete calendar event (admin only)
app.delete('/api/admin/calendar/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.calendarEvent.delete({
      where: { id },
    });
    return res.json({ message: 'Calendar event deleted successfully.' });
  } catch (err) {
    console.error('Delete calendar event error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Calendar event not found.' });
    }
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Award achievement to a driver
app.post('/api/admin/achievements/:id/award', requireAdmin, async (req, res) => {
  try {
    const achievementId = parseInt(req.params.id);
    const { driverKey } = req.body;

    if (!driverKey) {
      return res.status(400).json({ message: 'Driver key is required.' });
    }

    const driver = await prisma.driver.findUnique({
      where: { driverKey: normalizeUsername(driverKey) },
      select: {
        id: true,
        driverKey: true,
        displayName: true,
        xpTotal: true,
      },
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found.' });
    }

    // Check if achievement is already unlocked
    const existing = await prisma.achievement.findFirst({
      where: {
        id: achievementId,
        driverId: driver.id,
      },
    });

    if (existing) {
      return res.status(400).json({ message: 'Achievement already unlocked for this driver.' });
    }

    // Get the achievement template
    const template = await prisma.achievement.findUnique({
      where: { id: achievementId },
    });

    if (!template) {
      return res.status(404).json({ message: 'Achievement template not found.' });
    }

    // Create unlocked achievement instance
    const unlockedAchievement = await prisma.achievement.create({
      data: {
        name: template.name,
        description: template.description,
        icon: template.icon,
        xpReward: template.xpReward,
        rarity: template.rarity,
        category: template.category,
        isActive: true,
        driverId: driver.id,
        unlockedAt: new Date(),
      },
    });

    // Award XP to driver
    if (template.xpReward > 0) {
      await prisma.driver.update({
        where: { id: driver.id },
        data: {
          xpTotal: {
            increment: template.xpReward,
          },
        },
      });
    }

    return res.json(unlockedAchievement);
  } catch (err) {
    console.error('Award achievement error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// -------- Admin XP Management --------
// Update driver XP
app.post('/api/admin/driver/:driverKey/xp', requireAdmin, async (req, res) => {
  try {
    const driverKey = normalizeUsername(req.params.driverKey);
    const { xpTotal, xpLevel, xpToNext, skillTier } = req.body;

    const updateData = {};
    if (xpTotal !== undefined) updateData.xpTotal = parseInt(xpTotal);
    if (xpLevel !== undefined) updateData.xpLevel = parseInt(xpLevel);
    if (xpToNext !== undefined) updateData.xpToNext = parseInt(xpToNext);
    if (skillTier !== undefined) updateData.skillTier = skillTier;

    const driver = await prisma.driver.update({
      where: { driverKey },
      data: updateData,
    });

    return res.json({
      message: 'XP updated successfully.',
      driver: {
        driverKey: driver.driverKey,
        displayName: driver.displayName,
        xpTotal: driver.xpTotal,
        xpLevel: driver.xpLevel,
        xpToNext: driver.xpToNext,
        skillTier: driver.skillTier,
      },
    });
  } catch (err) {
    console.error('Update XP error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Driver not found.' });
    }
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Serve static files (including uploaded avatars)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Test database connection on startup (async, non-blocking)
prisma.$connect()
  .then(async () => {
    console.log('✅ Database connected successfully');
    
    // Test if we can query User table (catches missing columns early)
    try {
      await prisma.user.findFirst({
        select: { id: true, username: true, passwordHash: true, isAdmin: true, createdAt: true }
      });
      console.log('✅ User table is accessible');
    } catch (testErr) {
      console.error('⚠️  WARNING: User table query failed:', testErr.message);
      console.error('   Error code:', testErr.code || 'N/A');
      if (testErr.code === 'P2022' || testErr.message.includes('does not exist')) {
        console.error('   🔧 FIX: Run "npx prisma migrate deploy" to update database schema');
      }
    }
  })
  .catch((err) => {
    console.error('❌ DATABASE CONNECTION FAILED:', err.message);
    console.error('Error code:', err.code || 'N/A');
    console.error('This will cause all API endpoints to fail!');
    
    if (err.code === 'P1001' || err.message.includes('Can\'t reach')) {
      console.error('\n🔧 FIX: Check your DATABASE_URL environment variable');
      console.error('   Make sure the database file exists at the specified path');
    } else if (err.code === 'P2022' || err.message.includes('does not exist')) {
      console.error('\n🔧 FIX: Missing database columns detected');
      console.error('   1. npx prisma generate');
      console.error('   2. npx prisma migrate deploy');
    } else {
      console.error('\n🔧 FIX: Run these commands:');
      console.error('   1. npx prisma generate');
      console.error('   2. npx prisma migrate deploy');
    }
    console.error('   3. Restart the server\n');
  });

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log('⚠️  Check above for database connection status');
});
