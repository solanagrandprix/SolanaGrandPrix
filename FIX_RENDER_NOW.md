# Quick Fix: Add Missing Columns Directly on Render

Since the script file isn't deployed yet, use this SQL approach instead.

## Option 1: Use Render Shell (Fastest)

1. **Open Render Shell:**
   - Go to https://dashboard.render.com
   - Click your service
   - Click "Shell" tab
   - Click "Connect"

2. **Run these commands:**
   ```bash
   cd /opt/render/project/src
   sqlite3 prisma/production.db
   ```

3. **In SQLite, paste these commands:**
   ```sql
   -- Add missing columns
   ALTER TABLE "User" ADD COLUMN "isAdmin" INTEGER DEFAULT 0;
   
   ALTER TABLE "Driver" ADD COLUMN "cardCustomization" TEXT;
   ALTER TABLE "Driver" ADD COLUMN "iracing" TEXT;
   ALTER TABLE "Driver" ADD COLUMN "solanaWallet" TEXT;
   
   -- Verify columns were added
   .schema User
   .schema Driver
   
   -- Exit SQLite
   .quit
   ```

4. **Restart your service** (Manual Deploy → Clear build cache & deploy)

## Option 2: Update Build Command to Use SQL Directly

Since the script file isn't there, you can add the columns directly in the Build Command:

**In Render Dashboard → Build Command, use:**
```bash
npm install && npx prisma generate && sqlite3 prisma/production.db "ALTER TABLE \"User\" ADD COLUMN \"isAdmin\" INTEGER DEFAULT 0;" 2>/dev/null || true && sqlite3 prisma/production.db "ALTER TABLE \"Driver\" ADD COLUMN \"cardCustomization\" TEXT;" 2>/dev/null || true && npx prisma migrate deploy
```

This adds the columns if they don't exist (the `2>/dev/null || true` ignores errors if columns already exist).

## Option 3: Commit and Push the Fix Script First

If you want to use the script approach:

1. **On your local machine, commit the script:**
   ```powershell
   git add add-missing-columns-render.js
   git commit -m "Add database fix script"
   git push origin main
   ```

2. **Wait for Render to redeploy**

3. **Then update Build Command to:**
   ```bash
   npm install && npx prisma generate && node add-missing-columns-render.js && npx prisma migrate deploy
   ```

## Recommended: Use Option 1 (SQL via Shell)

This is the fastest way to fix it right now:

```bash
# In Render Shell
cd /opt/render/project/src
sqlite3 prisma/production.db <<EOF
ALTER TABLE "User" ADD COLUMN "isAdmin" INTEGER DEFAULT 0;
ALTER TABLE "Driver" ADD COLUMN "cardCustomization" TEXT;
ALTER TABLE "Driver" ADD COLUMN "iracing" TEXT;
ALTER TABLE "Driver" ADD COLUMN "solanaWallet" TEXT;
.quit
EOF
```

Then restart your service.
