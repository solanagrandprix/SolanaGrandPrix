# Fix Missing Database Columns on Render.com

## Errors You're Seeing
```
The column `main.User.isAdmin` does not exist in the current database.
The column `main.Driver.cardCustomization` does not exist in the current database.
```

## Problem
Your Render.com database is missing columns because migrations haven't been applied. The database schema is outdated.

## Solution: Apply Migrations on Render

### Option 1: Using Render Shell (Recommended)

1. **Go to your Render Dashboard:**
   - https://dashboard.render.com
   - Find your service

2. **Open Shell:**
   - Click on your service
   - Go to "Shell" tab (or look for SSH/Shell access)
   - Click "Open Shell"

3. **Run these commands in the shell:**
   ```bash
   # Navigate to project directory (usually already there)
   cd /opt/render/project/src
   
   # Generate Prisma client
   npx prisma generate
   
   # Apply all migrations
   npx prisma migrate deploy
   
   # Verify migrations applied
   npx prisma migrate status
   ```

4. **Restart your service:**
   - Go back to Render dashboard
   - Click "Manual Deploy" → "Clear build cache & deploy"

### Option 2: Add Migration to Build Command

If Render doesn't persist the database or you need migrations to run automatically:

1. **Go to your Render service settings**
2. **Find "Build Command"** section
3. **Update it to include migrations:**
   ```bash
   npm install && npx prisma generate && npx prisma migrate deploy && npm start
   ```
   
   Or if you have a separate build command:
   ```bash
   npm install && npx prisma generate && npx prisma migrate deploy
   ```

4. **Save and redeploy**

### Option 3: Use Render Post-Deploy Script

Create a script that runs migrations after deployment:

1. **Create `render-deploy.sh` in your project root:**
   ```bash
   #!/bin/bash
   set -e
   
   echo "Running Prisma migrations..."
   npx prisma generate
   npx prisma migrate deploy
   echo "Migrations complete!"
   ```

2. **In Render dashboard, set:**
   - **Post-Deploy Command:** `bash render-deploy.sh`

### Option 4: Manual SQL Fix (If migrations fail)

If migrations won't run, you can manually add the missing columns:

1. **Open Render Shell**
2. **Connect to your SQLite database:**
   ```bash
   cd /opt/render/project/src
   sqlite3 prisma/production.db
   ```

3. **Add missing columns:**
   ```sql
   -- Add isAdmin to User table (if missing)
   ALTER TABLE "User" ADD COLUMN "isAdmin" INTEGER DEFAULT 0;
   -- Convert boolean to integer (0 = false, 1 = true)
   UPDATE "User" SET "isAdmin" = 0 WHERE "isAdmin" IS NULL;
   
   -- Add cardCustomization to Driver table (if missing)
   ALTER TABLE "Driver" ADD COLUMN "cardCustomization" TEXT;
   
   -- Exit SQLite
   .quit
   ```

4. **Restart service**

## Quick Fix Steps (Do This Now)

### Step 1: Open Render Shell
1. Go to https://dashboard.render.com
2. Click your service
3. Click "Shell" tab
4. Click "Connect" or "Open Shell"

### Step 2: Run These Commands
```bash
# Make sure you're in the right directory
pwd
# Should show: /opt/render/project/src

# Generate Prisma client
npx prisma generate

# Check migration status
npx prisma migrate status

# Apply all migrations
npx prisma migrate deploy

# Verify it worked
npx prisma migrate status
```

### Step 3: Restart Service
- In Render dashboard, click "Manual Deploy"
- Or wait for next deploy

## Verify Fix

After running migrations, check your service logs. You should see:
```
✅ Database connected successfully
✅ User table is accessible
```

Instead of the error messages.

## Prevent Future Issues

### Update Render Build Command

In your Render service settings, update **Build Command** to:
```bash
npm install && npx prisma generate && npx prisma migrate deploy
```

This ensures migrations run automatically on every deploy.

### Or Use Render Post-Deploy Hook

1. **In Render dashboard → Your Service → Settings**
2. **Find "Post-Deploy Command"** (or "Deploy Hook")
3. **Add:**
   ```bash
   npx prisma migrate deploy
   ```

## Render-Specific Notes

- **Database Location:** On Render, your database is at `/opt/render/project/src/prisma/production.db`
- **Persistent Disk:** Make sure your service has a persistent disk enabled for the database file
- **Environment Variables:** Check that `DATABASE_URL` is set correctly in Render's environment variables
- **Build vs Runtime:** Migrations should run during build OR as a post-deploy script

## If Database is Empty/New

If you're okay with resetting the database (losing all data):

```bash
# In Render Shell
cd /opt/render/project/src
npx prisma migrate reset --force
npx prisma generate
npx prisma migrate deploy
```

**⚠️ WARNING:** This will delete all data! Only do this if the database is empty or you're okay losing data.

## Check Your DATABASE_URL

Make sure your Render environment variable is set:
- Go to Render dashboard → Your Service → Environment
- Check for `DATABASE_URL`
- Should be: `file:./prisma/production.db` or `file:/opt/render/project/src/prisma/production.db`

## Still Not Working?

If migrations still fail:
1. Check Render logs for full error
2. Verify DATABASE_URL is correct
3. Check that persistent disk is enabled
4. Try the manual SQL approach (Option 4 above)
