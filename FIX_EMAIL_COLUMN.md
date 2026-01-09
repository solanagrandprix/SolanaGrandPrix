# Fix Missing Email Column Error

## The Problem
Error: `The column main.User.email does not exist in the current database.`

Your Prisma schema has the `email` field, but your database doesn't have the column yet.

## The Fix

Run these commands in order:

### Step 1: Add the missing columns
```powershell
node add-email-columns-migration.js
```

This will add:
- `email` (TEXT, nullable, unique)
- `emailVerified` (INTEGER, default 0)
- `verificationToken` (TEXT, nullable, unique)
- `verificationSentAt` (DATETIME, nullable)
- `verifiedAt` (DATETIME, nullable)

### Step 2: Regenerate Prisma Client
```powershell
npx prisma generate
```

This updates the Prisma client to match your database schema.

### Step 3: Restart Your Server
1. Stop your server (Ctrl+C)
2. Start it again: `npm start` or `node server.js`

### Step 4: Test Login
Try logging in again. It should work now!

## Alternative: Run the Fix Script
```powershell
.\fix-email-columns.ps1
```

This runs all steps automatically.

## Why This Happened
The Prisma schema was updated to include email fields, but the database migration was never properly applied. The migration script will add these columns without losing any existing data.

## Verification
After running the migration, you can verify the columns exist:
```powershell
node check-database.js
```

This will show if all columns are accessible.
