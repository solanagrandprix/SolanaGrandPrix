# Fix Render.com Database - Missing Columns

## Quick Fix for Render.com

Your Render database is missing columns (`isAdmin`, `cardCustomization`). Here's how to fix it:

### Option 1: Use the Fix Script (Easiest)

1. **Open Render Shell:**
   - Go to https://dashboard.render.com
   - Click your service
   - Click "Shell" tab
   - Click "Connect" or "Open Shell"

2. **Upload and run the fix script:**
   ```bash
   # You're already in /opt/render/project/src
   cd /opt/render/project/src
   
   # The script should be there if you committed it
   # If not, you'll need to commit it first, then:
   node add-missing-columns-render.js
   ```

3. **Restart your service:**
   - Go back to Render dashboard
   - Click "Manual Deploy" → "Clear build cache & deploy"

### Option 2: Run SQL Directly (If script doesn't work)

1. **Open Render Shell**

2. **Connect to SQLite:**
   ```bash
   cd /opt/render/project/src
   sqlite3 prisma/production.db
   ```

3. **Run these SQL commands:**
   ```sql
   -- Add isAdmin to User table
   ALTER TABLE "User" ADD COLUMN "isAdmin" INTEGER DEFAULT 0;
   
   -- Add cardCustomization to Driver table
   ALTER TABLE "Driver" ADD COLUMN "cardCustomization" TEXT;
   
   -- Add other missing columns if needed
   ALTER TABLE "Driver" ADD COLUMN "iracing" TEXT;
   ALTER TABLE "Driver" ADD COLUMN "solanaWallet" TEXT;
   ALTER TABLE "Driver" ADD COLUMN "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP;
   
   -- Verify
   .schema User
   .schema Driver
   
   -- Exit
   .quit
   ```

4. **Restart your service**

### Option 3: Reset and Re-migrate (If database is empty/new)

**⚠️ WARNING: This deletes all data!**

1. **Open Render Shell**
2. **Run:**
   ```bash
   cd /opt/render/project/src
   
   # Delete old database
   rm -f prisma/production.db prisma/production.db-journal
   
   # Generate and migrate
   npx prisma generate
   npx prisma migrate deploy
   
   # Or reset (if migrations fail)
   npx prisma migrate reset --force
   ```

3. **Restart service**

## Prevent This in the Future

### Update Render Build Command

In Render dashboard → Your Service → Settings → Build Command:

```bash
npm install && npx prisma generate && npx prisma migrate deploy
```

This ensures migrations run on every deploy.

### Or Create Post-Deploy Script

1. **Create `render-post-deploy.sh`:**
   ```bash
   #!/bin/bash
   set -e
   echo "Running Prisma migrations..."
   npx prisma migrate deploy
   echo "Migrations complete!"
   ```

2. **In Render → Settings → Post-Deploy Command:**
   ```bash
   bash render-post-deploy.sh
   ```

## Verify It's Fixed

After running the fix, check your Render logs. You should see:
```
✅ Database connected successfully
✅ User table is accessible
```

Instead of errors about missing columns.

## If You Can't Access Render Shell

If Render doesn't provide shell access, you can:

1. **Add the fix script to your repo** (commit `add-missing-columns-render.js`)
2. **Update Render Build Command** to run it:
   ```bash
   npm install && npx prisma generate && node add-missing-columns-render.js && npm start
   ```
3. **Redeploy** - the script will run automatically

## Check Your Environment Variables

Make sure in Render → Environment you have:
- `DATABASE_URL="file:./prisma/production.db"` ✅
- `NODE_ENV="production"` ✅

## Still Having Issues?

If columns still don't exist after running the fix:
1. Check Render logs for errors
2. Verify the database file location
3. Make sure persistent disk is enabled
4. Try the SQL method (Option 2) directly
