# Fix "Read-only file system" on Render.com

## Error
```
Error: Schema engine error:
Creating SQLite database parent directory.
Read-only file system (os error 30)
```

## Problem
On Render, the project directory might be read-only during build. You need to:
1. Use Render's persistent disk for the database
2. Ensure DATABASE_URL points to the right location
3. Create the directory in a writable location

## Solution 1: Use Render Persistent Disk (Recommended)

Render provides a persistent disk at `/opt/render/project/src` for web services.

### Step 1: Check Your DATABASE_URL

In Render Dashboard → Your Service → Environment, make sure you have:
```env
DATABASE_URL="file:./prisma/production.db"
```

Or use absolute path:
```env
DATABASE_URL="file:/opt/render/project/src/prisma/production.db"
```

### Step 2: Update Pre-Deploy Command

In Render Dashboard → Settings → **Pre-Deploy Command**, use:
```bash
mkdir -p prisma && npx prisma migrate deploy
```

This creates the directory before migrations run.

### Step 3: Update Build Command

In Render Dashboard → Settings → **Build Command**, use:
```bash
npm install && npx prisma generate
```

### Step 4: Ensure Persistent Disk is Enabled

1. Go to Render Dashboard → Your Service → Settings
2. Scroll down to "Persistent Disk"
3. Make sure it's **enabled** and mounted at `/opt/render/project/src`
4. Set size (minimum 1GB should work)

## Solution 2: Use Start Command to Create Directory

If Pre-Deploy doesn't work, create the directory in the Start Command:

**In Render Dashboard → Settings → Start Command:**
```bash
mkdir -p prisma && node server.js
```

## Solution 3: Create Directory in Build Command

**Update Build Command to:**
```bash
mkdir -p prisma && npm install && npx prisma generate && npx prisma migrate deploy
```

## Solution 4: Use Environment Variable for Database Path

Set a custom database location in Render Environment Variables:

1. **Add to Render Environment:**
   ```env
   DATABASE_URL="file:/opt/render/project/src/data/production.db"
   ```

2. **Update Pre-Deploy Command:**
   ```bash
   mkdir -p /opt/render/project/src/data && npx prisma migrate deploy
   ```

## Complete Render Configuration

Here's the recommended setup for Render:

### Environment Variables (in Render Dashboard):
```env
DATABASE_URL="file:./prisma/production.db"
NODE_ENV="production"
PORT=3000
```

### Build Command:
```bash
mkdir -p prisma && npm install && npx prisma generate
```

### Pre-Deploy Command:
```bash
mkdir -p prisma && npx prisma migrate deploy || true
```

The `|| true` prevents deployment failure if migrations already ran.

### Start Command:
```bash
node server.js
```

## Quick Fix Steps

1. **Go to Render Dashboard → Your Service → Settings**

2. **Enable Persistent Disk:**
   - Scroll to "Persistent Disk"
   - Enable it
   - Size: 1GB (or more if needed)
   - Mount point: `/opt/render/project/src`

3. **Update Pre-Deploy Command:**
   ```bash
   mkdir -p prisma && npx prisma migrate deploy
   ```

4. **Update Build Command:**
   ```bash
   mkdir -p prisma && npm install && npx prisma generate
   ```

5. **Save and Redeploy**

## Verify It Works

After redeploying, check your Render logs. You should see:
```
✅ Database connected successfully
✅ User table is accessible
```

Instead of read-only errors.

## If Still Not Working

### Check Render Service Type

Make sure you're using a **Web Service** (not Static Site), as only Web Services get persistent disks.

### Use Render Shell to Create Directory

1. Open Render Shell
2. Run:
   ```bash
   mkdir -p /opt/render/project/src/prisma
   chmod 755 /opt/render/project/src/prisma
   ls -la /opt/render/project/src/prisma
   ```

3. Verify the directory exists and is writable

### Check DATABASE_URL

In Render Shell, verify:
```bash
echo $DATABASE_URL
# Should show: file:./prisma/production.db
```

## Render-Specific Notes

- **Persistent Disk:** Only available for Web Services, not Static Sites
- **Directory Creation:** Do this in Pre-Deploy or Start Command, not Build
- **File System:** `/opt/render/project/src` is the writable location during runtime
- **Build vs Runtime:** Build happens on a different filesystem; database must be on persistent disk
