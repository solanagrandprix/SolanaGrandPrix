# Update Render Build Command

## Problem
The `fix-db` script isn't available yet because the updated `package.json` hasn't been deployed.

## Quick Fix: Update Render Build Command

### In Render Dashboard:

1. **Go to your service → Settings**
2. **Find "Build Command" section**
3. **Update it to:**
   ```bash
   npm install && npx prisma generate && node add-missing-columns-render.js && npx prisma migrate deploy
   ```
   (This runs the script directly with `node` instead of `npm run`)

4. **Or if the script isn't committed yet, use this instead:**
   ```bash
   npm install && npx prisma generate && npx prisma migrate deploy
   ```
   Then manually add the missing columns via Render Shell (see below)

5. **Save and redeploy**

## Alternative: Add Missing Columns Directly

If you can't update the build command right now, add the columns directly:

### Option 1: Use Render Shell

1. **Open Render Shell** (Service → Shell tab)
2. **Run these SQL commands:**
   ```bash
   cd /opt/render/project/src
   sqlite3 prisma/production.db
   ```
   
   Then in SQLite:
   ```sql
   -- Add missing columns
   ALTER TABLE "User" ADD COLUMN "isAdmin" INTEGER DEFAULT 0;
   ALTER TABLE "Driver" ADD COLUMN "cardCustomization" TEXT;
   ALTER TABLE "Driver" ADD COLUMN "iracing" TEXT;
   ALTER TABLE "Driver" ADD COLUMN "solanaWallet" TEXT;
   
   -- Verify
   .schema User
   .schema Driver
   
   -- Exit
   .quit
   ```

3. **Restart your service**

### Option 2: Commit and Push the Fix Script

1. **Commit the fix script:**
   ```powershell
   git add add-missing-columns-render.js package.json
   git commit -m "Add database fix script for Render"
   git push origin main
   ```

2. **After Render redeploys, update Build Command to:**
   ```bash
   npm install && npx prisma generate && node add-missing-columns-render.js && npx prisma migrate deploy
   ```

## Recommended Build Command

Once everything is set up, your Build Command should be:

```bash
npm install && npx prisma generate && node add-missing-columns-render.js && npx prisma migrate deploy
```

This ensures:
1. Dependencies are installed
2. Prisma client is generated
3. Missing columns are added
4. Migrations are applied

## Pre-Deploy Command (Alternative)

You can also use the Pre-Deploy Command section:

```bash
node add-missing-columns-render.js && npx prisma migrate deploy
```

This runs after the build but before the start command.
