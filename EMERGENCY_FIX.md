# EMERGENCY FIX - Login & Page Errors

## Immediate Actions Required

### Step 1: Stop Your Server
Press `Ctrl+C` in the terminal where your server is running

### Step 2: Reset Prisma Client
```powershell
# Delete old Prisma client
rm -r node_modules/.prisma
# Or on Windows:
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue

# Regenerate Prisma client
npx prisma generate
```

### Step 3: Fix Migration State
```powershell
# Resolve the failed migration
npx prisma migrate resolve --rolled-back 20260104000000_add_driver_profile_fields
npx prisma migrate resolve --applied 20260104000000_add_driver_profile_fields

# Deploy migrations
npx prisma migrate deploy

# Verify status
npx prisma migrate status
```

### Step 4: Test Database Connection
```powershell
node diagnose-and-fix.js
```

This will tell you exactly what's wrong with the database.

### Step 5: Restart Server
```powershell
npm start
```

### Step 6: Check Server Console
When you try to log in, check the server console output. It will now show detailed error messages.

## If Still Not Working

### Check Server is Actually Starting
Look for this message in console:
```
Server is running at http://localhost:3000
```

If you don't see this, the server is crashing on startup. Check for error messages.

### Common Issues & Fixes

#### Issue: "Cannot find module '@prisma/client'"
**Fix**: 
```powershell
npm install @prisma/client
npx prisma generate
```

#### Issue: "no such column" errors
**Fix**: Database schema mismatch
```powershell
npx prisma migrate reset --skip-seed  # WARNING: This deletes all data!
npx prisma migrate deploy
npx prisma generate
```

#### Issue: "Failed to fetch" in browser
**Fix**: Server not running or wrong port
- Check server is running
- Check browser is pointing to correct URL (http://localhost:3000)
- Check browser console for CORS errors

#### Issue: Pages loading but showing errors
**Fix**: API endpoints failing
- Check server console for API errors
- Verify database connection
- Check if routes are defined correctly

## Quick Full Reset (Use with Caution - Deletes Data!)

If nothing else works:

```powershell
# Stop server
# Backup your database first!
# Copy prisma/dev.db to prisma/dev.db.backup

# Reset everything
npx prisma migrate reset --skip-seed
npx prisma migrate deploy
npx prisma generate
npm install
npm start
```

## Get Detailed Error Messages

I've added enhanced error logging. When you try to log in, the server console will show:
- Exact error message
- Error code
- Missing columns (if any)
- Full stack trace (in development mode)

**Share the error message from the server console if issues persist.**
